package com.classops.backend.classlifecycle;

import com.classops.backend.classlifecycle.LifecycleDtos.AddEnrollmentsInput;
import com.classops.backend.classlifecycle.LifecycleDtos.AddEnrollmentsResult;
import com.classops.backend.classlifecycle.LifecycleDtos.ChangeClassStatusInput;
import com.classops.backend.classlifecycle.LifecycleDtos.ChangeClassStatusResult;
import com.classops.backend.classlifecycle.LifecycleDtos.EndEnrollmentInput;
import com.classops.backend.classlifecycle.LifecycleDtos.EndEnrollmentResult;
import com.classops.backend.classlifecycle.LifecycleDtos.EnrollmentCandidate;
import com.classops.backend.classlifecycle.LifecycleDtos.EnrollmentItem;
import com.classops.backend.classlifecycle.LifecycleDtos.StudentClassDetail;
import com.classops.backend.classlifecycle.LifecycleDtos.StudentClassItem;
import com.classops.backend.classlifecycle.LifecycleDtos.StudentSessionItem;
import com.classops.backend.classlifecycle.LifecycleDtos.StudentTestResult;
import com.classops.backend.classlifecycle.LifecycleDtos.StudentSummary;
import com.classops.backend.classlifecycle.LifecycleDtos.WarningItem;
import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.teaching.TeachingSupport;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ClassLifecycleService {
    static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> ENROLLMENT_STATES =
        Set.of("SCHEDULED", "ACTIVE", "AWAITING_CLOSE");
    private static final Set<String> ACCESSIBLE_CLASS_STATES =
        Set.of("SCHEDULED", "ACTIVE", "AWAITING_CLOSE");

    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final TeachingSupport support;
    private final Clock clock;

    public ClassLifecycleService(JdbcClient jdbc, CurrentActor actor,
                                 TeachingSupport support, Clock clock) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.support = support;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<EnrollmentItem> enrollments(UUID classId, String scope, String search,
                                                     int page, int pageSize) {
        page(page, pageSize);
        String normalizedScope = normalizeScope(scope);
        UUID tenantId = actor.tenantId();
        requireClass(tenantId, classId, false);
        String where = """
            e.tenant_id=:tenantId AND e.class_id=:classId
            AND (:activeScope=false OR e.status='ACTIVE')
            AND (:historyScope=false OR e.status<>'ACTIVE')
            AND (:search='' OR lower(u.display_name) LIKE :searchLike
                 OR lower(student.code) LIKE :searchLike)
            """;
        Map<String, Object> parameters = Map.of(
            "tenantId", tenantId,
            "classId", classId,
            "activeScope", "ACTIVE".equals(normalizedScope),
            "historyScope", "HISTORY".equals(normalizedScope),
            "search", safe(search).toLowerCase(Locale.ROOT),
            "searchLike", "%" + safe(search).toLowerCase(Locale.ROOT) + "%"
        );
        long total = bind(jdbc.sql("""
                SELECT count(*) FROM class_enrollments e
                JOIN student_profiles student ON student.tenant_id=e.tenant_id
                  AND student.id=e.student_id
                JOIN users u ON u.tenant_id=student.tenant_id AND u.id=student.user_id
                WHERE
                """ + where), parameters).query(Long.class).single();
        List<EnrollmentItem> items = bind(jdbc.sql("""
                SELECT e.id, e.status, e.effective_from, e.effective_to, e.end_reason,
                       e.version, student.id AS student_id, student.code AS student_code,
                       u.display_name AS student_name, student.parent_name, student.parent_phone,
                       charge.id AS charge_id, charge.amount, charge.status AS charge_status
                FROM class_enrollments e
                JOIN student_profiles student ON student.tenant_id=e.tenant_id
                  AND student.id=e.student_id
                JOIN users u ON u.tenant_id=student.tenant_id AND u.id=student.user_id
                LEFT JOIN tuition_charges charge ON charge.tenant_id=e.tenant_id
                  AND charge.enrollment_id=e.id
                WHERE
                """ + where + """
                ORDER BY e.effective_from DESC, e.created_at DESC, e.id
                LIMIT :limit OFFSET :offset
                """), withPaging(parameters, page, pageSize))
            .query((rs, row) -> enrollmentItem(rs))
            .list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public PageResponse<EnrollmentCandidate> candidates(UUID classId, String search,
                                                         int page, int pageSize) {
        page(page, pageSize);
        UUID tenantId = actor.tenantId();
        requireClass(tenantId, classId, false);
        String normalized = safe(search).toLowerCase(Locale.ROOT);
        String where = """
            student.tenant_id=:tenantId AND u.status='ACTIVE'
            AND NOT EXISTS (
              SELECT 1 FROM class_enrollments active_enrollment
              WHERE active_enrollment.tenant_id=student.tenant_id
                AND active_enrollment.class_id=:classId
                AND active_enrollment.student_id=student.id
                AND active_enrollment.status='ACTIVE'
            )
            AND (:search='' OR lower(u.display_name) LIKE :searchLike
                 OR lower(student.code) LIKE :searchLike)
            """;
        Map<String, Object> params = Map.of(
            "tenantId", tenantId, "classId", classId,
            "search", normalized, "searchLike", "%" + normalized + "%");
        long total = bind(jdbc.sql("""
                SELECT count(*) FROM student_profiles student
                JOIN users u ON u.tenant_id=student.tenant_id AND u.id=student.user_id
                WHERE
                """ + where), params).query(Long.class).single();
        List<EnrollmentCandidate> items = bind(jdbc.sql("""
                SELECT student.id, student.code, u.display_name,
                       student.parent_name, student.parent_phone
                FROM student_profiles student
                JOIN users u ON u.tenant_id=student.tenant_id AND u.id=student.user_id
                WHERE
                """ + where + """
                ORDER BY u.display_name, student.code
                LIMIT :limit OFFSET :offset
                """), withPaging(params, page, pageSize))
            .query((rs, row) -> new EnrollmentCandidate(
                rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getString("display_name"), rs.getString("parent_name"),
                rs.getString("parent_phone")))
            .list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional
    public AddEnrollmentsResult add(UUID classId, AddEnrollmentsInput input,
                                    String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "ADD_CLASS_ENROLLMENTS:" + classId;
        String requestHash = support.requestHash(input);
        AddEnrollmentsResult replay = support.repeated(
            tenantId, operation, idempotencyKey, requestHash, AddEnrollmentsResult.class);
        if (replay != null) return replay;

        ClassRow classRow = requireClass(tenantId, classId, true);
        replay = support.repeated(
            tenantId, operation, idempotencyKey, requestHash, AddEnrollmentsResult.class);
        if (replay != null) return replay;
        requireEnrollmentState(classRow.status());
        requireVersion(classRow.version(), input.classVersion(), "CLASS_VERSION_CONFLICT");
        Set<UUID> requested = new HashSet<>(input.studentIds());
        if (requested.size() != input.studentIds().size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ENROLLMENT_BATCH_INVALID",
                "Danh sách thêm có học sinh bị lặp.");
        }
        List<UUID> existingStudents = jdbc.sql("""
                SELECT student.id FROM student_profiles student
                JOIN users u ON u.tenant_id=student.tenant_id AND u.id=student.user_id
                WHERE student.tenant_id=:tenantId AND student.id IN (:studentIds)
                  AND u.status='ACTIVE'
                """)
            .param("tenantId", tenantId).param("studentIds", input.studentIds())
            .query(UUID.class).list();
        if (existingStudents.size() != requested.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ENROLLMENT_BATCH_INVALID",
                "Lô có học sinh không tồn tại, không hoạt động hoặc thuộc tenant khác.");
        }
        List<UUID> duplicates = jdbc.sql("""
                SELECT student_id FROM class_enrollments
                WHERE tenant_id=:tenantId AND class_id=:classId
                  AND student_id IN (:studentIds) AND status='ACTIVE'
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("studentIds", input.studentIds()).query(UUID.class).list();
        if (!duplicates.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "ACTIVE_ENROLLMENT_EXISTS",
                "Một hoặc nhiều học sinh đã có enrollment đang hoạt động.",
                Map.of("studentIds", duplicates));
        }

        List<WarningItem> warnings = enrollmentWarnings(tenantId, classRow, input.studentIds());
        enforceWarnings(warnings, input.acknowledgedWarningIds());
        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));
        List<UUID> createdIds = new ArrayList<>();
        for (UUID studentId : input.studentIds()) {
            UUID enrollmentId = UUID.randomUUID();
            jdbc.sql("""
                    INSERT INTO class_enrollments (
                      id, tenant_id, class_id, student_id, status, effective_from, created_by
                    ) VALUES (
                      :id, :tenantId, :classId, :studentId, 'ACTIVE', :effectiveFrom, :createdBy
                    )
                    """)
                .param("id", enrollmentId).param("tenantId", tenantId)
                .param("classId", classId).param("studentId", studentId)
                .param("effectiveFrom", today).param("createdBy", actor.userId()).update();
            UUID chargeId = UUID.randomUUID();
            jdbc.sql("""
                    INSERT INTO tuition_charges (
                      id, tenant_id, class_id, student_id, enrollment_id, amount, status
                    ) VALUES (
                      :id, :tenantId, :classId, :studentId, :enrollmentId, :amount, 'UNPAID'
                    )
                    """)
                .param("id", chargeId).param("tenantId", tenantId)
                .param("classId", classId).param("studentId", studentId)
                .param("enrollmentId", enrollmentId).param("amount", classRow.tuitionAmount())
                .update();
            Map<String, Object> created = Map.of(
                "classId", classId, "studentId", studentId, "status", "ACTIVE",
                "effectiveFrom", today, "tuitionChargeId", chargeId);
            support.audit(tenantId, actor.userId(), "USER", "ENROLLMENT_CREATED",
                "CLASS_ENROLLMENT", enrollmentId, null, created);
            support.outbox(tenantId, "CLASS_ENROLLMENT", enrollmentId,
                "ENROLLMENT_CREATED", created);
            createdIds.add(enrollmentId);
        }
        long newClassVersion = incrementClassVersion(tenantId, classId, actor.userId());
        List<EnrollmentItem> createdItems = createdIds.stream()
            .map(id -> enrollment(tenantId, classId, id))
            .toList();
        AddEnrollmentsResult result = new AddEnrollmentsResult(createdItems, newClassVersion);
        support.remember(tenantId, operation, idempotencyKey, requestHash, 201, result);
        return result;
    }

    @Transactional
    public EndEnrollmentResult end(UUID classId, UUID enrollmentId,
                                   EndEnrollmentInput input, String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "END_CLASS_ENROLLMENT:" + enrollmentId;
        String requestHash = support.requestHash(input);
        EndEnrollmentResult replay = support.repeated(
            tenantId, operation, idempotencyKey, requestHash, EndEnrollmentResult.class);
        if (replay != null) return replay;

        ClassRow classRow = requireClass(tenantId, classId, true);
        replay = support.repeated(
            tenantId, operation, idempotencyKey, requestHash, EndEnrollmentResult.class);
        if (replay != null) return replay;
        requireEnrollmentState(classRow.status());
        requireVersion(classRow.version(), input.classVersion(), "CLASS_VERSION_CONFLICT");
        EnrollmentLock enrollment = jdbc.sql("""
                SELECT id, student_id, status, effective_from, version
                FROM class_enrollments
                WHERE tenant_id=:tenantId AND class_id=:classId AND id=:enrollmentId
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("enrollmentId", enrollmentId)
            .query((rs, row) -> new EnrollmentLock(
                rs.getObject("id", UUID.class), rs.getObject("student_id", UUID.class),
                rs.getString("status"), rs.getObject("effective_from", LocalDate.class),
                rs.getLong("version")))
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "ENROLLMENT_NOT_FOUND", "Không tìm thấy enrollment."));
        if (!"ACTIVE".equals(enrollment.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "ENROLLMENT_NOT_ACTIVE",
                "Enrollment không còn hoạt động.");
        }
        requireVersion(enrollment.version(), input.enrollmentVersion(),
            "ENROLLMENT_VERSION_CONFLICT");
        String target = normalizeEndStatus(input.targetStatus());
        String reason = input.reason().trim();
        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));
        jdbc.sql("""
                UPDATE class_enrollments
                SET status=:status, effective_to=:effectiveTo, end_reason=:reason,
                    ended_by=:endedBy, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND class_id=:classId AND id=:enrollmentId
                  AND status='ACTIVE' AND version=:version
                """)
            .param("status", target).param("effectiveTo", today).param("reason", reason)
            .param("endedBy", actor.userId()).param("tenantId", tenantId)
            .param("classId", classId).param("enrollmentId", enrollmentId)
            .param("version", enrollment.version()).update();
        Map<String, Object> ended = Map.of(
            "classId", classId, "studentId", enrollment.studentId(), "status", target,
            "effectiveTo", today, "reason", reason);
        support.audit(tenantId, actor.userId(), "USER", "ENROLLMENT_ENDED",
            "CLASS_ENROLLMENT", enrollmentId,
            Map.of("status", "ACTIVE", "version", enrollment.version()), ended);
        support.outbox(tenantId, "CLASS_ENROLLMENT", enrollmentId,
            "ENROLLMENT_ENDED", ended);
        long newClassVersion = incrementClassVersion(tenantId, classId, actor.userId());
        EndEnrollmentResult result = new EndEnrollmentResult(
            enrollment(tenantId, classId, enrollmentId), newClassVersion);
        support.remember(tenantId, operation, idempotencyKey, requestHash, 200, result);
        return result;
    }

    @Transactional
    public ChangeClassStatusResult changeStatus(UUID classId, ChangeClassStatusInput input,
                                                 String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "CHANGE_CLASS_STATUS:" + classId;
        String requestHash = support.requestHash(input);
        ChangeClassStatusResult replay = support.repeated(
            tenantId, operation, idempotencyKey, requestHash, ChangeClassStatusResult.class);
        if (replay != null) return replay;

        ClassRow classRow = requireClass(tenantId, classId, true);
        replay = support.repeated(
            tenantId, operation, idempotencyKey, requestHash, ChangeClassStatusResult.class);
        if (replay != null) return replay;
        requireVersion(classRow.version(), input.version(), "CLASS_VERSION_CONFLICT");
        String target = normalizeClassStatus(input.targetStatus());
        String reason = safe(input.reason()).trim();
        List<WarningItem> warnings = List.of();
        int cancelledSessions = 0;
        String action;
        if ("CLOSED".equals(target)) {
            if (!"AWAITING_CLOSE".equals(classRow.status())) {
                throw stateConflict(classRow.status(), target);
            }
            warnings = closeWarnings(tenantId, classId);
            enforceWarnings(warnings, input.acknowledgedWarningIds());
            action = "CLASS_CLOSED";
        } else if ("AWAITING_CLOSE".equals(target)) {
            if (!"CLOSED".equals(classRow.status())) {
                throw stateConflict(classRow.status(), target);
            }
            if (!actor.roles().contains("ADMIN")) {
                throw new ApiException(HttpStatus.FORBIDDEN, "CLASS_REOPEN_ADMIN_ONLY",
                    "Chỉ Admin được mở lại lớp.");
            }
            requireReason(reason);
            action = "CLASS_REOPENED";
        } else {
            if (!Set.of("DRAFT", "SCHEDULED", "ACTIVE", "AWAITING_CLOSE")
                .contains(classRow.status())) {
                throw stateConflict(classRow.status(), target);
            }
            requireReason(reason);
            OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
            cancelledSessions = jdbc.sql("""
                    UPDATE class_sessions
                    SET status='CANCELLED', cancelled_at=now(), cancelled_by=:actorId,
                        cancellation_reason=:reason, updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId AND class_id=:classId
                      AND start_at>:now AND status NOT IN ('COMPLETED','CANCELLED')
                    """)
                .param("tenantId", tenantId).param("classId", classId).param("now", now)
                .param("actorId", actor.userId()).param("reason", reason)
                .update();
            action = "CLASS_CANCELLED";
        }
        long newVersion = jdbc.sql("""
                UPDATE classes
                SET status=:status, updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:classId AND version=:version
                RETURNING version
                """)
            .param("status", target).param("actorId", actor.userId())
            .param("tenantId", tenantId).param("classId", classId)
            .param("version", classRow.version()).query(Long.class).single();
        Map<String, Object> changed = new LinkedHashMap<>();
        changed.put("status", target);
        changed.put("reason", reason);
        changed.put("cancelledFutureSessions", cancelledSessions);
        support.audit(tenantId, actor.userId(), "USER", action, "CLASS", classId,
            Map.of("status", classRow.status(), "version", classRow.version()), changed);
        support.outbox(tenantId, "CLASS", classId, action, changed);
        ChangeClassStatusResult result = new ChangeClassStatusResult(
            classId, uiStatus(target), newVersion, cancelledSessions, warnings);
        support.remember(tenantId, operation, idempotencyKey, requestHash, 200, result);
        return result;
    }

    @Transactional(readOnly = true)
    public PageResponse<StudentClassItem> studentClasses(String access, int page, int pageSize) {
        page(page, pageSize);
        String normalizedAccess = normalizeAccess(access);
        UUID tenantId = actor.tenantId();
        UUID studentId = currentStudent(tenantId);
        String scoped = """
            WITH student_classes AS (
              SELECT c.id, c.code, c.name, c.status, c.expected_end_date, c.total_sessions,
                     u.display_name AS teacher_name,
                     COALESCE(max(e.effective_from) FILTER (WHERE e.status='ACTIVE'),
                       max(e.effective_from)) AS effective_from,
                     CASE WHEN bool_or(e.status='ACTIVE') THEN NULL
                       ELSE max(e.effective_to) END AS effective_to,
                     bool_or(e.status='ACTIVE') AND c.status IN
                       ('SCHEDULED','ACTIVE','AWAITING_CLOSE') AS accessible,
                     (SELECT count(*) FROM class_sessions completed
                       WHERE completed.tenant_id=c.tenant_id AND completed.class_id=c.id
                         AND completed.status='COMPLETED') AS completed_sessions,
                     COALESCE((SELECT string_agg(
                       'Thứ ' || (pattern.weekday + 1) || ' ' ||
                       to_char(pattern.start_time, 'HH24:MI'), ', ' ORDER BY pattern.sort_order)
                       FROM class_schedule_patterns pattern
                       WHERE pattern.tenant_id=c.tenant_id AND pattern.class_id=c.id), '')
                       AS schedule_summary
              FROM class_enrollments e
              JOIN classes c ON c.tenant_id=e.tenant_id AND c.id=e.class_id
              JOIN teacher_profiles teacher ON teacher.tenant_id=c.tenant_id
                AND teacher.id=c.primary_teacher_id
              JOIN users u ON u.tenant_id=teacher.tenant_id AND u.id=teacher.user_id
              WHERE e.tenant_id=:tenantId AND e.student_id=:studentId
              GROUP BY c.id, c.code, c.name, c.status, c.expected_end_date,
                       c.total_sessions, c.tenant_id, u.display_name
            )
            """;
        String filter = """
            (:access='ALL' OR (:access='ACCESSIBLE' AND accessible)
              OR (:access='LOCKED' AND NOT accessible))
            """;
        long total = jdbc.sql(scoped + "SELECT count(*) FROM student_classes WHERE " + filter)
            .param("tenantId", tenantId).param("studentId", studentId)
            .param("access", normalizedAccess).query(Long.class).single();
        List<StudentClassItem> items = jdbc.sql(scoped + """
                SELECT * FROM student_classes WHERE
                """ + filter + """
                ORDER BY accessible DESC, expected_end_date DESC NULLS LAST, name
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("studentId", studentId)
            .param("access", normalizedAccess).param("limit", pageSize)
            .param("offset", (page - 1) * pageSize)
            .query((rs, row) -> new StudentClassItem(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("teacher_name"), rs.getString("schedule_summary"),
                uiStatus(rs.getString("status")), rs.getBoolean("accessible")
                    ? "Accessible" : "Locked",
                rs.getObject("effective_from", LocalDate.class),
                rs.getObject("effective_to", LocalDate.class),
                rs.getInt("completed_sessions"), rs.getInt("total_sessions"),
                rs.getObject("expected_end_date", LocalDate.class)))
            .list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public StudentClassDetail studentClass(UUID classId) {
        UUID tenantId = actor.tenantId();
        UUID studentId = currentStudent(tenantId);
        requireStudentAccess(tenantId, studentId, classId);
        return jdbc.sql("""
                SELECT c.id, c.code, c.name, c.description, c.status, c.total_sessions,
                       c.expected_end_date, u.display_name AS teacher_name,
                       (SELECT count(*) FROM class_sessions completed
                         WHERE completed.tenant_id=c.tenant_id AND completed.class_id=c.id
                           AND completed.status='COMPLETED') AS completed_sessions,
                       COALESCE((SELECT string_agg(
                         'Thứ ' || (pattern.weekday + 1) || ' ' ||
                         to_char(pattern.start_time, 'HH24:MI'), ', ' ORDER BY pattern.sort_order)
                         FROM class_schedule_patterns pattern
                         WHERE pattern.tenant_id=c.tenant_id AND pattern.class_id=c.id), '')
                         AS schedule_summary
                FROM classes c
                JOIN teacher_profiles teacher ON teacher.tenant_id=c.tenant_id
                  AND teacher.id=c.primary_teacher_id
                JOIN users u ON u.tenant_id=teacher.tenant_id AND u.id=teacher.user_id
                WHERE c.tenant_id=:tenantId AND c.id=:classId
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, row) -> new StudentClassDetail(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("description"), rs.getString("teacher_name"),
                rs.getString("schedule_summary"), uiStatus(rs.getString("status")),
                rs.getInt("completed_sessions"), rs.getInt("total_sessions"),
                rs.getObject("expected_end_date", LocalDate.class)))
            .single();
    }

    @Transactional(readOnly = true)
    public PageResponse<StudentSessionItem> studentSessions(UUID classId, int page, int pageSize) {
        page(page, pageSize);
        UUID tenantId = actor.tenantId();
        UUID studentId = currentStudent(tenantId);
        requireStudentAccess(tenantId, studentId, classId);
        String visible = """
            s.tenant_id=:tenantId AND s.class_id=:classId AND (
              (s.roster_frozen_at IS NOT NULL AND EXISTS (
                SELECT 1 FROM session_roster_members member
                WHERE member.tenant_id=s.tenant_id AND member.session_id=s.id
                  AND member.student_id=:studentId
              )) OR (s.roster_frozen_at IS NULL AND EXISTS (
                SELECT 1 FROM class_enrollments enrollment
                WHERE enrollment.tenant_id=s.tenant_id
                  AND enrollment.class_id=s.class_id
                  AND enrollment.student_id=:studentId
                  AND enrollment.effective_from <=
                    (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                  AND (enrollment.effective_to IS NULL OR enrollment.effective_to >
                    (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
              ))
            )
            """;
        long total = jdbc.sql("SELECT count(*) FROM class_sessions s WHERE " + visible)
            .param("tenantId", tenantId).param("classId", classId)
            .param("studentId", studentId).query(Long.class).single();
        List<StudentSessionItem> sessions = jdbc.sql("""
                SELECT s.id, s.ordinal, s.start_at, s.end_at, s.status,
                       teacher_user.display_name AS teacher_name,
                       COALESCE(report.lesson_name, '') AS lesson_name,
                       COALESCE(report.lesson_content, '') AS lesson_content,
                       attendance.status AS attendance_status,
                       attendance.note AS attendance_note,
                       report.record_url,
                       comment.comment_text,
                       COALESCE(test_result.id, test.id) AS test_result_id,
                       COALESCE(test.test_name, test_result.test_name) AS test_name,
                       test_result.score,
                       COALESCE(test.max_score, test_result.max_score) AS max_score,
                       COALESCE(test.test_date, test_result.test_date) AS test_date,
                       test_result.comment_text AS test_result_comment,
                       COALESCE(test.comment_text, '') AS test_comment
                FROM class_sessions s
                JOIN teacher_profiles teacher ON teacher.tenant_id=s.tenant_id
                  AND teacher.id=s.actual_teacher_id
                JOIN users teacher_user ON teacher_user.tenant_id=teacher.tenant_id
                  AND teacher_user.id=teacher.user_id
                LEFT JOIN session_lesson_reports report ON report.tenant_id=s.tenant_id
                  AND report.session_id=s.id
                LEFT JOIN session_attendances attendance ON attendance.tenant_id=s.tenant_id
                  AND attendance.session_id=s.id AND attendance.student_id=:studentId
                LEFT JOIN session_student_comments comment ON comment.tenant_id=s.tenant_id
                  AND comment.session_id=s.id AND comment.student_id=:studentId
                LEFT JOIN session_tests test ON test.tenant_id=s.tenant_id
                  AND test.session_id=s.id
                LEFT JOIN session_test_results test_result
                  ON test_result.tenant_id=test.tenant_id
                  AND test_result.session_id=s.id
                  AND test_result.student_id=:studentId
                WHERE
                """ + visible + """
                ORDER BY s.ordinal
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("studentId", studentId).param("limit", pageSize)
            .param("offset", (page - 1) * pageSize)
            .query((rs, row) -> {
                UUID resultId = rs.getObject("test_result_id", UUID.class);
                String testName = rs.getString("test_name");
                StudentTestResult testResult = resultId == null || testName == null ? null
                    : new StudentTestResult(
                    resultId, testName, rs.getBigDecimal("score"),
                    rs.getBigDecimal("max_score"), rs.getObject("test_date", LocalDate.class),
                    rs.getString("test_result_comment"), rs.getString("test_comment"));
                return new StudentSessionItem(
                    rs.getObject("id", UUID.class), rs.getInt("ordinal"),
                    rs.getObject("start_at", OffsetDateTime.class),
                    rs.getObject("end_at", OffsetDateTime.class), rs.getString("status"),
                    rs.getString("teacher_name"), rs.getString("lesson_name"),
                    rs.getString("lesson_content"), rs.getString("attendance_status"),
                    rs.getString("attendance_note"), rs.getString("record_url"),
                    rs.getString("comment_text"), testResult);
            })
            .list();
        return PageResponse.of(sessions, page, pageSize, total);
    }

    List<WarningItem> closeWarnings(UUID tenantId, UUID classId) {
        MissingRecords missing = jdbc.sql("""
                SELECT
                  count(*) FILTER (WHERE NOT EXISTS (
                    SELECT 1 FROM session_attendances attendance
                    WHERE attendance.tenant_id=session.tenant_id
                      AND attendance.session_id=session.id
                  )) AS missing_attendance,
                  count(*) FILTER (WHERE report.record_url IS NULL
                    OR btrim(report.record_url)='') AS missing_record
                FROM class_sessions session
                LEFT JOIN session_lesson_reports report ON report.tenant_id=session.tenant_id
                  AND report.session_id=session.id
                WHERE session.tenant_id=:tenantId AND session.class_id=:classId
                  AND session.status IN ('COMPLETED','PENDING_CONFIRMATION')
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, row) -> new MissingRecords(
                rs.getInt("missing_attendance"), rs.getInt("missing_record")))
            .single();
        List<WarningItem> warnings = new ArrayList<>();
        if (missing.missingAttendance() > 0) {
            warnings.add(new WarningItem("CLOSE_MISSING_ATTENDANCE:" + classId,
                "MISSING_ATTENDANCE",
                missing.missingAttendance() + " buổi chưa có điểm danh.", List.of()));
        }
        if (missing.missingRecord() > 0) {
            warnings.add(new WarningItem("CLOSE_MISSING_RECORD:" + classId,
                "MISSING_RECORD", missing.missingRecord() + " buổi chưa có record.", List.of()));
        }
        return List.copyOf(warnings);
    }

    private List<WarningItem> enrollmentWarnings(UUID tenantId, ClassRow classRow,
                                                  List<UUID> studentIds) {
        List<WarningItem> warnings = new ArrayList<>();
        long active = jdbc.sql("""
                SELECT count(*) FROM class_enrollments
                WHERE tenant_id=:tenantId AND class_id=:classId AND status='ACTIVE'
                """)
            .param("tenantId", tenantId).param("classId", classRow.id())
            .query(Long.class).single();
        long projected = active + studentIds.size();
        if (classRow.capacity() != null && projected > classRow.capacity()) {
            warnings.add(new WarningItem("CLASS_CAPACITY:" + classRow.id(), "CLASS_CAPACITY",
                "Sĩ số sau khi thêm là " + projected + ", vượt giới hạn lớp "
                    + classRow.capacity() + ".", studentIds));
        }
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        RoomLimit roomLimit = jdbc.sql("""
                SELECT room.id, room.name, room.capacity
                FROM class_sessions session
                JOIN rooms room ON room.tenant_id=session.tenant_id AND room.id=session.room_id
                WHERE session.tenant_id=:tenantId AND session.class_id=:classId
                  AND session.status<>'CANCELLED' AND session.start_at>:now
                  AND session.mode='IN_PERSON'
                ORDER BY room.capacity, session.start_at
                LIMIT 1
                """)
            .param("tenantId", tenantId).param("classId", classRow.id()).param("now", now)
            .query((rs, row) -> new RoomLimit(
                rs.getObject("id", UUID.class), rs.getString("name"), rs.getInt("capacity")))
            .optional().orElse(null);
        if (roomLimit != null && projected > roomLimit.capacity()) {
            warnings.add(new WarningItem("ROOM_CAPACITY:" + roomLimit.id(), "ROOM_CAPACITY",
                "Sĩ số " + projected + " vượt sức chứa " + roomLimit.capacity()
                    + " của " + roomLimit.name() + ".", studentIds));
        }
        for (UUID studentId : studentIds) {
            List<UUID> conflicts = jdbc.sql("""
                    SELECT DISTINCT other_session.id
                    FROM class_sessions proposed
                    JOIN class_sessions other_session
                      ON other_session.tenant_id=proposed.tenant_id
                     AND other_session.class_id<>proposed.class_id
                     AND other_session.status<>'CANCELLED'
                     AND other_session.start_at<proposed.end_at
                     AND other_session.end_at>proposed.start_at
                    JOIN class_enrollments other_enrollment
                      ON other_enrollment.tenant_id=other_session.tenant_id
                     AND other_enrollment.class_id=other_session.class_id
                     AND other_enrollment.student_id=:studentId
                     AND other_enrollment.effective_from <=
                       (other_session.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                     AND (other_enrollment.effective_to IS NULL OR other_enrollment.effective_to >
                       (other_session.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                    WHERE proposed.tenant_id=:tenantId AND proposed.class_id=:classId
                      AND proposed.status<>'CANCELLED' AND proposed.end_at>:now
                    ORDER BY other_session.id
                    """)
                .param("studentId", studentId).param("tenantId", tenantId)
                .param("classId", classRow.id()).param("now", now)
                .query(UUID.class).list();
            for (UUID conflictId : conflicts) {
                warnings.add(new WarningItem(
                    "STUDENT_SCHEDULE:" + studentId + ":" + conflictId,
                    "STUDENT_SCHEDULE_CONFLICT",
                    "Học sinh có một buổi học khác bị trùng lịch.", List.of(studentId)));
            }
        }
        return List.copyOf(warnings);
    }

    private EnrollmentItem enrollment(UUID tenantId, UUID classId, UUID enrollmentId) {
        return jdbc.sql("""
                SELECT e.id, e.status, e.effective_from, e.effective_to, e.end_reason,
                       e.version, student.id AS student_id, student.code AS student_code,
                       u.display_name AS student_name, student.parent_name, student.parent_phone,
                       charge.id AS charge_id, charge.amount, charge.status AS charge_status
                FROM class_enrollments e
                JOIN student_profiles student ON student.tenant_id=e.tenant_id
                  AND student.id=e.student_id
                JOIN users u ON u.tenant_id=student.tenant_id AND u.id=student.user_id
                LEFT JOIN tuition_charges charge ON charge.tenant_id=e.tenant_id
                  AND charge.enrollment_id=e.id
                WHERE e.tenant_id=:tenantId AND e.class_id=:classId AND e.id=:enrollmentId
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("enrollmentId", enrollmentId)
            .query((rs, row) -> enrollmentItem(rs)).single();
    }

    private EnrollmentItem enrollmentItem(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new EnrollmentItem(
            rs.getObject("id", UUID.class),
            new StudentSummary(rs.getObject("student_id", UUID.class),
                rs.getString("student_code"), rs.getString("student_name"),
                rs.getString("parent_name"), rs.getString("parent_phone")),
            uiEnrollmentStatus(rs.getString("status")),
            rs.getObject("effective_from", LocalDate.class),
            rs.getObject("effective_to", LocalDate.class), rs.getString("end_reason"),
            rs.getObject("charge_id", UUID.class), rs.getBigDecimal("amount"),
            rs.getString("charge_status"), rs.getLong("version"));
    }

    private ClassRow requireClass(UUID tenantId, UUID classId, boolean lock) {
        String suffix = lock ? " FOR UPDATE" : "";
        return jdbc.sql("""
                SELECT id, status, version, capacity, tuition_amount
                FROM classes WHERE tenant_id=:tenantId AND id=:classId
                """ + suffix)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, row) -> new ClassRow(
                rs.getObject("id", UUID.class), rs.getString("status"), rs.getLong("version"),
                rs.getObject("capacity", Integer.class), rs.getBigDecimal("tuition_amount")))
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Không tìm thấy lớp."));
    }

    private UUID currentStudent(UUID tenantId) {
        return jdbc.sql("""
                SELECT id FROM student_profiles
                WHERE tenant_id=:tenantId AND user_id=:userId
                """)
            .param("tenantId", tenantId).param("userId", actor.userId())
            .query(UUID.class).optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "STUDENT_PROFILE_NOT_FOUND",
                "Không tìm thấy hồ sơ học sinh."));
    }

    private void requireStudentAccess(UUID tenantId, UUID studentId, UUID classId) {
        StudentAccess access = jdbc.sql("""
                SELECT count(*)>0 AS has_history,
                       bool_or(enrollment.status='ACTIVE') AND class_record.status IN
                         ('SCHEDULED','ACTIVE','AWAITING_CLOSE') AS accessible
                FROM classes class_record
                JOIN class_enrollments enrollment
                  ON enrollment.tenant_id=class_record.tenant_id
                 AND enrollment.class_id=class_record.id
                 AND enrollment.student_id=:studentId
                WHERE class_record.tenant_id=:tenantId AND class_record.id=:classId
                GROUP BY class_record.status
                """)
            .param("studentId", studentId).param("tenantId", tenantId).param("classId", classId)
            .query((rs, row) -> new StudentAccess(
                rs.getBoolean("has_history"), rs.getBoolean("accessible")))
            .optional().orElse(null);
        if (access == null || !access.hasHistory()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND",
                "Không tìm thấy lớp.");
        }
        if (!access.accessible()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "STUDENT_CLASS_ACCESS_REVOKED",
                "Quyền truy cập nội dung lớp đã bị thu hồi.");
        }
    }

    private long incrementClassVersion(UUID tenantId, UUID classId, UUID actorId) {
        return jdbc.sql("""
                UPDATE classes SET updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:classId
                RETURNING version
                """)
            .param("actorId", actorId).param("tenantId", tenantId).param("classId", classId)
            .query(Long.class).single();
    }

    private void enforceWarnings(List<WarningItem> warnings, List<String> acknowledgements) {
        Set<String> acknowledged = Set.copyOf(acknowledgements);
        List<WarningItem> missing = warnings.stream()
            .filter(warning -> !acknowledged.contains(warning.id())).toList();
        if (!missing.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "WARNINGS_NOT_ACKNOWLEDGED",
                "Cần xác nhận các cảnh báo trước khi tiếp tục.", Map.of("warnings", missing));
        }
    }

    private void requireEnrollmentState(String status) {
        if (!ENROLLMENT_STATES.contains(status)) {
            throw new ApiException(HttpStatus.CONFLICT, "CLASS_STATE_CONFLICT",
                "Chỉ được thay đổi enrollment khi lớp đã xếp lịch và chưa đóng/hủy.",
                Map.of("currentStatus", uiStatus(status)));
        }
    }

    private void requireVersion(long actual, long expected, String code) {
        if (actual != expected) {
            throw new ApiException(HttpStatus.CONFLICT, code,
                "Dữ liệu đã thay đổi. Hãy tải lại trước khi thao tác.",
                Map.of("expectedVersion", expected, "actualVersion", actual));
        }
    }

    private ApiException stateConflict(String current, String target) {
        return new ApiException(HttpStatus.CONFLICT, "CLASS_STATE_CONFLICT",
            "Không thể chuyển trạng thái lớp theo yêu cầu.",
            Map.of("currentStatus", uiStatus(current), "targetStatus", uiStatus(target)));
    }

    private String normalizeScope(String scope) {
        String value = safe(scope).trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ACTIVE", "HISTORY").contains(value)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ENROLLMENT_SCOPE",
                "scope phải là Active hoặc History.");
        }
        return value;
    }

    private String normalizeAccess(String access) {
        String value = safe(access).trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ALL", "ACCESSIBLE", "LOCKED").contains(value)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCESS_FILTER",
                "access phải là All, Accessible hoặc Locked.");
        }
        return value;
    }

    private String normalizeEndStatus(String status) {
        String value = safe(status).replace("_", "").trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "LEFT", "RỜILỚP" -> "LEFT";
            case "TRANSFERRED", "CHUYỂNLỚP" -> "TRANSFERRED";
            default -> throw new ApiException(HttpStatus.BAD_REQUEST,
                "INVALID_ENROLLMENT_STATUS", "Trạng thái phải là Left hoặc Transferred.");
        };
    }

    private String normalizeClassStatus(String status) {
        String value = safe(status).replace("_", "").trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "CLOSED" -> "CLOSED";
            case "AWAITINGCLOSE" -> "AWAITING_CLOSE";
            case "CANCELLED", "CANCELED" -> "CANCELLED";
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CLASS_STATUS",
                "targetStatus phải là Closed, AwaitingClose hoặc Cancelled.");
        };
    }

    private void requireReason(String reason) {
        if (reason.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "STATUS_REASON_REQUIRED",
                "Lý do là bắt buộc cho thao tác này.");
        }
    }

    private void page(int page, int pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                "page phải từ 1 và pageSize trong khoảng 1–100.");
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private static String uiStatus(String status) {
        return switch (status) {
            case "DRAFT" -> "Draft";
            case "SCHEDULED" -> "Scheduled";
            case "ACTIVE" -> "Active";
            case "AWAITING_CLOSE" -> "AwaitingClose";
            case "CLOSED" -> "Closed";
            case "CANCELLED" -> "Cancelled";
            default -> status;
        };
    }

    private static String uiEnrollmentStatus(String status) {
        return switch (status) {
            case "ACTIVE" -> "Active";
            case "LEFT" -> "Left";
            case "TRANSFERRED" -> "Transferred";
            default -> status;
        };
    }

    private Map<String, Object> withPaging(Map<String, Object> source, int page, int pageSize) {
        Map<String, Object> result = new LinkedHashMap<>(source);
        result.put("limit", pageSize);
        result.put("offset", (page - 1) * pageSize);
        return result;
    }

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec statement,
                                          Map<String, Object> parameters) {
        JdbcClient.StatementSpec current = statement;
        for (Map.Entry<String, Object> entry : parameters.entrySet()) {
            current = current.param(entry.getKey(), entry.getValue());
        }
        return current;
    }

    private record ClassRow(UUID id, String status, long version,
                            Integer capacity, BigDecimal tuitionAmount) {
    }

    private record EnrollmentLock(UUID id, UUID studentId, String status,
                                  LocalDate effectiveFrom, long version) {
    }

    private record RoomLimit(UUID id, String name, int capacity) {
    }

    private record MissingRecords(int missingAttendance, int missingRecord) {
    }

    private record StudentAccess(boolean hasHistory, boolean accessible) {
    }
}
