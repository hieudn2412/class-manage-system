package com.classops.backend.identity;

import com.classops.backend.common.ApiException;
import com.classops.backend.security.SecurityProperties;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
public class LoginAttemptService {
    private static final String ACCOUNT = "ACCOUNT";
    private static final String IP = "IP";

    private final JdbcClient jdbc;
    private final SecurityProperties properties;

    public LoginAttemptService(JdbcClient jdbc, SecurityProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public void ensureAllowed(UUID tenantId, String username, String clientIp) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        long retryAfter = Math.max(
            retryAfter(tenantId, ACCOUNT, accountSubject(username), now),
            retryAfter(tenantId, IP, ipSubject(clientIp), now));
        if (retryAfter > 0) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                "Có quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.",
                Map.of("retryAfterSeconds", retryAfter));
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(UUID tenantId, String username, String clientIp) {
        upsertFailure(tenantId, ACCOUNT, accountSubject(username));
        upsertFailure(tenantId, IP, ipSubject(clientIp));
    }

    @Transactional
    public void clear(UUID tenantId, String username, String clientIp) {
        jdbc.sql("""
                DELETE FROM login_attempts
                WHERE tenant_id=:tenantId
                  AND ((scope=:accountScope AND subject_hash=:accountHash)
                    OR (scope=:ipScope AND subject_hash=:ipHash))
                """)
            .param("tenantId", tenantId)
            .param("accountScope", ACCOUNT)
            .param("accountHash", accountSubject(username))
            .param("ipScope", IP)
            .param("ipHash", ipSubject(clientIp))
            .update();
    }

    public static String hashClientIp(String clientIp) {
        return hash(normalize(clientIp));
    }

    private void upsertFailure(UUID tenantId, String scope, String subjectHash) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Attempt current = jdbc.sql("""
                SELECT failed_count, last_failed_at
                FROM login_attempts
                WHERE tenant_id=:tenantId AND scope=:scope AND subject_hash=:subjectHash
                FOR UPDATE
                """)
            .param("tenantId", tenantId)
            .param("scope", scope)
            .param("subjectHash", subjectHash)
            .query((rs, row) -> new Attempt(
                rs.getInt("failed_count"),
                rs.getObject("last_failed_at", OffsetDateTime.class)))
            .optional()
            .orElse(null);
        int failedCount = current == null
            || current.lastFailedAt().isBefore(now.minus(properties.loginBlockDuration()))
            ? 1 : current.failedCount() + 1;
        OffsetDateTime blockedUntil = failedCount >= properties.maxLoginAttempts()
            ? now.plus(properties.loginBlockDuration()) : null;
        jdbc.sql("""
                INSERT INTO login_attempts (
                  tenant_id, scope, subject_hash, failed_count, last_failed_at, blocked_until
                ) VALUES (
                  :tenantId, :scope, :subjectHash, :failedCount, :lastFailedAt, :blockedUntil
                )
                ON CONFLICT (tenant_id, scope, subject_hash)
                DO UPDATE SET failed_count=EXCLUDED.failed_count,
                  last_failed_at=EXCLUDED.last_failed_at,
                  blocked_until=EXCLUDED.blocked_until
                """)
            .param("tenantId", tenantId)
            .param("scope", scope)
            .param("subjectHash", subjectHash)
            .param("failedCount", failedCount)
            .param("lastFailedAt", now)
            .param("blockedUntil", blockedUntil)
            .update();
    }

    private long retryAfter(UUID tenantId, String scope, String subjectHash, OffsetDateTime now) {
        return jdbc.sql("""
                SELECT blocked_until FROM login_attempts
                WHERE tenant_id=:tenantId AND scope=:scope AND subject_hash=:subjectHash
                """)
            .param("tenantId", tenantId)
            .param("scope", scope)
            .param("subjectHash", subjectHash)
            .query(OffsetDateTime.class)
            .optional()
            .filter(blockedUntil -> blockedUntil.isAfter(now))
            .map(blockedUntil -> Math.max(1L,
                java.time.Duration.between(now, blockedUntil).toSeconds() + 1L))
            .orElse(0L);
    }

    private static String accountSubject(String username) {
        return hash(normalize(username).toLowerCase(java.util.Locale.ROOT));
    }

    private static String ipSubject(String clientIp) {
        return hash(normalize(clientIp));
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim();
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required by the JVM.", ex);
        }
    }

    private record Attempt(int failedCount, OffsetDateTime lastFailedAt) {
    }
}
