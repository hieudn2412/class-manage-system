package com.classops.backend.tenantemail;

import com.classops.backend.common.ApiException;
import com.classops.backend.learningcontent.MaintenanceWriteGuard;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class TenantGmailOutboxScheduler {
    private final JdbcClient jdbc;
    private final ObjectMapper mapper;
    private final MaintenanceWriteGuard maintenance;
    private final TenantEmailConnectionService connections;
    private final GmailApiClient gmail;

    public TenantGmailOutboxScheduler(JdbcClient jdbc, ObjectMapper mapper,
                                      MaintenanceWriteGuard maintenance,
                                      TenantEmailConnectionService connections,
                                      GmailApiClient gmail) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.maintenance = maintenance;
        this.connections = connections;
        this.gmail = gmail;
    }

    @Scheduled(fixedDelayString = "${app.teaching.scheduler-delay-ms:30000}")
    public void deliver() {
        try {
            maintenance.requireWritable();
        } catch (RuntimeException ignored) {
            return;
        }
        expireOldEmails();
        List<OutboxRow> rows = claim();
        for (OutboxRow row : rows) {
            deliver(row);
        }
    }

    private void deliver(OutboxRow row) {
        TenantEmailConnectionService.ConnectionRow connection = null;
        try {
            connection = connections.connectedForSend(row.tenantId());
            JsonNode payload = mapper.readTree(row.payload());
            String refreshToken = connections.decryptRefreshToken(connection);
            String textBody = payload.hasNonNull("textBody")
                ? payload.path("textBody").asText() : payload.path("body").asText();
            String htmlBody = payload.hasNonNull("htmlBody")
                ? payload.path("htmlBody").asText() : null;
            String messageId = gmail.sendMessage(refreshToken, connections.tenantName(row.tenantId()),
                connection.gmailAddress(), payload.path("to").asText(),
                payload.path("title").asText(), textBody, htmlBody,
                connections.absoluteDeepLink(payload.path("deepLink").asText("")));
            jdbc.sql("""
                    UPDATE outbox_events
                    SET published_at=now(), attempts=attempts+1, last_error=NULL,
                        error_code=NULL, gmail_message_id=:messageId,
                        lease_owner=NULL, lease_until=NULL
                    WHERE id=:id
                    """)
                .param("id", row.id())
                .param("messageId", messageId)
                .update();
            connections.markSendSuccess(row.tenantId(), connection.id());
        } catch (ApiException ex) {
            if ("GMAIL_CONNECTION_REQUIRED".equals(ex.code()) || "GMAIL_REAUTH_REQUIRED".equals(ex.code())) {
                releaseWithoutAttempt(row.id(), ex.code(), ex.getMessage(), Duration.ofMinutes(5));
                return;
            }
            deadLetter(row.id(), ex.code(), ex.getMessage(), false);
        } catch (GmailSendException ex) {
            if (ex.reauthRequired()) {
                if (connection != null) {
                    connections.markReauthRequired(row.tenantId(), connection.id(), ex.code(), ex.getMessage());
                }
                releaseWithoutAttempt(row.id(), ex.code(), ex.getMessage(), Duration.ofMinutes(5));
            } else if (ex.retryable()) {
                retry(row, ex);
            } else {
                deadLetter(row.id(), ex.code(), ex.getMessage(), true);
            }
        } catch (Exception ex) {
            retry(row, new GmailSendException("GMAIL_SEND_FAILED", ex.getMessage(), true, false, null));
        }
    }

    private List<OutboxRow> claim() {
        UUID leaseOwner = UUID.randomUUID();
        return jdbc.sql("""
                WITH picked AS (
                    SELECT id
                    FROM outbox_events
                    WHERE event_type='EMAIL_NOTIFICATION'
                      AND published_at IS NULL
                      AND dead_lettered_at IS NULL
                      AND attempts < 10
                      AND (expires_at IS NULL OR expires_at > now())
                      AND next_attempt_at <= now()
                      AND (lease_until IS NULL OR lease_until < now())
                    ORDER BY occurred_at
                    LIMIT 25
                    FOR UPDATE SKIP LOCKED
                )
                UPDATE outbox_events o
                SET lease_owner=:leaseOwner, lease_until=now() + interval '2 minutes'
                FROM picked
                WHERE o.id=picked.id
                RETURNING o.id, o.tenant_id, o.payload::text AS payload, o.attempts
                """)
            .param("leaseOwner", leaseOwner)
            .query((rs, row) -> new OutboxRow(
                rs.getObject("id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("payload"),
                rs.getInt("attempts")))
            .list();
    }

    private void retry(OutboxRow row, GmailSendException ex) {
        int nextAttempts = row.attempts() + 1;
        if (nextAttempts >= 10) {
            deadLetter(row.id(), ex.code(), ex.getMessage(), true);
            return;
        }
        Duration delay = ex.retryAfter() == null ? backoff(row.attempts()) : ex.retryAfter();
        jdbc.sql("""
                UPDATE outbox_events
                SET attempts=attempts+1, last_error=:message, error_code=:code,
                    next_attempt_at=now() + (:delaySeconds * interval '1 second'),
                    lease_owner=NULL, lease_until=NULL
                WHERE id=:id
                """)
            .param("id", row.id())
            .param("message", safeMessage(ex.getMessage()))
            .param("code", ex.code())
            .param("delaySeconds", delay.toSeconds())
            .update();
    }

    private void releaseWithoutAttempt(UUID id, String code, String message, Duration delay) {
        jdbc.sql("""
                UPDATE outbox_events
                SET last_error=:message, error_code=:code,
                    next_attempt_at=now() + (:delaySeconds * interval '1 second'),
                    lease_owner=NULL, lease_until=NULL
                WHERE id=:id
                """)
            .param("id", id)
            .param("message", safeMessage(message))
            .param("code", code)
            .param("delaySeconds", delay.toSeconds())
            .update();
    }

    private void deadLetter(UUID id, String code, String message, boolean incrementAttempt) {
        jdbc.sql("""
                UPDATE outbox_events
                SET attempts=attempts + :attemptDelta, dead_lettered_at=now(),
                    last_error=:message, error_code=:code,
                    lease_owner=NULL, lease_until=NULL
                WHERE id=:id
                """)
            .param("id", id)
            .param("attemptDelta", incrementAttempt ? 1 : 0)
            .param("message", safeMessage(message))
            .param("code", code)
            .update();
    }

    private void expireOldEmails() {
        jdbc.sql("""
                UPDATE outbox_events
                SET dead_lettered_at=now(), error_code='GMAIL_EXPIRED',
                    last_error='Tenant email notification expired after 72 hours',
                    lease_owner=NULL, lease_until=NULL
                WHERE event_type='EMAIL_NOTIFICATION'
                  AND published_at IS NULL
                  AND dead_lettered_at IS NULL
                  AND expires_at IS NOT NULL
                  AND expires_at <= now()
                """).update();
    }

    private Duration backoff(int attempts) {
        long base = Math.min(3600, 15L * (1L << Math.min(attempts, 8)));
        long jitter = ThreadLocalRandom.current().nextLong(0, 10);
        return Duration.ofSeconds(base + jitter);
    }

    private String safeMessage(String message) {
        if (message == null || message.isBlank()) return "Gmail delivery failed.";
        return message.length() <= 500 ? message : message.substring(0, 500);
    }

    private record OutboxRow(UUID id, UUID tenantId, String payload, int attempts) {
    }
}
