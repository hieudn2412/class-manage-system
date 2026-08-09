package com.classops.backend.classlifecycle;

import com.classops.backend.teaching.TeachingSupport;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class ClassLifecycleAutomationService {
    private final JdbcClient jdbc;
    private final TeachingSupport support;

    public ClassLifecycleAutomationService(JdbcClient jdbc, TeachingSupport support) {
        this.jdbc = jdbc;
        this.support = support;
    }

    @Transactional
    public boolean activate(UUID tenantId, UUID classId, OffsetDateTime now) {
        int updated = jdbc.sql("""
                UPDATE classes class_record
                SET status='ACTIVE', updated_at=now(), version=version+1
                WHERE class_record.tenant_id=:tenantId AND class_record.id=:classId
                  AND class_record.status='SCHEDULED'
                  AND EXISTS (
                    SELECT 1 FROM class_sessions session
                    WHERE session.tenant_id=class_record.tenant_id
                      AND session.class_id=class_record.id
                      AND session.status<>'CANCELLED' AND session.start_at<=:now
                  )
                """)
            .param("tenantId", tenantId).param("classId", classId).param("now", now)
            .update();
        if (updated == 0) return false;
        Map<String, Object> state = Map.of(
            "status", "ACTIVE", "source", "FIRST_SESSION_START", "activatedAt", now);
        support.audit(tenantId, null, "SYSTEM", "CLASS_ACTIVATED",
            "CLASS", classId, Map.of("status", "SCHEDULED"), state);
        support.outbox(tenantId, "CLASS", classId, "CLASS_ACTIVATED", state);
        return true;
    }
}
