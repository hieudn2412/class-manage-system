package com.classops.backend.learningcontent;

import com.classops.backend.teaching.TeachingSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

@Service
public class ContentNotificationService {
    private final JdbcClient jdbc;
    private final TeachingSupport support;
    private final Duration emailRetention;

    public ContentNotificationService(JdbcClient jdbc, TeachingSupport support,
                                      @Value("${app.gmail.outbox-retention:PT72H}") Duration emailRetention) {
        this.jdbc = jdbc;
        this.support = support;
        this.emailRetention = emailRetention;
    }

    public void inApp(UUID tenantId, UUID userId, String eventType, String title, String body) {
        support.notifyUser(tenantId, userId, eventType, title, body);
    }

    public void inAppAndEmail(UUID tenantId, UUID userId, String eventType,
                              String title, String body, String deepLink, String eventKey) {
        support.notifyUser(tenantId, userId, eventType, title, body);
        String email = jdbc.sql("""
                SELECT email FROM users
                WHERE tenant_id=:tenantId AND id=:userId AND status='ACTIVE'
                """)
            .param("tenantId", tenantId).param("userId", userId)
            .query(String.class).optional().orElse(null);
        if (email == null || email.isBlank()) return;
        try {
            jdbc.sql("""
                    INSERT INTO outbox_events (
                      id, tenant_id, aggregate_type, aggregate_id, event_type,
                      event_key, payload, next_attempt_at, expires_at
                    ) VALUES (
                      :id, :tenantId, 'NOTIFICATION', :userId, 'EMAIL_NOTIFICATION',
                      :eventKey, CAST(:payload AS jsonb), now(), :expiresAt
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId)
                .param("userId", userId).param("eventKey", eventKey)
                .param("expiresAt", OffsetDateTime.now(ZoneOffset.UTC).plus(emailRetention))
                .param("payload", support.json(Map.of(
                    "to", email,
                    "title", title,
                    "body", body,
                    "deepLink", deepLink == null ? "" : deepLink)))
                .update();
        } catch (DuplicateKeyException ignored) {
        }
    }
}
