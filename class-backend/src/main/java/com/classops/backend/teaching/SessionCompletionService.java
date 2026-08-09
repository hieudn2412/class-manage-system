package com.classops.backend.teaching;

import com.classops.backend.common.ApiException;
import com.classops.backend.salary.SalaryAccrualService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;

@Service
public class SessionCompletionService {
    private static final Logger log = LoggerFactory.getLogger(SessionCompletionService.class);

    private final JdbcClient jdbc;
    private final TeachingProperties properties;
    private final TeachingSupport support;
    private final SalaryAccrualService salaryAccruals;

    public SessionCompletionService(JdbcClient jdbc, TeachingProperties properties,
                                    TeachingSupport support,
                                    SalaryAccrualService salaryAccruals) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.support = support;
        this.salaryAccruals = salaryAccruals;
    }

    @Transactional
    public void moveMissingCheckInToVerification(UUID tenantId, UUID sessionId,
                                                 OffsetDateTime now) {
        CompletionRow row = lock(tenantId, sessionId);
        if (!"SCHEDULED".equals(row.status()) || row.endAt().isAfter(now)) {
            return;
        }
        boolean checkedIn = jdbc.sql("""
                SELECT EXISTS(
                  SELECT 1 FROM session_check_ins
                  WHERE tenant_id=:tenantId AND session_id=:sessionId
                )
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query(Boolean.class).single();
        if (checkedIn) {
            completeLocked(row, "AUTO_CHECK_IN", null, now, "Scheduler hoàn tất buổi đã check-in.");
            return;
        }
        jdbc.sql("""
                UPDATE class_sessions
                SET status='PENDING_CONFIRMATION', updated_at=:now, version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId).param("now", now).update();
        support.audit(tenantId, null, "SYSTEM", "SESSION_AWAITING_VERIFICATION",
            "SESSION", sessionId, Map.of("status", row.status()),
            Map.of("status", "PENDING_CONFIRMATION"));
        support.notifyUser(tenantId, row.teacherUserId(), "SESSION_AWAITING_VERIFICATION",
            "Buổi dạy đang chờ xác nhận",
            "Buổi " + row.className() + " chưa có check-in và đã được chuyển cho quản lý xác minh.");
        support.outbox(tenantId, sessionId, "SESSION_AWAITING_VERIFICATION",
            Map.of("sessionId", sessionId, "classId", row.classId()));
    }

    @Transactional
    public void autoCompleteCheckedIn(UUID tenantId, UUID sessionId, OffsetDateTime now) {
        CompletionRow row = lock(tenantId, sessionId);
        if ("COMPLETED".equals(row.status())) {
            salaryAccruals.reconcile(tenantId, sessionId, null,
                "Đồng bộ lại lương cho buổi đã hoàn tất.");
            return;
        }
        if (!"IN_PROGRESS".equals(row.status()) || row.endAt().isAfter(now)) {
            return;
        }
        boolean checkedIn = jdbc.sql("""
                SELECT EXISTS(
                  SELECT 1 FROM session_check_ins
                  WHERE tenant_id=:tenantId AND session_id=:sessionId
                )
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query(Boolean.class).single();
        if (!checkedIn) {
            moveMissingCheckInToVerification(tenantId, sessionId, now);
            return;
        }
        completeLocked(row, "AUTO_CHECK_IN", null, now, "Scheduler hoàn tất buổi đã check-in.");
    }

    @Transactional
    public void managerConfirm(UUID tenantId, UUID sessionId, UUID actorId,
                               String reason, OffsetDateTime now) {
        CompletionRow row = lock(tenantId, sessionId);
        if ("COMPLETED".equals(row.status())) {
            salaryAccruals.reconcile(tenantId, sessionId, actorId,
                "Đồng bộ lại lương sau xác nhận quản lý.");
            return;
        }
        if (!"PENDING_CONFIRMATION".equals(row.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Chỉ buổi đang chờ xác nhận mới có thể xác nhận đã dạy.");
        }
        completeLocked(row, "MANAGER_CONFIRMED", actorId, now, reason);
    }

    @Transactional
    public void cancelPending(UUID tenantId, UUID sessionId, UUID actorId,
                              String reason, OffsetDateTime now) {
        CompletionRow row = lock(tenantId, sessionId);
        if ("CANCELLED".equals(row.status())) {
            return;
        }
        if (!"PENDING_CONFIRMATION".equals(row.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Chỉ buổi đang chờ xác nhận mới có thể hủy trong luồng này.");
        }
        jdbc.sql("""
                UPDATE class_sessions
                SET status='CANCELLED', cancelled_at=:now, cancelled_by=:actorId,
                    cancellation_reason=:reason, updated_at=:now, version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId
                """)
            .param("actorId", actorId).param("reason", reason)
            .param("tenantId", tenantId).param("sessionId", sessionId).param("now", now).update();
        support.audit(tenantId, actorId, "USER", "SESSION_CANCELLED_AFTER_VERIFICATION",
            "SESSION", sessionId, Map.of("status", row.status()),
            Map.of("status", "CANCELLED", "reason", reason));
        support.notifyUser(tenantId, row.teacherUserId(), "SESSION_CANCELLED",
            "Buổi dạy đã bị hủy",
            "Buổi " + row.className() + " đã được quản lý hủy sau khi xác minh.");
        support.outbox(tenantId, sessionId, "SESSION_CANCELLED",
            Map.of("sessionId", sessionId, "classId", row.classId(), "reason", reason));
    }

    @Transactional
    public boolean refreshDocumentationFlag(UUID tenantId, UUID sessionId) {
        CompletionRow row = lock(tenantId, sessionId);
        if (!"COMPLETED".equals(row.status())) {
            return false;
        }
        boolean missing = documentationMissing(tenantId, sessionId);
        if (missing != row.missingDocumentation()) {
            jdbc.sql("""
                    UPDATE class_sessions
                    SET missing_documentation=:missing, updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId AND id=:sessionId
                    """)
                .param("missing", missing).param("tenantId", tenantId)
                .param("sessionId", sessionId).update();
        }
        return missing;
    }

    private void completeLocked(CompletionRow row, String source, UUID actorId,
                                OffsetDateTime now, String reason) {
        freezeRoster(row, now);
        boolean missing = documentationMissing(row.tenantId(), row.id());
        jdbc.sql("""
                UPDATE class_sessions
                SET status='COMPLETED', completed_at=:now, completion_source=:source,
                    roster_frozen_at=:now, missing_documentation=:missing,
                    updated_at=:now, version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId
                """)
            .param("now", now).param("source", source).param("missing", missing)
            .param("tenantId", row.tenantId()).param("sessionId", row.id()).update();
        salaryAccruals.reconcile(row.tenantId(), row.id(), actorId, reason);
        updateClassProgress(row.tenantId(), row.classId());
        support.audit(row.tenantId(), actorId, actorId == null ? "SYSTEM" : "USER",
            "SESSION_COMPLETED", "SESSION", row.id(), Map.of("status", row.status()),
            Map.of("status", "COMPLETED", "source", source, "reason", reason,
                "missingDocumentation", missing));
        support.notifyUser(row.tenantId(), row.teacherUserId(), "SESSION_COMPLETED",
            "Buổi dạy đã hoàn tất",
            "Buổi " + row.className() + " đã hoàn tất và phát sinh lương.");
        support.outbox(row.tenantId(), row.id(), "SESSION_COMPLETED",
            Map.of("sessionId", row.id(), "classId", row.classId(), "source", source));
    }

    private void freezeRoster(CompletionRow row, OffsetDateTime now) {
        ZoneId zone = properties.zoneId();
        var sessionDate = row.startAt().atZoneSameInstant(zone).toLocalDate();
        jdbc.sql("""
                INSERT INTO session_roster_members (
                  id, tenant_id, session_id, student_id, enrollment_id, frozen_at
                )
                SELECT gen_random_uuid(), e.tenant_id, :sessionId, e.student_id, e.id, :now
                FROM class_enrollments e
                WHERE e.tenant_id=:tenantId AND e.class_id=:classId
                  AND e.effective_from <= :sessionDate
                  AND (e.effective_to IS NULL OR e.effective_to > :sessionDate)
                ON CONFLICT (tenant_id, session_id, student_id) DO NOTHING
                """)
            .param("sessionId", row.id()).param("now", now)
            .param("tenantId", row.tenantId()).param("classId", row.classId())
            .param("sessionDate", sessionDate).update();
    }

    private boolean documentationMissing(UUID tenantId, UUID sessionId) {
        DocumentationCount count = jdbc.sql("""
                SELECT
                  (SELECT count(*) FROM session_roster_members r
                   WHERE r.tenant_id=:tenantId AND r.session_id=:sessionId) AS roster_count,
                  (SELECT count(*) FROM session_attendances a
                   JOIN session_roster_members r
                     ON r.tenant_id=a.tenant_id AND r.session_id=a.session_id
                    AND r.student_id=a.student_id
                   WHERE a.tenant_id=:tenantId AND a.session_id=:sessionId) AS attendance_count,
                  EXISTS(
                    SELECT 1 FROM session_lesson_reports lr
                    WHERE lr.tenant_id=:tenantId AND lr.session_id=:sessionId
                      AND NULLIF(trim(lr.record_url), '') IS NOT NULL
                  ) AS has_record
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new DocumentationCount(
                rs.getLong("roster_count"), rs.getLong("attendance_count"),
                rs.getBoolean("has_record")))
            .single();
        return count.rosterCount() != count.attendanceCount() || !count.hasRecord();
    }

    private void updateClassProgress(UUID tenantId, UUID classId) {
        ClassProgress progress = jdbc.sql("""
                SELECT c.total_sessions,
                       count(s.id) FILTER (WHERE s.status='COMPLETED') AS completed
                FROM classes c
                LEFT JOIN class_sessions s
                  ON s.tenant_id=c.tenant_id AND s.class_id=c.id
                WHERE c.tenant_id=:tenantId AND c.id=:classId
                GROUP BY c.total_sessions
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, row) -> new ClassProgress(
                rs.getInt("total_sessions"), rs.getInt("completed")))
            .single();
        String nextStatus = progress.completed() >= progress.totalSessions()
            ? "AWAITING_CLOSE" : "ACTIVE";
        jdbc.sql("""
                UPDATE classes
                SET status=:status, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:classId
                  AND status IN ('SCHEDULED', 'ACTIVE')
                """)
            .param("status", nextStatus).param("tenantId", tenantId)
            .param("classId", classId).update();
    }

    private CompletionRow lock(UUID tenantId, UUID sessionId) {
        return jdbc.sql("""
                SELECT s.id, s.tenant_id, s.class_id, c.name AS class_name,
                       s.start_at, s.end_at, s.actual_teacher_id, t.user_id AS teacher_user_id,
                       s.status, s.missing_documentation
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t
                  ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                WHERE s.tenant_id=:tenantId AND s.id=:sessionId
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new CompletionRow(
                rs.getObject("id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getObject("class_id", UUID.class),
                rs.getString("class_name"),
                rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getObject("actual_teacher_id", UUID.class),
                rs.getObject("teacher_user_id", UUID.class),
                rs.getString("status"),
                rs.getBoolean("missing_documentation")))
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Không tìm thấy buổi học."));
    }

    private record CompletionRow(
        UUID id,
        UUID tenantId,
        UUID classId,
        String className,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        UUID actualTeacherId,
        UUID teacherUserId,
        String status,
        boolean missingDocumentation
    ) {
    }

    private record DocumentationCount(long rosterCount, long attendanceCount, boolean hasRecord) {
    }

    private record ClassProgress(int totalSessions, int completed) {
    }
}
