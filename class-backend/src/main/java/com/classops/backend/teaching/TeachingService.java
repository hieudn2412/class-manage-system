package com.classops.backend.teaching;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.scheduling.SchedulingEngine;
import com.classops.backend.scheduling.SessionMutationService;
import com.classops.backend.scheduling.SchedulingDtos.SessionAction;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.teaching.TeachingDtos.AttendanceStatus;
import com.classops.backend.teaching.TeachingDtos.CheckInInput;
import com.classops.backend.teaching.TeachingDtos.CheckInRecord;
import com.classops.backend.teaching.TeachingDtos.CheckInState;
import com.classops.backend.teaching.TeachingDtos.LessonReport;
import com.classops.backend.teaching.TeachingDtos.LessonReportInput;
import com.classops.backend.teaching.TeachingDtos.PedagogicalRecordInput;
import com.classops.backend.teaching.TeachingDtos.RosterStudent;
import com.classops.backend.teaching.TeachingDtos.SessionTest;
import com.classops.backend.teaching.TeachingDtos.SessionTestInput;
import com.classops.backend.teaching.TeachingDtos.SessionTestUpdateInput;
import com.classops.backend.teaching.TeachingDtos.SessionOperationsDetail;
import com.classops.backend.teaching.TeachingDtos.SessionHomeworkBadge;
import com.classops.backend.teaching.TeachingDtos.StudentRecordInput;
import com.classops.backend.teaching.TeachingDtos.StudentTestResultInput;
import com.classops.backend.teaching.TeachingDtos.TeacherClassHeader;
import com.classops.backend.teaching.TeachingDtos.TeacherClassItem;
import com.classops.backend.teaching.TeachingDtos.TeacherClassSessions;
import com.classops.backend.teaching.TeachingDtos.TeacherDashboardData;
import com.classops.backend.teaching.TeachingDtos.TeacherDashboardMetrics;
import com.classops.backend.teaching.TeachingDtos.TeacherSessionSummary;
import com.classops.backend.teaching.TeachingDtos.TestResult;
import com.classops.backend.teaching.TeachingDtos.TodayTeachingSession;
import com.classops.backend.teaching.TeachingDtos.UnconfirmSessionInput;
import com.classops.backend.teaching.TeachingDtos.VerificationDecision;
import com.classops.backend.teaching.TeachingDtos.VerificationDecisionInput;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class TeachingService {
    private static final Set<String> HOMEWORK_CLASS_STATUSES = Set.of("SCHEDULED", "ACTIVE", "AWAITING_CLOSE");

    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final TeachingProperties properties;
    private final TeachingSupport support;
    private final SessionCompletionService completion;
    private final SessionMutationService sessionMutations;
    private final Clock clock;

    public TeachingService(JdbcClient jdbc, CurrentActor actor, TeachingProperties properties,
                           TeachingSupport support, SessionCompletionService completion,
                           SessionMutationService sessionMutations, Clock clock) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.properties = properties;
        this.support = support;
        this.completion = completion;
        this.sessionMutations = sessionMutations;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public TeacherDashboardData dashboard() {
        UUID tenantId = actor.tenantId();
        UUID teacherId = requireTeacherId();
        OffsetDateTime now = now();
        LocalDate today = now.atZoneSameInstant(properties.zoneId()).toLocalDate();
        OffsetDateTime dayStart = today.atStartOfDay(properties.zoneId()).toOffsetDateTime();
        OffsetDateTime dayEnd = today.plusDays(1).atStartOfDay(properties.zoneId()).toOffsetDateTime();
        List<TodayRow> rows = jdbc.sql("""
                SELECT s.id, s.class_id, c.code, c.name, s.ordinal, s.start_at, s.end_at,
                       s.mode, r.name AS room_name, s.status, s.is_substitution,
                       EXISTS(SELECT 1 FROM session_check_ins ci
                         WHERE ci.tenant_id=s.tenant_id AND ci.session_id=s.id) AS checked_in
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                WHERE s.tenant_id=:tenantId AND s.actual_teacher_id=:teacherId
                  AND s.start_at >= :dayStart AND s.start_at < :dayEnd
                ORDER BY s.start_at
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .param("dayStart", dayStart).param("dayEnd", dayEnd)
            .query((rs, row) -> new TodayRow(
                rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
                rs.getString("code"), rs.getString("name"), rs.getInt("ordinal"),
                rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getString("mode"), rs.getString("room_name"), rs.getString("status"),
                rs.getBoolean("is_substitution"), rs.getBoolean("checked_in")))
            .list();
        List<TodayTeachingSession> sessions = rows.stream()
            .map(row -> new TodayTeachingSession(
                row.id(), row.classId(), row.code(), row.name(), row.ordinal(),
                row.startAt(), row.endAt(), row.mode(), row.roomName(), row.status(),
                checkInState(row.status(), row.startAt(), row.endAt(), row.checkedIn(), now),
                row.startAt().minus(properties.checkInBeforeStart()), row.substitution()))
            .toList();
        long available = sessions.stream()
            .filter(session -> session.checkInState() == CheckInState.OPEN).count();
        SalaryMonth salary = jdbc.sql("""
                SELECT COALESCE(sum(sa.scheduled_minutes), 0) AS minutes,
                       COALESCE(sum(sa.amount), 0) AS amount
                FROM salary_accruals sa
                JOIN class_sessions s
                  ON s.tenant_id=sa.tenant_id AND s.id=sa.session_id
                WHERE sa.tenant_id=:tenantId AND sa.teacher_id=:teacherId
                  AND date_trunc('month', s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
                      = date_trunc('month', CAST(:today AS date))
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId).param("today", today)
            .query((rs, row) -> new SalaryMonth(
                rs.getLong("minutes"), rs.getBigDecimal("amount")))
            .single();
        long missing = jdbc.sql("""
                SELECT count(*) FROM class_sessions
                WHERE tenant_id=:tenantId AND actual_teacher_id=:teacherId
                  AND status='COMPLETED' AND missing_documentation=true
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .query(Long.class).single();
        String teacherName = jdbc.sql("""
                SELECT u.display_name
                FROM teacher_profiles t
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE t.tenant_id=:tenantId AND t.id=:teacherId
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .query(String.class).single();
        TeacherDashboardMetrics metrics = new TeacherDashboardMetrics(
            sessions.size(), available, missing,
            BigDecimal.valueOf(salary.minutes()).divide(BigDecimal.valueOf(60), 1,
                RoundingMode.HALF_UP),
            salary.amount());
        return new TeacherDashboardData(today, teacherName, metrics, sessions);
    }

    @Transactional(readOnly = true)
    public PageResponse<TeacherClassItem> classes(String search, String status, String role,
                                                   LocalDate from, LocalDate to,
                                                   int page, int pageSize) {
        validatePage(page, pageSize);
        String normalizedStatus = normalizeFilter(status,
            Set.of("", "DRAFT", "SCHEDULED", "ACTIVE", "AWAITING_CLOSE", "CLOSED", "CANCELLED"),
            "INVALID_CLASS_STATUS");
        String normalizedRole = normalizeFilter(role,
            Set.of("", "PRIMARY", "ACTUAL"), "INVALID_TEACHER_ROLE");
        UUID tenantId = actor.tenantId();
        UUID teacherId = requireTeacherId();
        String term = search == null ? "" : search.trim().toLowerCase();
        LocalDate start = from == null ? LocalDate.of(1900, 1, 1) : from;
        LocalDate end = to == null ? LocalDate.of(9999, 12, 31) : to;
        if (end.isBefore(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE",
                "Ngày kết thúc bộ lọc phải từ ngày bắt đầu.");
        }
        String scope = """
            c.tenant_id=:tenantId
            AND (
              EXISTS(SELECT 1 FROM class_teacher_assignments a
                WHERE a.tenant_id=c.tenant_id AND a.class_id=c.id
                  AND a.teacher_id=:teacherId)
              OR EXISTS(SELECT 1 FROM class_sessions os
                WHERE os.tenant_id=c.tenant_id AND os.class_id=c.id
                  AND os.actual_teacher_id=:teacherId)
            )
            AND (:status='' OR c.status=:status)
            AND (:term='' OR lower(c.name) LIKE :likeTerm OR lower(c.code) LIKE :likeTerm)
            AND (:role='' OR
              (:role='PRIMARY' AND EXISTS(SELECT 1 FROM class_teacher_assignments pa
                WHERE pa.tenant_id=c.tenant_id AND pa.class_id=c.id
                  AND pa.teacher_id=:teacherId))
              OR (:role='ACTUAL' AND EXISTS(SELECT 1 FROM class_sessions aa
                WHERE aa.tenant_id=c.tenant_id AND aa.class_id=c.id
                  AND aa.actual_teacher_id=:teacherId))
            )
            AND EXISTS(SELECT 1 FROM class_sessions fs
              WHERE fs.tenant_id=c.tenant_id AND fs.class_id=c.id
                AND (fs.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                    BETWEEN :fromDate AND :toDate)
            """;
        long total = classStatement("SELECT count(*) FROM classes c WHERE " + scope,
            tenantId, teacherId, normalizedStatus, term, normalizedRole, start, end)
            .query(Long.class).single();
        List<TeacherClassItem> items = classStatement("""
                SELECT c.id, c.code, c.name, c.status, c.start_date, c.expected_end_date,
                       c.total_sessions,
                       count(s.id) FILTER (WHERE s.status='COMPLETED') AS completed,
                       max(s.start_at) AS latest_session,
                       CASE WHEN EXISTS(
                         SELECT 1 FROM class_teacher_assignments ra
                         WHERE ra.tenant_id=c.tenant_id AND ra.class_id=c.id
                           AND ra.teacher_id=:teacherId
                       ) THEN 'PRIMARY' ELSE 'ACTUAL' END AS teacher_role
                FROM classes c
                LEFT JOIN class_sessions s
                  ON s.tenant_id=c.tenant_id AND s.class_id=c.id
                WHERE
                """ + scope + """
                GROUP BY c.id, c.code, c.name, c.status, c.start_date,
                         c.expected_end_date, c.total_sessions
                ORDER BY latest_session DESC NULLS LAST, c.name
                LIMIT :limit OFFSET :offset
                """, tenantId, teacherId, normalizedStatus, term, normalizedRole, start, end)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> new TeacherClassItem(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("status"), rs.getString("teacher_role"),
                rs.getObject("start_date", LocalDate.class),
                rs.getObject("expected_end_date", LocalDate.class),
                rs.getInt("completed"), rs.getInt("total_sessions"),
                rs.getObject("latest_session", OffsetDateTime.class)))
            .list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public TeacherClassSessions classSessions(UUID classId, String status, int page, int pageSize) {
        validatePage(page, pageSize);
        String normalizedStatus = normalizeFilter(status,
            Set.of("", "SCHEDULED", "IN_PROGRESS", "PENDING_CONFIRMATION", "COMPLETED",
                "CANCELLED"),
            "INVALID_SESSION_STATUS");
        UUID tenantId = actor.tenantId();
        UUID teacherId = requireTeacherId();
        TeacherClassHeader header = jdbc.sql("""
                SELECT c.id, c.code, c.name, c.status, c.total_sessions,
                       count(s.id) FILTER (WHERE s.status='COMPLETED') AS completed
                FROM classes c
                LEFT JOIN class_sessions s
                  ON s.tenant_id=c.tenant_id AND s.class_id=c.id
                WHERE c.tenant_id=:tenantId AND c.id=:classId
                  AND (
                    EXISTS(SELECT 1 FROM class_teacher_assignments a
                      WHERE a.tenant_id=c.tenant_id AND a.class_id=c.id
                        AND a.teacher_id=:teacherId)
                    OR EXISTS(SELECT 1 FROM class_sessions os
                      WHERE os.tenant_id=c.tenant_id AND os.class_id=c.id
                        AND os.actual_teacher_id=:teacherId)
                  )
                GROUP BY c.id, c.code, c.name, c.status, c.total_sessions
                """)
            .param("tenantId", tenantId).param("classId", classId).param("teacherId", teacherId)
            .query((rs, row) -> new TeacherClassHeader(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("status"), rs.getInt("completed"), rs.getInt("total_sessions")))
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.FORBIDDEN, "SESSION_NOT_IN_SCOPE",
                "Lớp không thuộc phạm vi giảng dạy của bạn."));
        String visible = """
            s.tenant_id=:tenantId AND s.class_id=:classId AND (
              s.actual_teacher_id=:teacherId
              OR EXISTS(SELECT 1 FROM class_teacher_assignments a
                WHERE a.tenant_id=s.tenant_id AND a.class_id=s.class_id
                  AND a.teacher_id=:teacherId
                  AND (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= a.effective_from
                  AND (a.effective_to IS NULL OR
                    (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date < a.effective_to))
            )
            AND (:sessionStatus='' OR s.status=:sessionStatus)
            """;
        long total = jdbc.sql("SELECT count(*) FROM class_sessions s WHERE " + visible)
            .param("tenantId", tenantId).param("classId", classId).param("teacherId", teacherId)
            .param("sessionStatus", normalizedStatus)
            .query(Long.class).single();
        List<TeacherSessionSummary> sessions = jdbc.sql("""
                SELECT s.id, s.ordinal, s.start_at, s.end_at, s.status,
                       s.planned_teacher_id, s.actual_teacher_id,
                       u.display_name AS teacher_name,
                       s.actual_teacher_id=:teacherId AS is_actual,
                       COALESCE(lr.lesson_name, '') AS lesson_name,
                       (SELECT count(*) FROM session_attendances at
                         WHERE at.tenant_id=s.tenant_id AND at.session_id=s.id
                           AND at.status IN ('PRESENT','LATE','LEFT_EARLY')) AS participated,
                       CASE WHEN s.roster_frozen_at IS NOT NULL THEN
                         (SELECT count(*) FROM session_roster_members rm
                          WHERE rm.tenant_id=s.tenant_id AND rm.session_id=s.id)
                       ELSE
                         (SELECT count(*) FROM class_enrollments e
                          WHERE e.tenant_id=s.tenant_id AND e.class_id=s.class_id
                            AND e.effective_from <=
                              (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                            AND (e.effective_to IS NULL OR e.effective_to >
                              (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
                       END AS roster_count,
                       s.missing_documentation,
                       hw.id AS homework_id,
                       hw.title AS homework_title,
                       hw.status AS homework_status,
                       hw.deadline_at AS homework_deadline_at,
                       COALESCE(hw_counts.recipient_count, 0) AS homework_recipient_count,
                       COALESCE(hw_counts.submitted_count, 0) AS homework_submitted_count,
                       EXISTS (SELECT 1 FROM session_tests test
                         WHERE test.tenant_id=s.tenant_id AND test.session_id=s.id) AS has_test,
                       (SELECT count(*) FROM session_test_results tr
                         WHERE tr.tenant_id=s.tenant_id AND tr.session_id=s.id
                           AND tr.score IS NOT NULL) AS tests
                FROM class_sessions s
                JOIN teacher_profiles t
                  ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN session_lesson_reports lr
                  ON lr.tenant_id=s.tenant_id AND lr.session_id=s.id
                LEFT JOIN homeworks hw
                  ON hw.tenant_id=s.tenant_id AND hw.session_id=s.id AND hw.is_session_primary
                LEFT JOIN LATERAL (
                  SELECT
                    count(DISTINCT r.student_id) FILTER (WHERE r.removed_at IS NULL)::int AS recipient_count,
                    count(DISTINCT sub.student_id) FILTER (WHERE sub.current_attempt)::int AS submitted_count
                  FROM homework_recipients r
                  LEFT JOIN homework_submissions sub
                    ON sub.tenant_id=r.tenant_id AND sub.homework_id=r.homework_id
                  WHERE r.tenant_id=hw.tenant_id AND r.homework_id=hw.id
                ) hw_counts ON true
                WHERE
                """ + visible + """
                ORDER BY s.start_at DESC
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("classId", classId).param("teacherId", teacherId)
            .param("sessionStatus", normalizedStatus)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> {
                boolean actual = rs.getBoolean("is_actual");
                UUID plannedTeacherId = rs.getObject("planned_teacher_id", UUID.class);
                UUID actualTeacherId = rs.getObject("actual_teacher_id", UUID.class);
                SessionHomeworkBadge homework = mapHomeworkBadge(rs, row);
                return new TeacherSessionSummary(
                    rs.getObject("id", UUID.class), rs.getInt("ordinal"),
                    rs.getObject("start_at", OffsetDateTime.class),
                    rs.getObject("end_at", OffsetDateTime.class),
                    rs.getString("status"), rs.getString("teacher_name"),
                    actual, !actual,
                    canCreateHomework(header.status(), rs.getString("status"),
                        plannedTeacherId, actualTeacherId, teacherId) && homework == null,
                    homework,
                    rs.getString("lesson_name"),
                    rs.getInt("participated"), rs.getInt("roster_count"),
                    rs.getBoolean("missing_documentation"), rs.getBoolean("has_test"),
                    rs.getInt("tests"));
            })
            .list();
        return new TeacherClassSessions(header, PageResponse.of(sessions, page, pageSize, total));
    }

    @Transactional(readOnly = true)
    public SessionOperationsDetail detail(UUID sessionId) {
        UUID tenantId = actor.tenantId();
        SessionRow session = session(tenantId, sessionId, false);
        UUID teacherId = teacherIdOrNull();
        boolean management = actor.hasPermission("MANAGE_SESSION_VERIFICATION");
        boolean scoped = management || teacherId != null && sessionInTeacherScope(session, teacherId);
        if (!scoped) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SESSION_NOT_IN_SCOPE",
                "Buổi học không thuộc phạm vi của bạn.");
        }
        return detail(session, teacherId, management);
    }

    @Transactional
    public SessionOperationsDetail checkIn(UUID sessionId, CheckInInput input,
                                           String idempotencyKey, String ipAddress,
                                           String deviceInfo) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "CHECK_IN:" + sessionId;
        String hash = support.requestHash(input);
        SessionOperationsDetail repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SessionOperationsDetail.class);
        if (repeated != null) {
            return repeated;
        }
        UUID teacherId = requireTeacherId();
        SessionRow session = session(tenantId, sessionId, true);
        requireActualTeacher(session, teacherId);
        requireVersion(session, input.version());
        OffsetDateTime now = now();
        if (now.isBefore(session.startAt().minus(properties.checkInBeforeStart()))) {
            throw new ApiException(HttpStatus.CONFLICT, "CHECK_IN_TOO_EARLY",
                "Check-in chỉ mở từ 30 phút trước giờ học.");
        }
        if (now.isAfter(session.endAt()) || "PENDING_CONFIRMATION".equals(session.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "CHECK_IN_WINDOW_CLOSED",
                "Đã hết cửa sổ check-in. Vui lòng liên hệ quản lý để xác nhận.");
        }
        if ("CANCELLED".equals(session.status()) || "COMPLETED".equals(session.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Buổi học không còn ở trạng thái có thể check-in.");
        }
        String onlineLink = normalizeUrl(input.onlineLink(), "ONLINE_LINK_INVALID");
        if ("ONLINE".equals(session.mode()) && onlineLink == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ONLINE_LINK_REQUIRED",
                "Buổi Online bắt buộc nhập link học tại bước check-in.");
        }
        if ("IN_PERSON".equals(session.mode()) && onlineLink != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ONLINE_LINK_NOT_ALLOWED",
                "Buổi tại lớp không sử dụng link Online.");
        }
        boolean exists = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM session_check_ins
                  WHERE tenant_id=:tenantId AND session_id=:sessionId)
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query(Boolean.class).single();
        if (!exists) {
            jdbc.sql("""
                    INSERT INTO session_check_ins (
                      id, tenant_id, session_id, teacher_id, checked_in_at,
                      ip_address, device_info, idempotency_key
                    ) VALUES (
                      :id, :tenantId, :sessionId, :teacherId, :checkedInAt,
                      :ip, :device, :key
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId)
                .param("sessionId", sessionId).param("teacherId", teacherId)
                .param("checkedInAt", now).param("ip", safe(ipAddress))
                .param("device", safe(deviceInfo)).param("key", idempotencyKey).update();
            jdbc.sql("""
                    UPDATE class_sessions
                    SET status='IN_PROGRESS', online_link=:onlineLink,
                        updated_at=:now, version=version+1
                    WHERE tenant_id=:tenantId AND id=:sessionId
                    """)
                .param("onlineLink", onlineLink).param("now", now)
                .param("tenantId", tenantId).param("sessionId", sessionId).update();
            jdbc.sql("""
                    UPDATE classes SET status='ACTIVE', updated_at=:now, version=version+1
                    WHERE tenant_id=:tenantId AND id=:classId AND status='SCHEDULED'
                    """)
                .param("now", now).param("tenantId", tenantId)
                .param("classId", session.classId()).update();
            support.audit(tenantId, actor.userId(), "USER", "SESSION_CHECKED_IN",
                "SESSION", sessionId, Map.of("status", session.status()),
                Map.of("status", "IN_PROGRESS", "checkedInAt", now,
                    "onlineLink", onlineLink == null ? "" : onlineLink));
            support.outbox(tenantId, sessionId, "SESSION_CHECKED_IN",
                Map.of("sessionId", sessionId, "classId", session.classId()));
        }
        SessionOperationsDetail response = detail(session(tenantId, sessionId, false),
            teacherId, false);
        support.remember(tenantId, operation, idempotencyKey, hash, 200, response);
        return response;
    }

    @Transactional
    public SessionOperationsDetail savePedagogicalRecord(UUID sessionId,
                                                          PedagogicalRecordInput input,
                                                          String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "SESSION_RECORD:" + sessionId;
        String hash = support.requestHash(input);
        SessionOperationsDetail repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SessionOperationsDetail.class);
        if (repeated != null) {
            return repeated;
        }
        UUID teacherId = requireTeacherId();
        SessionRow session = session(tenantId, sessionId, true);
        requireEditable(session, teacherId);
        List<RosterRow> roster = rosterRows(session);
        String revision = rosterRevision(session, roster);
        if (!revision.equals(input.rosterRevision())) {
            throw new ApiException(HttpStatus.CONFLICT, "ROSTER_CHANGED",
                "Danh sách học sinh đã thay đổi. Vui lòng tải lại trước khi lưu.");
        }
        Set<UUID> allowed = roster.stream().map(RosterRow::studentId)
            .collect(java.util.stream.Collectors.toSet());
        for (StudentRecordInput student : input.students()) {
            if (!allowed.contains(student.studentId())) {
                throw new ApiException(HttpStatus.CONFLICT, "ROSTER_CHANGED",
                    "Có học sinh không còn thuộc danh sách buổi.");
            }
        }
        saveLessonReport(session, input.lessonReport());
        for (StudentRecordInput student : input.students()) {
            saveAttendance(session, student);
            saveStudentComment(session, student);
        }
        completion.refreshDocumentationFlag(tenantId, sessionId);
        SessionOperationsDetail response = detail(session(tenantId, sessionId, false),
            teacherId, false);
        support.remember(tenantId, operation, idempotencyKey, hash, 200, response);
        return response;
    }

    @Transactional
    public SessionOperationsDetail createSessionTest(UUID sessionId, SessionTestInput input,
                                                     String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "CREATE_SESSION_TEST:" + sessionId;
        String hash = support.requestHash(input);
        SessionOperationsDetail repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SessionOperationsDetail.class);
        if (repeated != null) {
            return repeated;
        }
        UUID teacherId = requireTeacherId();
        SessionRow session = session(tenantId, sessionId, true);
        requireEditable(session, teacherId);
        if (sessionTest(session) != null) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_TEST_ALREADY_EXISTS",
                "Mỗi buổi học chỉ được có một bài kiểm tra.");
        }
        UUID testId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO session_tests (
                  id, tenant_id, session_id, test_name, max_score, test_date, comment_text
                ) VALUES (:id, :tenantId, :sessionId, :testName, :maxScore, :testDate, :comment)
                """)
            .param("id", testId).param("tenantId", tenantId).param("sessionId", sessionId)
            .param("testName", input.testName()).param("maxScore", input.maxScore())
            .param("testDate", input.testDate()).param("comment", input.comment()).update();
        for (RosterRow student : rosterRows(session)) {
            jdbc.sql("""
                    INSERT INTO session_test_results (
                      id, tenant_id, session_id, session_test_id, student_id,
                      test_name, score, max_score, test_date, comment_text
                    ) VALUES (
                      :id, :tenantId, :sessionId, :testId, :studentId,
                      :testName, NULL, :maxScore, :testDate, ''
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId)
                .param("sessionId", sessionId).param("testId", testId)
                .param("studentId", student.studentId()).param("testName", input.testName())
                .param("maxScore", input.maxScore()).param("testDate", input.testDate()).update();
        }
        SessionTest created = sessionTest(session);
        support.audit(tenantId, actor.userId(), "USER", "SESSION_TEST_CREATED",
            "SESSION_TEST", testId, null, created);
        SessionOperationsDetail response = detail(session(tenantId, sessionId, false),
            teacherId, false);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, response);
        return response;
    }

    @Transactional
    public SessionOperationsDetail updateSessionTest(UUID sessionId, UUID testId,
                                                     SessionTestUpdateInput input,
                                                     String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "UPDATE_SESSION_TEST:" + testId;
        String hash = support.requestHash(input);
        SessionOperationsDetail repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SessionOperationsDetail.class);
        if (repeated != null) {
            return repeated;
        }
        UUID teacherId = requireTeacherId();
        SessionRow session = session(tenantId, sessionId, true);
        requireEditable(session, teacherId);
        SessionTest old = sessionTest(session);
        if (old == null || !old.id().equals(testId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "SESSION_TEST_NOT_FOUND",
                "Không tìm thấy bài kiểm tra của buổi học.");
        }
        List<RosterRow> roster = rosterRows(session);
        if (!rosterRevision(session, roster).equals(input.rosterRevision())) {
            throw new ApiException(HttpStatus.CONFLICT, "ROSTER_CHANGED",
                "Danh sách học sinh đã thay đổi. Hãy tải lại trước khi lưu.");
        }
        Set<UUID> rosterIds = roster.stream().map(RosterRow::studentId).collect(
            java.util.stream.Collectors.toSet());
        Set<UUID> resultIds = input.results().stream()
            .map(StudentTestResultInput::studentId).collect(java.util.stream.Collectors.toSet());
        if (!rosterIds.equals(resultIds) || resultIds.size() != input.results().size()) {
            throw new ApiException(HttpStatus.CONFLICT, "ROSTER_CHANGED",
                "Dữ liệu điểm không khớp danh sách học sinh hiện tại.");
        }
        for (StudentTestResultInput result : input.results()) {
            if (result.score() != null && result.score().compareTo(input.maxScore()) > 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "SCORE_EXCEEDS_MAX",
                    "Điểm học sinh không được lớn hơn điểm tối đa.",
                    Map.of("studentId", result.studentId()));
            }
        }
        int updated = jdbc.sql("""
                UPDATE session_tests
                SET test_name=:testName, max_score=:maxScore, test_date=:testDate,
                    comment_text=:comment, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND session_id=:sessionId
                  AND id=:testId AND version=:version
                """)
            .param("testName", input.testName()).param("maxScore", input.maxScore())
            .param("testDate", input.testDate())
            .param("comment", input.comment()).param("tenantId", tenantId)
            .param("sessionId", sessionId).param("testId", testId)
            .param("version", input.version()).update();
        if (updated == 0) {
            throw optimisticConflict();
        }
        jdbc.sql("""
                UPDATE session_test_results
                SET test_name=:testName, max_score=:maxScore, test_date=:testDate,
                    updated_at=now()
                WHERE tenant_id=:tenantId
                  AND (session_test_id=:testId OR session_id=:sessionId)
                """)
            .param("testName", input.testName()).param("maxScore", input.maxScore())
            .param("testDate", input.testDate()).param("tenantId", tenantId)
            .param("testId", testId).param("sessionId", sessionId).update();
        for (RosterRow student : roster) {
            jdbc.sql("""
                    INSERT INTO session_test_results (
                      id, tenant_id, session_id, session_test_id, student_id,
                      test_name, score, max_score, test_date, comment_text
                    ) VALUES (
                      :id, :tenantId, :sessionId, :testId, :studentId,
                      :testName, NULL, :maxScore, :testDate, ''
                    )
                    ON CONFLICT (tenant_id, session_test_id, student_id) DO NOTHING
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId)
                .param("sessionId", sessionId).param("testId", testId)
                .param("studentId", student.studentId()).param("testName", input.testName())
                .param("maxScore", input.maxScore()).param("testDate", input.testDate()).update();
        }
        for (StudentTestResultInput result : input.results()) {
            int resultUpdated = jdbc.sql("""
                    UPDATE session_test_results
                    SET score=:score, comment_text=:comment, updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId
                      AND (session_test_id=:testId OR session_id=:sessionId)
                      AND student_id=:studentId AND version=:version
                    """)
                .param("score", result.score()).param("comment", result.comment())
                .param("tenantId", tenantId).param("testId", testId)
                .param("sessionId", sessionId).param("studentId", result.studentId())
                .param("version", result.version()).update();
            if (resultUpdated == 0) {
                throw optimisticConflict();
            }
        }
        SessionTest next = sessionTest(session);
        support.audit(tenantId, actor.userId(), "USER", "SESSION_TEST_UPDATED",
            "SESSION_TEST", testId, old, next);
        SessionOperationsDetail response = detail(session(tenantId, sessionId, false),
            teacherId, false);
        support.remember(tenantId, operation, idempotencyKey, hash, 200, response);
        return response;
    }

    @Transactional
    public SessionOperationsDetail verify(UUID sessionId, VerificationDecisionInput input,
                                          String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "VERIFY_SESSION:" + sessionId;
        String hash = support.requestHash(input);
        SessionOperationsDetail repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SessionOperationsDetail.class);
        if (repeated != null) {
            return repeated;
        }
        SessionRow session = session(tenantId, sessionId, true);
        requireVersion(session, input.version());
        OffsetDateTime now = now();
        if (input.decision() == VerificationDecision.CONFIRM_TAUGHT) {
            completion.managerConfirm(tenantId, sessionId, actor.userId(),
                "Quản trị viên xác nhận buổi đã dạy.", now);
        } else {
            if (input.reason().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "CANCELLATION_REASON_REQUIRED",
                    "Vui lòng nhập lý do hủy buổi.");
            }
            sessionMutations.cancelFromVerification(
                tenantId, sessionId, actor.userId(), input.reason(), now);
        }
        SessionOperationsDetail response = detail(
            session(tenantId, sessionId, false), teacherIdOrNull(), true);
        support.remember(tenantId, operation, idempotencyKey, hash, 200, response);
        return response;
    }

    @Transactional
    public SessionOperationsDetail unconfirm(UUID sessionId, UnconfirmSessionInput input,
                                            String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "UNCONFIRM_SESSION:" + sessionId;
        String hash = support.requestHash(input);
        SessionOperationsDetail repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SessionOperationsDetail.class);
        if (repeated != null) {
            return repeated;
        }
        SessionRow session = session(tenantId, sessionId, true);
        requireVersion(session, input.version());
        completion.unconfirmSession(tenantId, sessionId, actor.userId(), input.reason(), now());
        SessionOperationsDetail response = detail(
            session(tenantId, sessionId, false), teacherIdOrNull(), true);
        support.remember(tenantId, operation, idempotencyKey, hash, 200, response);
        return response;
    }

    private SessionOperationsDetail detail(SessionRow session, UUID teacherId,
                                           boolean management) {
        OffsetDateTime now = now();
        boolean actual = teacherId != null && teacherId.equals(session.actualTeacherId());
        boolean canManageSchedule = actor.hasPermission("MANAGE_SESSION_SCHEDULE");
        boolean canEdit = actual && !"CANCELLED".equals(session.status())
            && (!"SCHEDULED".equals(session.status()) || !now.isBefore(session.startAt()));
        boolean canVerify = management && "PENDING_CONFIRMATION".equals(session.status());
        List<RosterRow> roster = rosterRows(session);
        Map<UUID, AttendanceRow> attendance = attendanceRows(session);
        Map<UUID, CommentRow> comments = commentRows(session);
        SessionTest test = sessionTest(session);
        Map<UUID, TestResult> tests = testResults(session);
        List<RosterStudent> students = roster.stream().map(student -> {
            AttendanceRow a = attendance.get(student.studentId());
            CommentRow c = comments.get(student.studentId());
            return new RosterStudent(
                student.studentId(), student.code(), student.name(),
                a == null ? null : a.status(), a == null ? "" : a.note(),
                a == null ? 0 : a.version(), c == null ? "" : c.comment(),
                c == null ? 0 : c.version(),
                tests.get(student.studentId()));
        }).toList();
        int participated = (int) students.stream()
            .filter(student -> student.attendanceStatus() == AttendanceStatus.PRESENT
                || student.attendanceStatus() == AttendanceStatus.LATE
                || student.attendanceStatus() == AttendanceStatus.LEFT_EARLY)
            .count();
        LessonReport lesson = lessonReport(session);
        CheckInRecord checkIn = jdbc.sql("""
                SELECT ci.checked_in_at, s.online_link
                FROM session_check_ins ci
                JOIN class_sessions s
                  ON s.tenant_id=ci.tenant_id AND s.id=ci.session_id
                WHERE ci.tenant_id=:tenantId AND ci.session_id=:sessionId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .query((rs, row) -> new CheckInRecord(
                rs.getObject("checked_in_at", OffsetDateTime.class),
                rs.getString("online_link")))
            .optional().orElse(null);
        boolean checkedIn = checkIn != null;
        SessionHomeworkBadge homework = sessionHomework(session);
        return new SessionOperationsDetail(
            session.id(), session.classId(), session.classCode(), session.className(),
            session.ordinal(), session.startAt(), session.endAt(), session.mode(),
            session.roomId(), session.roomName(), session.onlineLink(), session.status(),
            session.plannedTeacherId(), session.actualTeacherId(), session.actualTeacherName(),
            session.substitution(), session.replacesSessionId() != null,
            session.makeupRootSessionId(), session.replacesSessionId(),
            session.replacementSessionId(), session.cancellationReason(),
            allowedActions(session, checkedIn, canManageSchedule),
            actual, canEdit, canCreateHomework(session, teacherId, management) && homework == null,
            homework, canVerify,
            checkInState(session.status(), session.startAt(), session.endAt(), checkedIn, now),
            session.startAt().minus(properties.checkInBeforeStart()), checkIn,
            session.rosterFrozenAt() != null, rosterRevision(session, roster),
            session.missingDocumentation(), session.version(), lesson, test, students,
            participated);
    }

    private void saveLessonReport(SessionRow session, LessonReportInput input) {
        String recordUrl = normalizeUrl(input.recordUrl(), "RECORD_URL_INVALID");
        LessonReport old = lessonReport(session);
        if (old.version() != input.version()) {
            throw optimisticConflict();
        }
        if (old.version() == 0 && old.lessonName().isEmpty()
            && old.lessonContent().isEmpty() && old.recordUrl() == null) {
            jdbc.sql("""
                    INSERT INTO session_lesson_reports (
                      id, tenant_id, session_id, lesson_name, lesson_content, record_url
                    ) VALUES (
                      :id, :tenantId, :sessionId, :lessonName, :lessonContent, :recordUrl
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", session.tenantId())
                .param("sessionId", session.id()).param("lessonName", input.lessonName())
                .param("lessonContent", input.lessonContent()).param("recordUrl", recordUrl).update();
        } else {
            int updated = jdbc.sql("""
                    UPDATE session_lesson_reports
                    SET lesson_name=:lessonName, lesson_content=:lessonContent,
                        record_url=:recordUrl, updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId AND session_id=:sessionId AND version=:version
                    """)
                .param("lessonName", input.lessonName())
                .param("lessonContent", input.lessonContent()).param("recordUrl", recordUrl)
                .param("tenantId", session.tenantId()).param("sessionId", session.id())
                .param("version", input.version()).update();
            if (updated == 0) {
                throw optimisticConflict();
            }
        }
        LessonReport next = lessonReport(session);
        support.audit(session.tenantId(), actor.userId(), "USER", "LESSON_REPORT_UPDATED",
            "SESSION", session.id(), old, next);
    }

    private void saveAttendance(SessionRow session, StudentRecordInput input) {
        if (input.attendanceStatus() == null) {
            return;
        }
        AttendanceRow old = attendanceRow(session, input.studentId());
        if (old == null) {
            if (input.attendanceVersion() != 0) {
                throw optimisticConflict();
            }
            jdbc.sql("""
                    INSERT INTO session_attendances (
                      id, tenant_id, session_id, student_id, status, note
                    ) VALUES (
                      :id, :tenantId, :sessionId, :studentId, :status, :note
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", session.tenantId())
                .param("sessionId", session.id()).param("studentId", input.studentId())
                .param("status", input.attendanceStatus().name())
                .param("note", input.attendanceNote()).update();
        } else {
            int updated = jdbc.sql("""
                    UPDATE session_attendances
                    SET status=:status, note=:note, updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId AND session_id=:sessionId
                      AND student_id=:studentId AND version=:version
                    """)
                .param("status", input.attendanceStatus().name())
                .param("note", input.attendanceNote()).param("tenantId", session.tenantId())
                .param("sessionId", session.id()).param("studentId", input.studentId())
                .param("version", input.attendanceVersion()).update();
            if (updated == 0) {
                throw optimisticConflict();
            }
        }
        support.audit(session.tenantId(), actor.userId(), "USER", "ATTENDANCE_UPDATED",
            "SESSION", session.id(), old, attendanceRow(session, input.studentId()));
    }

    private void saveStudentComment(SessionRow session, StudentRecordInput input) {
        CommentRow old = commentRow(session, input.studentId());
        if (old == null && input.sessionComment().isBlank()) {
            return;
        }
        if (old == null) {
            if (input.commentVersion() != 0) {
                throw optimisticConflict();
            }
            jdbc.sql("""
                    INSERT INTO session_student_comments (
                      id, tenant_id, session_id, student_id, comment_text
                    ) VALUES (
                      :id, :tenantId, :sessionId, :studentId, :comment
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", session.tenantId())
                .param("sessionId", session.id()).param("studentId", input.studentId())
                .param("comment", input.sessionComment()).update();
        } else {
            int updated = jdbc.sql("""
                    UPDATE session_student_comments
                    SET comment_text=:comment, updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId AND session_id=:sessionId
                      AND student_id=:studentId AND version=:version
                    """)
                .param("comment", input.sessionComment()).param("tenantId", session.tenantId())
                .param("sessionId", session.id()).param("studentId", input.studentId())
                .param("version", input.commentVersion()).update();
            if (updated == 0) {
                throw optimisticConflict();
            }
        }
        support.audit(session.tenantId(), actor.userId(), "USER", "STUDENT_COMMENT_UPDATED",
            "SESSION", session.id(), old, commentRow(session, input.studentId()));
    }

    private LessonReport lessonReport(SessionRow session) {
        return jdbc.sql("""
                SELECT lesson_name, lesson_content, record_url, version
                FROM session_lesson_reports
                WHERE tenant_id=:tenantId AND session_id=:sessionId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .query((rs, row) -> new LessonReport(
                rs.getString("lesson_name"), rs.getString("lesson_content"),
                rs.getString("record_url"), rs.getLong("version")))
            .optional().orElse(new LessonReport("", "", null, 0));
    }

    private List<RosterRow> rosterRows(SessionRow session) {
        if (session.rosterFrozenAt() != null) {
            return jdbc.sql("""
                    SELECT r.student_id, sp.code, u.display_name, r.enrollment_id,
                           r.frozen_at AS revision_at
                    FROM session_roster_members r
                    JOIN student_profiles sp
                      ON sp.tenant_id=r.tenant_id AND sp.id=r.student_id
                    JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                    WHERE r.tenant_id=:tenantId AND r.session_id=:sessionId
                    ORDER BY u.display_name
                    """)
                .param("tenantId", session.tenantId()).param("sessionId", session.id())
                .query((rs, row) -> new RosterRow(
                    rs.getObject("student_id", UUID.class), rs.getString("code"),
                    rs.getString("display_name"), rs.getObject("enrollment_id", UUID.class),
                    rs.getObject("revision_at", OffsetDateTime.class)))
                .list();
        }
        LocalDate sessionDate = session.startAt()
            .atZoneSameInstant(properties.zoneId()).toLocalDate();
        return jdbc.sql("""
                SELECT e.student_id, sp.code, u.display_name, e.id AS enrollment_id,
                       e.updated_at AS revision_at
                FROM class_enrollments e
                JOIN student_profiles sp
                  ON sp.tenant_id=e.tenant_id AND sp.id=e.student_id
                JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                WHERE e.tenant_id=:tenantId AND e.class_id=:classId
                  AND e.effective_from <= :sessionDate
                  AND (e.effective_to IS NULL OR e.effective_to > :sessionDate)
                ORDER BY u.display_name
                """)
            .param("tenantId", session.tenantId()).param("classId", session.classId())
            .param("sessionDate", sessionDate)
            .query((rs, row) -> new RosterRow(
                rs.getObject("student_id", UUID.class), rs.getString("code"),
                rs.getString("display_name"), rs.getObject("enrollment_id", UUID.class),
                rs.getObject("revision_at", OffsetDateTime.class)))
            .list();
    }

    private String rosterRevision(SessionRow session, List<RosterRow> roster) {
        String value = (session.rosterFrozenAt() == null ? "DYNAMIC" : "FROZEN")
            + "|" + roster.stream()
                .map(row -> row.studentId() + ":" + row.enrollmentId() + ":" + row.revisionAt())
                .sorted().reduce("", (left, right) -> left + "|" + right);
        return SchedulingEngine.sha256(value);
    }

    private Map<UUID, AttendanceRow> attendanceRows(SessionRow session) {
        Map<UUID, AttendanceRow> result = new HashMap<>();
        jdbc.sql("""
                SELECT student_id, status, note, version
                FROM session_attendances
                WHERE tenant_id=:tenantId AND session_id=:sessionId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .query((rs, row) -> new AttendanceRow(
                rs.getObject("student_id", UUID.class),
                AttendanceStatus.valueOf(rs.getString("status")),
                rs.getString("note"), rs.getLong("version")))
            .list().forEach(row -> result.put(row.studentId(), row));
        return result;
    }

    private AttendanceRow attendanceRow(SessionRow session, UUID studentId) {
        return jdbc.sql("""
                SELECT student_id, status, note, version
                FROM session_attendances
                WHERE tenant_id=:tenantId AND session_id=:sessionId AND student_id=:studentId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .param("studentId", studentId)
            .query((rs, row) -> new AttendanceRow(
                rs.getObject("student_id", UUID.class),
                AttendanceStatus.valueOf(rs.getString("status")),
                rs.getString("note"), rs.getLong("version")))
            .optional().orElse(null);
    }

    private Map<UUID, CommentRow> commentRows(SessionRow session) {
        Map<UUID, CommentRow> result = new HashMap<>();
        jdbc.sql("""
                SELECT student_id, comment_text, version
                FROM session_student_comments
                WHERE tenant_id=:tenantId AND session_id=:sessionId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .query((rs, row) -> new CommentRow(
                rs.getObject("student_id", UUID.class),
                rs.getString("comment_text"), rs.getLong("version")))
            .list().forEach(row -> result.put(row.studentId(), row));
        return result;
    }

    private CommentRow commentRow(SessionRow session, UUID studentId) {
        return jdbc.sql("""
                SELECT student_id, comment_text, version
                FROM session_student_comments
                WHERE tenant_id=:tenantId AND session_id=:sessionId AND student_id=:studentId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .param("studentId", studentId)
            .query((rs, row) -> new CommentRow(
                rs.getObject("student_id", UUID.class),
                rs.getString("comment_text"), rs.getLong("version")))
            .optional().orElse(null);
    }

    private SessionTest sessionTest(SessionRow session) {
        return jdbc.sql("""
                SELECT id, test_name, max_score, test_date, comment_text, version
                FROM session_tests
                WHERE tenant_id=:tenantId AND session_id=:sessionId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .query((rs, row) -> new SessionTest(
                rs.getObject("id", UUID.class), rs.getString("test_name"),
                rs.getBigDecimal("max_score"), rs.getObject("test_date", LocalDate.class),
                rs.getString("comment_text"), rs.getLong("version")))
            .optional().orElse(null);
    }

    private Map<UUID, TestResult> testResults(SessionRow session) {
        Map<UUID, TestResult> result = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT id, student_id, score, comment_text, version
                FROM session_test_results
                WHERE tenant_id=:tenantId AND session_id=:sessionId
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .query((rs, row) -> Map.entry(
                rs.getObject("student_id", UUID.class),
                new TestResult(
                    rs.getObject("id", UUID.class), rs.getBigDecimal("score"),
                    rs.getString("comment_text"), rs.getLong("version"))))
            .list().forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result;
    }

    private SessionRow session(UUID tenantId, UUID sessionId, boolean lock) {
        String suffix = lock ? " FOR UPDATE OF s" : "";
        return jdbc.sql("""
                SELECT s.id, s.tenant_id, s.class_id, c.code AS class_code,
                       c.name AS class_name, c.status AS class_status,
                       s.ordinal, s.start_at, s.end_at, s.mode, s.room_id,
                       r.name AS room_name, s.online_link, s.status,
                       s.planned_teacher_id,
                       s.actual_teacher_id, u.display_name AS actual_teacher_name,
                       s.is_substitution, s.makeup_root_session_id, s.replaces_session_id,
                       s.cancellation_reason,
                       (SELECT child.id FROM class_sessions child
                        WHERE child.tenant_id=s.tenant_id AND child.replaces_session_id=s.id
                        LIMIT 1) AS replacement_session_id,
                       s.roster_frozen_at, s.missing_documentation, s.version
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t
                  ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                WHERE s.tenant_id=:tenantId AND s.id=:sessionId
                """ + suffix)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new SessionRow(
                rs.getObject("id", UUID.class), rs.getObject("tenant_id", UUID.class),
                rs.getObject("class_id", UUID.class), rs.getString("class_code"),
                rs.getString("class_name"), rs.getString("class_status"), rs.getInt("ordinal"),
                rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getString("mode"), rs.getObject("room_id", UUID.class),
                rs.getString("room_name"), rs.getString("online_link"),
                rs.getString("status"), rs.getObject("planned_teacher_id", UUID.class),
                rs.getObject("actual_teacher_id", UUID.class), rs.getString("actual_teacher_name"),
                rs.getBoolean("is_substitution"),
                rs.getObject("makeup_root_session_id", UUID.class),
                rs.getObject("replaces_session_id", UUID.class),
                rs.getObject("replacement_session_id", UUID.class),
                rs.getString("cancellation_reason"),
                rs.getObject("roster_frozen_at", OffsetDateTime.class),
                rs.getBoolean("missing_documentation"), rs.getLong("version")))
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Không tìm thấy buổi học."));
    }

    private boolean sessionInTeacherScope(SessionRow session, UUID teacherId) {
        if (teacherId.equals(session.actualTeacherId()) || teacherId.equals(session.plannedTeacherId())) {
            return true;
        }
        LocalDate date = session.startAt().atZoneSameInstant(properties.zoneId()).toLocalDate();
        return jdbc.sql("""
                SELECT EXISTS(
                  SELECT 1 FROM class_teacher_assignments
                  WHERE tenant_id=:tenantId AND class_id=:classId AND teacher_id=:teacherId
                    AND effective_from <= :sessionDate
                    AND (effective_to IS NULL OR effective_to > :sessionDate)
                )
                """)
            .param("tenantId", session.tenantId()).param("classId", session.classId())
            .param("teacherId", teacherId).param("sessionDate", date)
            .query(Boolean.class).single();
    }

    private SessionHomeworkBadge sessionHomework(SessionRow session) {
        return jdbc.sql("""
                SELECT h.id AS homework_id, h.title AS homework_title,
                       h.status AS homework_status, h.deadline_at AS homework_deadline_at,
                       count(DISTINCT r.student_id) FILTER (WHERE r.removed_at IS NULL)::int AS homework_recipient_count,
                       count(DISTINCT sub.student_id) FILTER (WHERE sub.current_attempt)::int AS homework_submitted_count
                FROM homeworks h
                LEFT JOIN homework_recipients r
                  ON r.tenant_id=h.tenant_id AND r.homework_id=h.id
                LEFT JOIN homework_submissions sub
                  ON sub.tenant_id=h.tenant_id AND sub.homework_id=h.id
                WHERE h.tenant_id=:tenantId AND h.session_id=:sessionId AND h.is_session_primary
                GROUP BY h.id, h.title, h.status, h.deadline_at
                """)
            .param("tenantId", session.tenantId()).param("sessionId", session.id())
            .query(this::mapHomeworkBadge).optional().orElse(null);
    }

    private SessionHomeworkBadge mapHomeworkBadge(java.sql.ResultSet rs, int row)
        throws java.sql.SQLException {
        UUID homeworkId = rs.getObject("homework_id", UUID.class);
        if (homeworkId == null) return null;
        return new SessionHomeworkBadge(homeworkId, rs.getString("homework_title"),
            rs.getString("homework_status"),
            rs.getObject("homework_deadline_at", OffsetDateTime.class),
            rs.getInt("homework_submitted_count"), rs.getInt("homework_recipient_count"));
    }

    private boolean canCreateHomework(SessionRow session, UUID teacherId, boolean management) {
        if (!actor.hasPermission("MANAGE_HOMEWORK")) return false;
        if (!HOMEWORK_CLASS_STATUSES.contains(session.classStatus())
            || "CANCELLED".equals(session.status())) {
            return false;
        }
        if (actor.roles().contains("ADMIN") || actor.roles().contains("ACADEMIC_MANAGER") || management) {
            return true;
        }
        if (teacherId == null) return false;
        return canCreateHomework(session.classStatus(), session.status(),
            session.plannedTeacherId(), session.actualTeacherId(), teacherId);
    }

    private boolean canCreateHomework(String classStatus, String sessionStatus,
                                      UUID plannedTeacherId, UUID actualTeacherId,
                                      UUID teacherId) {
        if (!HOMEWORK_CLASS_STATUSES.contains(classStatus) || "CANCELLED".equals(sessionStatus)) {
            return false;
        }
        return "COMPLETED".equals(sessionStatus)
            ? teacherId.equals(actualTeacherId)
            : teacherId.equals(plannedTeacherId);
    }

    private List<SessionAction> allowedActions(SessionRow session, boolean checkedIn,
                                               boolean canManageSchedule) {
        if (!canManageSchedule) {
            return List.of();
        }
        if ("SCHEDULED".equals(session.status()) || "PENDING_CONFIRMATION".equals(session.status())) {
            if (!checkedIn) {
                return List.of(SessionAction.SUBSTITUTE_TEACHER, SessionAction.CANCEL_SESSION,
                    SessionAction.RESCHEDULE_SESSION);
            }
            return List.of(SessionAction.RESCHEDULE_SESSION);
        }
        if ("CANCELLED".equals(session.status()) && session.replacementSessionId() == null) {
            return List.of(SessionAction.CREATE_MAKEUP);
        }
        return List.of();
    }

    private void requireActualTeacher(SessionRow session, UUID teacherId) {
        if (!teacherId.equals(session.actualTeacherId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ACTUAL_TEACHER",
                "Chỉ giáo viên thực tế của buổi được thực hiện thao tác này.");
        }
    }

    private void requireEditable(SessionRow session, UUID teacherId) {
        requireActualTeacher(session, teacherId);
        if ("CANCELLED".equals(session.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Không thể sửa hồ sơ của buổi đã hủy.");
        }
        if ("SCHEDULED".equals(session.status()) && now().isBefore(session.startAt())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_NOT_STARTED",
                "Chỉ có thể nhập hồ sơ khi buổi học đã bắt đầu.");
        }
    }

    private void requireVersion(SessionRow session, long version) {
        if (session.version() != version) {
            throw optimisticConflict();
        }
    }

    private void validatePage(int page, int pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                "Trang phải từ 1 và kích thước trang từ 1 đến 100.");
        }
    }

    private String normalizeFilter(String value, Set<String> allowed, String code) {
        String normalized = value == null ? "" : value.trim().toUpperCase();
        if (!allowed.contains(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, code, "Bộ lọc không hợp lệ.");
        }
        return normalized;
    }

    private String normalizeUrl(String value, String code) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        try {
            URI uri = URI.create(normalized);
            if (!uri.isAbsolute()
                || !Set.of("http", "https").contains(uri.getScheme().toLowerCase())) {
                throw new IllegalArgumentException();
            }
            return normalized;
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, code,
                "URL phải là địa chỉ http/https hợp lệ.");
        }
    }

    private JdbcClient.StatementSpec classStatement(
        String sql, UUID tenantId, UUID teacherId, String status,
        String term, String role, LocalDate from, LocalDate to
    ) {
        return jdbc.sql(sql)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .param("status", status).param("term", term)
            .param("likeTerm", "%" + term + "%").param("role", role)
            .param("fromDate", from).param("toDate", to);
    }

    private UUID requireTeacherId() {
        UUID result = teacherIdOrNull();
        if (result == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TEACHER_PROFILE_REQUIRED",
                "Tài khoản chưa có hồ sơ giáo viên.");
        }
        return result;
    }

    private UUID teacherIdOrNull() {
        return jdbc.sql("""
                SELECT id FROM teacher_profiles
                WHERE tenant_id=:tenantId AND user_id=:userId
                """)
            .param("tenantId", actor.tenantId()).param("userId", actor.userId())
            .query(UUID.class).optional().orElse(null);
    }

    private CheckInState checkInState(String status, OffsetDateTime startAt,
                                      OffsetDateTime endAt, boolean checkedIn,
                                      OffsetDateTime now) {
        if ("COMPLETED".equals(status)) return CheckInState.COMPLETED;
        if ("CANCELLED".equals(status)) return CheckInState.CANCELLED;
        if (checkedIn || "IN_PROGRESS".equals(status)) return CheckInState.CHECKED_IN;
        if ("PENDING_CONFIRMATION".equals(status) || now.isAfter(endAt)) {
            return CheckInState.WINDOW_CLOSED;
        }
        if (now.isBefore(startAt.minus(properties.checkInBeforeStart()))) {
            return CheckInState.TOO_EARLY;
        }
        return CheckInState.OPEN;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "unknown" : value;
    }

    private ApiException optimisticConflict() {
        return new ApiException(HttpStatus.CONFLICT, "OPTIMISTIC_LOCK_CONFLICT",
            "Dữ liệu đã được thay đổi. Vui lòng tải lại trước khi lưu.");
    }

    private record TodayRow(
        UUID id, UUID classId, String code, String name, int ordinal,
        OffsetDateTime startAt, OffsetDateTime endAt, String mode, String roomName,
        String status, boolean substitution, boolean checkedIn
    ) {
    }

    private record SalaryMonth(long minutes, BigDecimal amount) {
    }

    private record SessionRow(
        UUID id, UUID tenantId, UUID classId, String classCode, String className,
        String classStatus,
        int ordinal, OffsetDateTime startAt, OffsetDateTime endAt, String mode,
        UUID roomId, String roomName, String onlineLink, String status, UUID plannedTeacherId,
        UUID actualTeacherId, String actualTeacherName, boolean substitution,
        UUID makeupRootSessionId, UUID replacesSessionId, UUID replacementSessionId,
        String cancellationReason, OffsetDateTime rosterFrozenAt,
        boolean missingDocumentation, long version
    ) {
    }

    private record RosterRow(
        UUID studentId, String code, String name, UUID enrollmentId, OffsetDateTime revisionAt
    ) {
    }

    private record AttendanceRow(
        UUID studentId, AttendanceStatus status, String note, long version
    ) {
    }

    private record CommentRow(UUID studentId, String comment, long version) {
    }
}
