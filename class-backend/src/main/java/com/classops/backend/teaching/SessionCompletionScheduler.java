package com.classops.backend.teaching;

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
public class SessionCompletionScheduler {
    private static final Logger log = LoggerFactory.getLogger(SessionCompletionScheduler.class);

    private final JdbcClient jdbc;
    private final Clock clock;
    private final SessionCompletionService completion;

    public SessionCompletionScheduler(JdbcClient jdbc, Clock clock,
                                      SessionCompletionService completion) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.completion = completion;
    }

    @Scheduled(fixedDelayString = "${app.teaching.scheduler-delay-ms:30000}")
    public void scan() {
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        List<DueSession> due = jdbc.sql("""
                SELECT tenant_id, id, status
                FROM class_sessions
                WHERE status IN ('SCHEDULED', 'IN_PROGRESS') AND end_at <= :now
                ORDER BY end_at
                LIMIT 100
                """)
            .param("now", now)
            .query((rs, row) -> new DueSession(
                rs.getObject("tenant_id", UUID.class),
                rs.getObject("id", UUID.class),
                rs.getString("status")))
            .list();
        for (DueSession session : due) {
            try {
                if ("IN_PROGRESS".equals(session.status())) {
                    completion.autoCompleteCheckedIn(session.tenantId(), session.id(), now);
                } else {
                    completion.moveMissingCheckInToVerification(
                        session.tenantId(), session.id(), now);
                }
            } catch (RuntimeException ex) {
                log.error("Could not process due teaching session tenant={} session={}",
                    session.tenantId(), session.id(), ex);
            }
        }
    }

    private record DueSession(UUID tenantId, UUID id, String status) {
    }
}
