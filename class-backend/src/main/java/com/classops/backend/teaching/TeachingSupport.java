package com.classops.backend.teaching;

import com.classops.backend.common.ApiException;
import com.classops.backend.scheduling.SchedulingEngine;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
public class TeachingSupport {
    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public TeachingSupport(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void requireIdempotencyKey(String key) {
        if (key == null || key.isBlank() || key.length() > 150) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED",
                "Cần Idempotency-Key hợp lệ cho thao tác ghi này.");
        }
    }

    public String requestHash(Object request) {
        return SchedulingEngine.sha256(json(request));
    }

    public <T> T repeated(UUID tenantId, String operation, String key, String requestHash,
                          Class<T> responseType) {
        StoredResponse stored = jdbc.sql("""
                SELECT request_hash, response_json::text AS response_json
                FROM idempotency_records
                WHERE tenant_id=:tenantId AND operation=:operation AND idempotency_key=:key
                """)
            .param("tenantId", tenantId).param("operation", operation).param("key", key)
            .query((rs, row) -> new StoredResponse(
                rs.getString("request_hash"), rs.getString("response_json")))
            .optional().orElse(null);
        if (stored == null) {
            return null;
        }
        if (!stored.requestHash().equals(requestHash)) {
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
                "Idempotency-Key đã được dùng với dữ liệu khác.");
        }
        return read(stored.responseJson(), responseType);
    }

    public void remember(UUID tenantId, String operation, String key, String requestHash,
                         int status, Object response) {
        jdbc.sql("""
                INSERT INTO idempotency_records (
                  id, tenant_id, operation, idempotency_key, request_hash,
                  response_status, response_json
                ) VALUES (
                  :id, :tenantId, :operation, :key, :requestHash,
                  :status, CAST(:response AS jsonb)
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("operation", operation).param("key", key)
            .param("requestHash", requestHash).param("status", status)
            .param("response", json(response)).update();
    }

    public void audit(UUID tenantId, UUID actorId, String actorType, String action,
                      String entityType, UUID entityId, Object oldValue, Object newValue) {
        jdbc.sql("""
                INSERT INTO audit_events (
                  id, tenant_id, actor_user_id, actor_type, action, entity_type, entity_id,
                  old_value, new_value, trace_id
                ) VALUES (
                  :id, :tenantId, :actorId, :actorType, :action, :entityType, :entityId,
                  CAST(:oldValue AS jsonb), CAST(:newValue AS jsonb), :traceId
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("actorId", actorId).param("actorType", actorType)
            .param("action", action).param("entityType", entityType).param("entityId", entityId)
            .param("oldValue", oldValue == null ? "null" : json(oldValue))
            .param("newValue", newValue == null ? "null" : json(newValue))
            .param("traceId", MDC.get("traceId")).update();
    }

    public void notifyUser(UUID tenantId, UUID userId, String eventType,
                           String title, String body) {
        jdbc.sql("""
                INSERT INTO notifications (
                  id, tenant_id, recipient_user_id, event_type, title, body
                ) VALUES (
                  :id, :tenantId, :userId, :eventType, :title, :body
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("userId", userId).param("eventType", eventType)
            .param("title", title).param("body", body).update();
    }

    public void outbox(UUID tenantId, UUID aggregateId, String eventType, Object payload) {
        outbox(tenantId, "SESSION", aggregateId, eventType, payload);
    }

    public void outbox(UUID tenantId, String aggregateType, UUID aggregateId,
                       String eventType, Object payload) {
        jdbc.sql("""
                INSERT INTO outbox_events (
                  id, tenant_id, aggregate_type, aggregate_id, event_type, payload
                ) VALUES (
                  :id, :tenantId, :aggregateType, :aggregateId, :eventType,
                  CAST(:payload AS jsonb)
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("aggregateType", aggregateType)
            .param("aggregateId", aggregateId).param("eventType", eventType)
            .param("payload", json(payload)).update();
    }

    public String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private <T> T read(String value, Class<T> type) {
        try {
            return mapper.readValue(value, type);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private record StoredResponse(String requestHash, String responseJson) {
    }
}
