package com.classops.backend.tenantemail;

import com.classops.backend.common.ApiException;
import com.classops.backend.scheduling.SchedulingEngine;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.teaching.TeachingSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static com.classops.backend.tenantemail.GmailDtos.GmailAuthorizationView;
import static com.classops.backend.tenantemail.GmailDtos.TenantEmailConnectionView;
import static com.classops.backend.tenantemail.GmailDtos.TestGmailInput;
import static com.classops.backend.tenantemail.GmailDtos.TestGmailResult;

@Service
public class TenantEmailConnectionService {
    private static final Duration TEST_COOLDOWN = Duration.ofSeconds(30);
    private static final int OAUTH_RATE_LIMIT = 20;
    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final TeachingSupport support;
    private final GmailProperties properties;
    private final GmailTokenCipher cipher;
    private final GmailApiClient gmail;
    private final SecureRandom random = new SecureRandom();
    private final String appPublicUrl;

    public TenantEmailConnectionService(JdbcClient jdbc, CurrentActor actor, TeachingSupport support,
                                        GmailProperties properties, GmailTokenCipher cipher,
                                        GmailApiClient gmail,
                                        @Value("${app.public-url:http://localhost:5173}") String appPublicUrl) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.support = support;
        this.properties = properties;
        this.cipher = cipher;
        this.gmail = gmail;
        this.appPublicUrl = trimRight(appPublicUrl);
    }

    @Transactional(readOnly = true)
    public TenantEmailConnectionView status() {
        UUID tenantId = actor.tenantId();
        requireAdmin(tenantId, actor.userId());
        ConnectionRow row = connection(tenantId);
        long pending = pendingEmailCount(tenantId);
        if (row == null) {
            return new TenantEmailConnectionView("NOT_CONNECTED", properties.configured(), null,
                null, null, null, null, null, null, null, pending, 0);
        }
        return new TenantEmailConnectionView(row.status(), properties.configured(),
            mask(row.gmailAddress()), row.gmailAddress(), row.connectedByName(), row.connectedAt(),
            row.lastSuccessfulSendAt(), row.lastErrorCode(), row.lastErrorMessage(),
            row.lastErrorAt(), pending, row.version());
    }

    @Transactional
    public GmailAuthorizationView authorize(String key) {
        UUID tenantId = actor.tenantId();
        UUID userId = actor.userId();
        requireAdmin(tenantId, userId);
        ensureConfigured();
        support.requireIdempotencyKey(key);
        String requestHash = support.requestHash(Map.of("tenantId", tenantId, "userId", userId));
        GmailAuthorizationView repeated = support.repeated(tenantId,
            "tenant-gmail-oauth-authorization", key, requestHash, GmailAuthorizationView.class);
        if (repeated != null) return repeated;
        enforceOAuthRateLimit(tenantId);

        UUID stateId = UUID.randomUUID();
        String state = randomToken(32);
        String verifier = randomToken(48);
        GmailTokenCipher.EncryptedValue encryptedVerifier = cipher.encrypt(verifier, tenantId, stateId);
        OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plus(properties.oauthStateTtl());
        long expectedVersion = currentVersion(tenantId);
        jdbc.sql("""
                INSERT INTO tenant_gmail_oauth_states (
                  id, tenant_id, state_hash, pkce_verifier_ciphertext, pkce_verifier_iv,
                  expected_connection_version, initiated_by, expires_at
                ) VALUES (
                  :id, :tenantId, :stateHash, :ciphertext, :iv,
                  :expectedVersion, :userId, :expiresAt
                )
                """)
            .param("id", stateId)
            .param("tenantId", tenantId)
            .param("stateHash", hash(state))
            .param("ciphertext", encryptedVerifier.ciphertext())
            .param("iv", encryptedVerifier.iv())
            .param("expectedVersion", expectedVersion)
            .param("userId", userId)
            .param("expiresAt", expiresAt)
            .update();
        String challenge = base64Url(sha256Bytes(verifier));
        String url = UriComponentsBuilder.fromUriString(properties.authorizationUri())
            .queryParam("client_id", properties.clientId())
            .queryParam("redirect_uri", properties.redirectUri())
            .queryParam("response_type", "code")
            .queryParam("scope", String.join(" ", List.of(
                GmailProperties.OPENID_SCOPE,
                GmailProperties.EMAIL_SCOPE,
                GmailProperties.GMAIL_SEND_SCOPE)))
            .queryParam("access_type", "offline")
            .queryParam("prompt", "consent select_account")
            .queryParam("state", state)
            .queryParam("code_challenge", challenge)
            .queryParam("code_challenge_method", "S256")
            .build()
            .toUriString();
        GmailAuthorizationView response = new GmailAuthorizationView(url, expiresAt);
        support.remember(tenantId, "tenant-gmail-oauth-authorization", key, requestHash, 201, response);
        return response;
    }

    @Transactional
    public String callbackRedirect(String state, String code, String googleError) {
        StateRow stateRow = state == null || state.isBlank() ? null : stateRow(hash(state));
        if (stateRow == null) {
            return redirect(null, "failure", "GMAIL_OAUTH_STATE_INVALID");
        }
        String tenantSlug = tenantSlug(stateRow.tenantId());
        if (stateRow.consumedAt() != null) {
            return redirect(tenantSlug, "failure", "GMAIL_OAUTH_STATE_USED");
        }
        if (stateRow.expiresAt().isBefore(OffsetDateTime.now(ZoneOffset.UTC))) {
            return redirect(tenantSlug, "failure", "GMAIL_OAUTH_STATE_EXPIRED");
        }
        if (googleError != null && !googleError.isBlank()) {
            consumeState(stateRow.id());
            return redirect(tenantSlug, "failure", "GMAIL_SEND_FAILED");
        }
        if (code == null || code.isBlank()) {
            consumeState(stateRow.id());
            return redirect(tenantSlug, "failure", "GMAIL_OAUTH_STATE_INVALID");
        }
        if (!activeAdmin(stateRow.tenantId(), stateRow.initiatedBy())) {
            consumeState(stateRow.id());
            return redirect(tenantSlug, "failure", "FORBIDDEN");
        }
        try {
            String verifier = cipher.decrypt(stateRow.pkceVerifierCiphertext(), stateRow.pkceVerifierIv(),
                stateRow.tenantId(), stateRow.id());
            GmailApiClient.AuthorizationGrant grant = gmail.exchangeCode(code, verifier);
            if (!grant.emailVerified()) {
                consumeState(stateRow.id());
                return redirect(tenantSlug, "failure", "GMAIL_EMAIL_UNVERIFIED");
            }
            if (!gmail.hasSendScope(grant.scopes())) {
                consumeState(stateRow.id());
                return redirect(tenantSlug, "failure", "GMAIL_SCOPE_MISSING");
            }
            if (grant.refreshToken() == null || grant.refreshToken().isBlank()) {
                consumeState(stateRow.id());
                return redirect(tenantSlug, "failure", "GMAIL_REAUTH_REQUIRED");
            }
            connect(stateRow, grant);
            consumeState(stateRow.id());
            return redirect(tenantSlug, "success", null);
        } catch (ApiException ex) {
            consumeState(stateRow.id());
            return redirect(tenantSlug, "failure", ex.code());
        } catch (GmailSendException ex) {
            consumeState(stateRow.id());
            return redirect(tenantSlug, "failure", ex.code());
        }
    }

    @Transactional(readOnly = true)
    public String callbackFailureRedirect(String state, String code) {
        String tenantSlug = null;
        if (state != null && !state.isBlank()) {
            try {
                StateRow row = stateRow(hash(state));
                if (row != null) {
                    tenantSlug = tenantSlug(row.tenantId());
                }
            } catch (RuntimeException ignored) {
                tenantSlug = null;
            }
        }
        return redirect(tenantSlug, "failure", code);
    }

    @Transactional
    public TestGmailResult test(TestGmailInput input, String key) {
        UUID tenantId = actor.tenantId();
        UUID userId = actor.userId();
        requireAdmin(tenantId, userId);
        ensureConfigured();
        String recipient = clean(input == null ? null : input.recipientEmail());
        if (recipient == null) recipient = currentUserEmail(tenantId, userId);
        if (recipient == null || !recipient.contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Cần email người nhận hợp lệ để gửi thử.");
        }
        support.requireIdempotencyKey(key);
        String requestHash = support.requestHash(Map.of("recipientEmail", recipient.toLowerCase(Locale.ROOT)));
        TestGmailResult repeated = support.repeated(tenantId, "tenant-gmail-test-message",
            key, requestHash, TestGmailResult.class);
        if (repeated != null) return repeated;

        ConnectionRow row = connectedForSend(tenantId);
        if (row.lastTestSentAt() != null
            && row.lastTestSentAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC).minus(TEST_COOLDOWN))) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "GMAIL_RATE_LIMITED",
                "Vui lòng đợi 30 giây trước khi gửi thử lại.", Map.of("retryAfterSeconds", 30));
        }
        String refreshToken = cipher.decrypt(row.refreshTokenCiphertext(), row.refreshTokenIv(), tenantId, row.id());
        String messageId;
        try {
            messageId = gmail.sendMessage(refreshToken, tenantName(tenantId), row.gmailAddress(),
                recipient, "Kiểm tra Gmail thông báo", "Email thử từ hệ thống quản lý lớp học.", tenantSettingsUrl());
        } catch (GmailSendException ex) {
            if (ex.reauthRequired()) {
                markReauthRequired(tenantId, row.id(), ex.code(), ex.getMessage());
                throw new ApiException(HttpStatus.CONFLICT, "GMAIL_REAUTH_REQUIRED",
                    "Gmail cần được xác thực lại trước khi gửi email thử.");
            }
            updateConnectionSendFailure(tenantId, row.id(), ex.code(), ex.getMessage());
            HttpStatus status = ex.retryable() ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.CONFLICT;
            Map<String, Object> details = ex.retryAfter() == null
                ? Map.of()
                : Map.of("retryAfterSeconds", Math.max(1, ex.retryAfter().toSeconds()));
            throw new ApiException(status, ex.code(), ex.getMessage(), details);
        }
        OffsetDateTime sentAt = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.sql("""
                UPDATE tenant_email_connections
                SET last_test_sent_at=:sentAt, last_successful_send_at=:sentAt,
                    last_error_at=NULL, last_error_code=NULL, last_error_message=NULL,
                    updated_at=now()
                WHERE tenant_id=:tenantId
                """)
            .param("sentAt", sentAt)
            .param("tenantId", tenantId)
            .update();
        TestGmailResult response = new TestGmailResult(messageId, sentAt);
        support.remember(tenantId, "tenant-gmail-test-message", key, requestHash, 200, response);
        return response;
    }

    @Transactional
    public void disconnect(long version) {
        UUID tenantId = actor.tenantId();
        UUID userId = actor.userId();
        requireAdmin(tenantId, userId);
        ConnectionRow before = connection(tenantId);
        if (before == null) return;
        int changed = jdbc.sql("""
                UPDATE tenant_email_connections
                SET status='DISCONNECTED', refresh_token_ciphertext=NULL, refresh_token_iv=NULL,
                    disconnected_by=:userId, disconnected_at=now(), updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND version=:version
                """)
            .param("userId", userId)
            .param("tenantId", tenantId)
            .param("version", version)
            .update();
        if (changed != 1) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_VERSION_CONFLICT",
                "Kết nối Gmail đã thay đổi. Vui lòng tải lại.");
        }
        support.audit(tenantId, userId, "USER", "TENANT_GMAIL_DISCONNECTED",
            "TenantEmailConnection", before.id(), publicConnection(before), Map.of("status", "DISCONNECTED"));
    }

    ConnectionRow connectedForSend(UUID tenantId) {
        ConnectionRow row = connection(tenantId);
        if (row == null || "DISCONNECTED".equals(row.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_CONNECTION_REQUIRED",
                "Tenant chưa kết nối Gmail thông báo.");
        }
        if ("REAUTH_REQUIRED".equals(row.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_REAUTH_REQUIRED",
                "Tenant cần xác thực lại Gmail thông báo.");
        }
        return row;
    }

    public void requireConnectedForSend(UUID tenantId) {
        connectedForSend(tenantId);
    }

    void markReauthRequired(UUID tenantId, UUID connectionId, String code, String message) {
        jdbc.sql("""
                UPDATE tenant_email_connections
                SET status='REAUTH_REQUIRED', last_error_at=now(), last_error_code=:code,
                    last_error_message=:message, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:connectionId AND status='CONNECTED'
                """)
            .param("tenantId", tenantId)
            .param("connectionId", connectionId)
            .param("code", code)
            .param("message", message)
            .update();
    }

    void markSendSuccess(UUID tenantId, UUID connectionId) {
        jdbc.sql("""
                UPDATE tenant_email_connections
                SET last_successful_send_at=now(), last_error_at=NULL, last_error_code=NULL,
                    last_error_message=NULL, updated_at=now()
                WHERE tenant_id=:tenantId AND id=:connectionId
                """)
            .param("tenantId", tenantId)
            .param("connectionId", connectionId)
            .update();
    }

    void updateConnectionSendFailure(UUID tenantId, UUID connectionId, String code, String message) {
        jdbc.sql("""
                UPDATE tenant_email_connections
                SET last_error_at=now(), last_error_code=:code,
                    last_error_message=:message, updated_at=now()
                WHERE tenant_id=:tenantId AND id=:connectionId
                """)
            .param("tenantId", tenantId)
            .param("connectionId", connectionId)
            .param("code", code)
            .param("message", message)
            .update();
    }

    String decryptRefreshToken(ConnectionRow row) {
        return cipher.decrypt(row.refreshTokenCiphertext(), row.refreshTokenIv(), row.tenantId(), row.id());
    }

    String tenantName(UUID tenantId) {
        return jdbc.sql("SELECT name FROM tenants WHERE id=:tenantId")
            .param("tenantId", tenantId)
            .query(String.class)
            .single();
    }

    String absoluteDeepLink(String deepLink) {
        if (deepLink == null || deepLink.isBlank()) return "";
        if (deepLink.startsWith("http://") || deepLink.startsWith("https://")) return deepLink;
        return appPublicUrl + (deepLink.startsWith("/") ? deepLink : "/" + deepLink);
    }

    private void connect(StateRow stateRow, GmailApiClient.AuthorizationGrant grant) {
        jdbc.sql("SELECT id FROM tenants WHERE id=:tenantId FOR UPDATE")
            .param("tenantId", stateRow.tenantId())
            .query(UUID.class)
            .single();
        ConnectionRow before = connection(stateRow.tenantId());
        long actualVersion = before == null ? 0 : before.version();
        if (actualVersion != stateRow.expectedConnectionVersion()) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_VERSION_CONFLICT",
                "Kết nối Gmail đã được thay đổi bởi Admin khác.");
        }
        UUID connectionId = before == null ? UUID.randomUUID() : before.id();
        GmailTokenCipher.EncryptedValue encrypted = cipher.encrypt(grant.refreshToken(),
            stateRow.tenantId(), connectionId);
        if (before == null) {
            jdbc.sql("""
                    INSERT INTO tenant_email_connections (
                      id, tenant_id, gmail_address, google_subject, status,
                      refresh_token_ciphertext, refresh_token_iv, token_key_version, scopes,
                      connected_by, connected_at, version
                    ) VALUES (
                      :id, :tenantId, :email, :subject, 'CONNECTED',
                      :ciphertext, :iv, :keyVersion, :scopes,
                      :connectedBy, now(), 1
                    )
                    """)
                .param("id", connectionId)
                .param("tenantId", stateRow.tenantId())
                .param("email", grant.email())
                .param("subject", grant.googleSubject())
                .param("ciphertext", encrypted.ciphertext())
                .param("iv", encrypted.iv())
                .param("keyVersion", properties.keyVersion())
                .param("scopes", grant.scopes())
                .param("connectedBy", stateRow.initiatedBy())
                .update();
        } else {
            jdbc.sql("""
                    UPDATE tenant_email_connections
                    SET gmail_address=:email, google_subject=:subject, status='CONNECTED',
                        refresh_token_ciphertext=:ciphertext, refresh_token_iv=:iv,
                        token_key_version=:keyVersion, scopes=:scopes,
                        connected_by=:connectedBy, connected_at=now(),
                        disconnected_by=NULL, disconnected_at=NULL,
                        last_error_at=NULL, last_error_code=NULL, last_error_message=NULL,
                        updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId AND id=:id
                    """)
                .param("email", grant.email())
                .param("subject", grant.googleSubject())
                .param("ciphertext", encrypted.ciphertext())
                .param("iv", encrypted.iv())
                .param("keyVersion", properties.keyVersion())
                .param("scopes", grant.scopes())
                .param("connectedBy", stateRow.initiatedBy())
                .param("tenantId", stateRow.tenantId())
                .param("id", connectionId)
                .update();
        }
        support.audit(stateRow.tenantId(), stateRow.initiatedBy(), "USER", "TENANT_GMAIL_CONNECTED",
            "TenantEmailConnection", connectionId, before == null ? null : publicConnection(before),
            Map.of("gmailAddress", mask(grant.email()), "googleSubject", grant.googleSubject()));
    }

    private void enforceOAuthRateLimit(UUID tenantId) {
        OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minusHours(1);
        long count = jdbc.sql("""
                SELECT count(*) FROM tenant_gmail_oauth_states
                WHERE tenant_id=:tenantId AND created_at>=:since
                """)
            .param("tenantId", tenantId)
            .param("since", since)
            .query(Long.class)
            .single();
        if (count >= OAUTH_RATE_LIMIT) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "GMAIL_RATE_LIMITED",
                "Bạn đã tạo quá nhiều phiên kết nối Gmail. Vui lòng thử lại sau.",
                Map.of("retryAfterSeconds", 3600));
        }
    }

    private void ensureConfigured() {
        if (!properties.configured()) {
            throw new ApiException(HttpStatus.CONFLICT, "GMAIL_NOT_CONFIGURED",
                "Máy chủ chưa cấu hình OAuth Gmail.");
        }
    }

    private void requireAdmin(UUID tenantId, UUID userId) {
        if (!activeAdmin(tenantId, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
                "Chỉ Admin tenant được quản lý Gmail thông báo.");
        }
    }

    private boolean activeAdmin(UUID tenantId, UUID userId) {
        return jdbc.sql("""
                SELECT count(*) FROM users u
                JOIN user_roles r ON r.tenant_id=u.tenant_id AND r.user_id=u.id
                WHERE u.tenant_id=:tenantId AND u.id=:userId
                  AND u.status='ACTIVE' AND r.role_code='ADMIN'
                """)
            .param("tenantId", tenantId)
            .param("userId", userId)
            .query(Long.class)
            .single() > 0;
    }

    private ConnectionRow connection(UUID tenantId) {
        return jdbc.sql("""
                SELECT c.id, c.tenant_id, c.gmail_address, c.google_subject, c.status,
                       c.refresh_token_ciphertext, c.refresh_token_iv, c.token_key_version, c.scopes,
                       c.connected_by, u.display_name connected_by_name, c.connected_at,
                       c.last_successful_send_at, c.last_error_at, c.last_error_code,
                       c.last_error_message, c.last_test_sent_at, c.version
                FROM tenant_email_connections c
                LEFT JOIN users u ON u.tenant_id=c.tenant_id AND u.id=c.connected_by
                WHERE c.tenant_id=:tenantId
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new ConnectionRow(
                rs.getObject("id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("gmail_address"),
                rs.getString("google_subject"),
                rs.getString("status"),
                rs.getBytes("refresh_token_ciphertext"),
                rs.getBytes("refresh_token_iv"),
                rs.getInt("token_key_version"),
                rs.getString("scopes"),
                rs.getObject("connected_by", UUID.class),
                rs.getString("connected_by_name"),
                rs.getObject("connected_at", OffsetDateTime.class),
                rs.getObject("last_successful_send_at", OffsetDateTime.class),
                rs.getObject("last_error_at", OffsetDateTime.class),
                rs.getString("last_error_code"),
                rs.getString("last_error_message"),
                rs.getObject("last_test_sent_at", OffsetDateTime.class),
                rs.getLong("version")))
            .optional()
            .orElse(null);
    }

    private StateRow stateRow(String stateHash) {
        return jdbc.sql("""
                SELECT id, tenant_id, state_hash, pkce_verifier_ciphertext, pkce_verifier_iv,
                       expected_connection_version, initiated_by, expires_at, consumed_at
                FROM tenant_gmail_oauth_states
                WHERE state_hash=:stateHash
                """)
            .param("stateHash", stateHash)
            .query((rs, row) -> new StateRow(
                rs.getObject("id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("state_hash"),
                rs.getBytes("pkce_verifier_ciphertext"),
                rs.getBytes("pkce_verifier_iv"),
                rs.getLong("expected_connection_version"),
                rs.getObject("initiated_by", UUID.class),
                rs.getObject("expires_at", OffsetDateTime.class),
                rs.getObject("consumed_at", OffsetDateTime.class)))
            .optional()
            .orElse(null);
    }

    private void consumeState(UUID id) {
        jdbc.sql("""
                UPDATE tenant_gmail_oauth_states
                SET consumed_at=COALESCE(consumed_at, now())
                WHERE id=:id
                """).param("id", id).update();
    }

    private long currentVersion(UUID tenantId) {
        Long version = jdbc.sql("SELECT version FROM tenant_email_connections WHERE tenant_id=:tenantId")
            .param("tenantId", tenantId)
            .query(Long.class)
            .optional()
            .orElse(null);
        return version == null ? 0 : version;
    }

    private long pendingEmailCount(UUID tenantId) {
        return jdbc.sql("""
                SELECT count(*) FROM outbox_events
                WHERE tenant_id=:tenantId AND event_type='EMAIL_NOTIFICATION'
                  AND published_at IS NULL AND dead_lettered_at IS NULL
                """)
            .param("tenantId", tenantId)
            .query(Long.class)
            .single();
    }

    private String tenantSlug(UUID tenantId) {
        return jdbc.sql("SELECT slug FROM tenants WHERE id=:tenantId")
            .param("tenantId", tenantId)
            .query(String.class)
            .single();
    }

    private String currentUserEmail(UUID tenantId, UUID userId) {
        return jdbc.sql("SELECT email FROM users WHERE tenant_id=:tenantId AND id=:userId")
            .param("tenantId", tenantId)
            .param("userId", userId)
            .query(String.class)
            .optional()
            .orElse(null);
    }

    private String tenantSettingsUrl() {
        String tenantSlug = actor.tenantSlug();
        return appPublicUrl + "/t/" + tenantSlug + "/app/settings/email";
    }

    private String redirect(String tenantSlug, String result, String code) {
        String target = tenantSlug == null
            ? appPublicUrl + "/"
            : appPublicUrl + "/t/" + tenantSlug + "/app/settings/email";
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(target)
            .queryParam("gmailResult", result);
        if (code != null) builder.queryParam("code", code);
        return builder.build().toUriString();
    }

    private String randomToken(int bytes) {
        byte[] data = new byte[bytes];
        random.nextBytes(data);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    private String hash(String value) {
        return SchedulingEngine.sha256(value);
    }

    private byte[] sha256Bytes(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String mask(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) return null;
        String[] parts = email.split("@", 2);
        String local = parts[0];
        String shown = local.length() <= 2 ? local.substring(0, 1) : local.substring(0, 2);
        return shown + "***@" + parts[1];
    }

    private Object publicConnection(ConnectionRow row) {
        return Map.of("status", row.status(), "gmailAddress", mask(row.gmailAddress()),
            "googleSubject", row.googleSubject(), "version", row.version());
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String trimRight(String value) {
        if (value == null || value.isBlank()) return "";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    public record ConnectionRow(
        UUID id,
        UUID tenantId,
        String gmailAddress,
        String googleSubject,
        String status,
        byte[] refreshTokenCiphertext,
        byte[] refreshTokenIv,
        int tokenKeyVersion,
        String scopes,
        UUID connectedBy,
        String connectedByName,
        OffsetDateTime connectedAt,
        OffsetDateTime lastSuccessfulSendAt,
        OffsetDateTime lastErrorAt,
        String lastErrorCode,
        String lastErrorMessage,
        OffsetDateTime lastTestSentAt,
        long version
    ) {
    }

    private record StateRow(
        UUID id,
        UUID tenantId,
        String stateHash,
        byte[] pkceVerifierCiphertext,
        byte[] pkceVerifierIv,
        long expectedConnectionVersion,
        UUID initiatedBy,
        OffsetDateTime expiresAt,
        OffsetDateTime consumedAt
    ) {
    }
}
