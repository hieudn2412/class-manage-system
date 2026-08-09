package com.classops.backend.classlifecycle;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Component
public class ClassActivationScheduler {
    private static final Logger log = LoggerFactory.getLogger(ClassActivationScheduler.class);

    private final JdbcClient jdbc;
    private final Clock clock;
    private final ClassLifecycleAutomationService automation;

    public ClassActivationScheduler(JdbcClient jdbc, Clock clock,
                                    ClassLifecycleAutomationService automation) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.automation = automation;
    }

    @Scheduled(fixedDelayString = "${app.teaching.scheduler-delay-ms:30000}")
    public void scan() {
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        List<DueClass> due = jdbc.sql("""
                SELECT DISTINCT class_record.tenant_id, class_record.id
                FROM classes class_record
                JOIN class_sessions session ON session.tenant_id=class_record.tenant_id
                  AND session.class_id=class_record.id
                WHERE class_record.status='SCHEDULED'
                  AND session.status<>'CANCELLED' AND session.start_at<=:now
                ORDER BY class_record.id
                LIMIT 100
                """)
            .param("now", now)
            .query((rs, row) -> new DueClass(
                rs.getObject("tenant_id", UUID.class), rs.getObject("id", UUID.class)))
            .list();
        for (DueClass classRecord : due) {
            try {
                automation.activate(classRecord.tenantId(), classRecord.id(), now);
            } catch (RuntimeException ex) {
                log.error("Could not activate scheduled class tenant={} class={}",
                    classRecord.tenantId(), classRecord.id(), ex);
            }
        }
    }

    private record DueClass(UUID tenantId, UUID id) {
    }
}
