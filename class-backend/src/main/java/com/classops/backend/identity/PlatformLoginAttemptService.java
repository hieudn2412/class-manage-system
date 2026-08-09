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
import java.util.Locale;
import java.util.Map;

@Service
public class PlatformLoginAttemptService {
    private static final String ACCOUNT = "ACCOUNT";
    private static final String IP = "IP";

    private final JdbcClient jdbc;
    private final SecurityProperties properties;

    public PlatformLoginAttemptService(JdbcClient jdbc, SecurityProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public void ensureAllowed(String username, String clientIp) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        long retryAfter = Math.max(
            retryAfter(ACCOUNT, hash(normalize(username).toLowerCase(Locale.ROOT)), now),
            retryAfter(IP, hash(normalize(clientIp)), now));
        if (retryAfter > 0) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                "Có quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.",
                Map.of("retryAfterSeconds", retryAfter));
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String username, String clientIp) {
        upsert(ACCOUNT, hash(normalize(username).toLowerCase(Locale.ROOT)));
        upsert(IP, hash(normalize(clientIp)));
    }

    @Transactional
    public void clear(String username, String clientIp) {
        jdbc.sql("""
                DELETE FROM platform_login_attempts
                WHERE (scope=:accountScope AND subject_hash=:accountHash)
                   OR (scope=:ipScope AND subject_hash=:ipHash)
                """)
            .param("accountScope", ACCOUNT)
            .param("accountHash", hash(normalize(username).toLowerCase(Locale.ROOT)))
            .param("ipScope", IP).param("ipHash", hash(normalize(clientIp))).update();
    }

    private void upsert(String scope, String subjectHash) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Attempt current = jdbc.sql("""
                SELECT failed_count, last_failed_at FROM platform_login_attempts
                WHERE scope=:scope AND subject_hash=:subjectHash FOR UPDATE
                """)
            .param("scope", scope).param("subjectHash", subjectHash)
            .query((rs, row) -> new Attempt(rs.getInt(1),
                rs.getObject(2, OffsetDateTime.class))).optional().orElse(null);
        int count = current == null
            || current.lastFailedAt().isBefore(now.minus(properties.loginBlockDuration()))
            ? 1 : current.failedCount() + 1;
        OffsetDateTime blockedUntil = count >= properties.maxLoginAttempts()
            ? now.plus(properties.loginBlockDuration()) : null;
        jdbc.sql("""
                INSERT INTO platform_login_attempts
                  (scope, subject_hash, failed_count, last_failed_at, blocked_until)
                VALUES (:scope, :subjectHash, :count, :now, :blockedUntil)
                ON CONFLICT (scope, subject_hash) DO UPDATE
                SET failed_count=EXCLUDED.failed_count, last_failed_at=EXCLUDED.last_failed_at,
                    blocked_until=EXCLUDED.blocked_until
                """)
            .param("scope", scope).param("subjectHash", subjectHash).param("count", count)
            .param("now", now).param("blockedUntil", blockedUntil).update();
    }

    private long retryAfter(String scope, String subjectHash, OffsetDateTime now) {
        return jdbc.sql("""
                SELECT blocked_until FROM platform_login_attempts
                WHERE scope=:scope AND subject_hash=:subjectHash
                """)
            .param("scope", scope).param("subjectHash", subjectHash)
            .query(OffsetDateTime.class).optional()
            .filter(value -> value.isAfter(now))
            .map(value -> Math.max(1L, java.time.Duration.between(now, value).toSeconds() + 1L))
            .orElse(0L);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim();
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required by the JVM.", ex);
        }
    }

    private record Attempt(int failedCount, OffsetDateTime lastFailedAt) {
    }
}
