package com.classops.backend.scheduling;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.scheduling.SchedulingDtos.CalendarSession;
import com.classops.backend.scheduling.SchedulingDtos.ClassDraftInput;
import com.classops.backend.scheduling.SchedulingDtos.ClassDraftRecord;
import com.classops.backend.scheduling.SchedulingDtos.ClassListItem;
import com.classops.backend.scheduling.SchedulingDtos.DeliveryMode;
import com.classops.backend.scheduling.SchedulingDtos.ExistingSessionSummary;
import com.classops.backend.scheduling.SchedulingDtos.RoomOption;
import com.classops.backend.scheduling.SchedulingDtos.SessionOverride;
import com.classops.backend.scheduling.SchedulingDtos.SessionAction;
import com.classops.backend.scheduling.SchedulingDtos.StudentOption;
import com.classops.backend.scheduling.SchedulingDtos.TeacherOption;
import com.classops.backend.scheduling.SchedulingDtos.WeeklyPattern;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public class SchedulingStore {
    private final JdbcClient jdbc;
    private final ObjectMapper mapper;
    private final ScheduleStateResolver scheduleStateResolver;

    public SchedulingStore(JdbcClient jdbc, ObjectMapper mapper,
                           ScheduleStateResolver scheduleStateResolver) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.scheduleStateResolver = scheduleStateResolver;
    }

    List<TeacherOption> teachers(UUID tenantId) {
        return jdbc.sql("""
                SELECT t.id, u.display_name
                FROM teacher_profiles t
                JOIN users u ON u.tenant_id = t.tenant_id AND u.id = t.user_id
                WHERE t.tenant_id = :tenantId AND u.status = 'ACTIVE'
                ORDER BY u.display_name
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new TeacherOption(
                rs.getObject("id", UUID.class), rs.getString("display_name")))
            .list();
    }

    List<RoomOption> rooms(UUID tenantId) {
        return jdbc.sql("""
                SELECT id, code, name, capacity, status FROM rooms
                WHERE tenant_id = :tenantId ORDER BY status, code
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new RoomOption(
                rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getString("name"), rs.getInt("capacity"), rs.getString("status")))
            .list();
    }

    PageResponse<StudentOption> students(UUID tenantId, String search, int page, int pageSize) {
        String normalized = "%" + (search == null ? "" : search.trim().toLowerCase()) + "%";
        long count = jdbc.sql("""
                SELECT count(*) FROM student_profiles s
                JOIN users u ON u.tenant_id = s.tenant_id AND u.id = s.user_id
                WHERE s.tenant_id = :tenantId AND u.status = 'ACTIVE'
                  AND (lower(u.display_name) LIKE :search OR lower(s.code) LIKE :search)
                """)
            .param("tenantId", tenantId).param("search", normalized)
            .query(Long.class).single();
        List<StudentOption> items = jdbc.sql("""
                SELECT s.id, s.code, u.display_name
                FROM student_profiles s
                JOIN users u ON u.tenant_id = s.tenant_id AND u.id = s.user_id
                WHERE s.tenant_id = :tenantId AND u.status = 'ACTIVE'
                  AND (lower(u.display_name) LIKE :search OR lower(s.code) LIKE :search)
                ORDER BY u.display_name, s.code
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("search", normalized)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> new StudentOption(
                rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getString("display_name")))
            .list();
        return PageResponse.of(items, page, pageSize, count);
    }

    TeacherOption requireTeacher(UUID tenantId, UUID teacherId) {
        return jdbc.sql("""
                SELECT t.id, u.display_name
                FROM teacher_profiles t
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE t.tenant_id=:tenantId AND t.id=:teacherId AND u.status='ACTIVE'
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .query((rs, row) -> new TeacherOption(
                rs.getObject("id", UUID.class), rs.getString("display_name")))
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "TEACHER_NOT_FOUND",
                "Giáo viên không tồn tại hoặc không hoạt động trong trung tâm."));
    }

    Map<UUID, String> requireRooms(UUID tenantId, List<WeeklyPattern> patterns,
                                   List<SessionOverride> overrides) {
        Map<UUID, String> roomNames = new LinkedHashMap<>();
        for (RoomOption room : rooms(tenantId)) {
            roomNames.put(room.id(), room.name());
        }
        for (UUID roomId : patterns.stream().map(WeeklyPattern::roomId).filter(java.util.Objects::nonNull)
            .toList()) {
            if (!roomNames.containsKey(roomId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "ROOM_NOT_FOUND",
                    "Phòng không tồn tại trong trung tâm.");
            }
        }
        for (UUID roomId : overrides.stream().map(SessionOverride::roomId).filter(java.util.Objects::nonNull)
            .toList()) {
            if (!roomNames.containsKey(roomId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "ROOM_NOT_FOUND",
                    "Phòng không tồn tại trong trung tâm.");
            }
        }
        return roomNames;
    }

    void requireStudents(UUID tenantId, List<UUID> studentIds) {
        if (studentIds.size() != studentIds.stream().distinct().count()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_STUDENT",
                "Danh sách học sinh có phần tử trùng.");
        }
        for (UUID studentId : studentIds) {
            boolean exists = jdbc.sql("""
                    SELECT EXISTS (
                      SELECT 1 FROM student_profiles s
                      JOIN users u ON u.tenant_id=s.tenant_id AND u.id=s.user_id
                      WHERE s.tenant_id=:tenantId AND s.id=:studentId AND u.status='ACTIVE'
                    )
                    """)
                .param("tenantId", tenantId).param("studentId", studentId)
                .query(Boolean.class).single();
            if (!exists) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "STUDENT_NOT_FOUND",
                    "Học sinh không tồn tại hoặc không hoạt động trong trung tâm.",
                    Map.of("studentId", studentId));
            }
        }
    }

    List<SchedulingEngine.Holiday> holidays(UUID tenantId) {
        return jdbc.sql("""
                SELECT id, name, start_date, end_date FROM tenant_holidays
                WHERE tenant_id=:tenantId ORDER BY start_date
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new SchedulingEngine.Holiday(
                rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class)))
            .list();
    }

    List<SchedulingEngine.OccupiedSession> occupied(UUID tenantId, UUID excludedSessionId,
                                                    UUID excludedClassId) {
        List<OccupiedRow> rows = jdbc.sql("""
                SELECT s.id, s.class_id, s.actual_teacher_id, s.room_id, s.mode, s.start_at, s.end_at,
                       c.code, c.name, u.display_name AS teacher_name, r.name AS room_name
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                WHERE s.tenant_id=:tenantId AND s.status <> 'CANCELLED'
                  AND (CAST(:excludedSessionId AS uuid) IS NULL OR s.id <> :excludedSessionId)
                  AND (CAST(:excludedClassId AS uuid) IS NULL OR s.class_id <> :excludedClassId)
                """)
            .param("tenantId", tenantId)
            .param("excludedSessionId", excludedSessionId)
            .param("excludedClassId", excludedClassId)
            .query((rs, row) -> new OccupiedRow(
                rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
                rs.getObject("actual_teacher_id", UUID.class), rs.getObject("room_id", UUID.class),
                DeliveryMode.valueOf(rs.getString("mode")),
                rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getString("code"), rs.getString("name"), rs.getString("teacher_name"),
                rs.getString("room_name")))
            .list();
        List<SchedulingEngine.OccupiedSession> result = new ArrayList<>();
        for (OccupiedRow row : rows) {
            Map<UUID, String> studentMap = new LinkedHashMap<>();
            jdbc.sql("""
                    SELECT e.student_id, u.display_name
                    FROM class_enrollments e
                    JOIN student_profiles sp ON sp.tenant_id=e.tenant_id AND sp.id=e.student_id
                    JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                    WHERE e.tenant_id=:tenantId AND e.class_id=:classId AND e.status='ACTIVE'
                    """)
                .param("tenantId", tenantId).param("classId", row.classId())
                .query((rs, number) -> Map.entry(
                    rs.getObject("student_id", UUID.class), rs.getString("display_name")))
                .list().forEach(entry -> studentMap.put(entry.getKey(), entry.getValue()));
            ExistingSessionSummary summary = new ExistingSessionSummary(
                row.id(), row.classCode(), row.className(), row.startAt(), row.endAt(),
                row.teacherName(), row.roomName());
            result.add(new SchedulingEngine.OccupiedSession(
                row.teacherId(), row.roomId(), row.mode(), row.startAt(), row.endAt(),
                summary, Map.copyOf(studentMap)));
        }
        return List.copyOf(result);
    }

    UUID insertDraft(UUID tenantId, UUID actorId, ClassDraftInput input) {
        UUID id = UUID.randomUUID();
        String code = "CLS-" + input.startDate().getYear() + "-"
            + id.toString().substring(0, 6).toUpperCase();
        jdbc.sql("""
                INSERT INTO classes (
                  id, tenant_id, code, name, description, primary_teacher_id, start_date,
                  total_sessions, tuition_amount, capacity, default_mode, status,
                  draft_student_ids, draft_overrides, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, :code, :name, :description, :teacherId, :startDate,
                  :totalSessions, :tuitionAmount, :capacity, :defaultMode, 'DRAFT',
                  CAST(:studentIds AS jsonb), CAST(:overrides AS jsonb), :actorId, :actorId
                )
                """)
            .param("id", id).param("tenantId", tenantId).param("code", code)
            .param("name", input.name().trim()).param("description", input.description())
            .param("teacherId", input.primaryTeacherId()).param("startDate", input.startDate())
            .param("totalSessions", input.totalSessions()).param("tuitionAmount", input.tuitionAmount())
            .param("capacity", input.capacity()).param("defaultMode", input.defaultMode().name())
            .param("studentIds", json(input.studentIds())).param("overrides", json(input.overrides()))
            .param("actorId", actorId).update();
        replaceDraftChildren(tenantId, id, actorId, input);
        return id;
    }

    void updateDraft(UUID tenantId, UUID classId, UUID actorId, ClassDraftInput input) {
        int updated = jdbc.sql("""
                UPDATE classes SET name=:name, description=:description,
                  primary_teacher_id=:teacherId, start_date=:startDate,
                  total_sessions=:totalSessions, tuition_amount=:tuitionAmount,
                  capacity=:capacity, default_mode=:defaultMode,
                  draft_student_ids=CAST(:studentIds AS jsonb),
                  draft_overrides=CAST(:overrides AS jsonb),
                  updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:classId AND status='DRAFT'
                """)
            .param("name", input.name().trim()).param("description", input.description())
            .param("teacherId", input.primaryTeacherId()).param("startDate", input.startDate())
            .param("totalSessions", input.totalSessions()).param("tuitionAmount", input.tuitionAmount())
            .param("capacity", input.capacity()).param("defaultMode", input.defaultMode().name())
            .param("studentIds", json(input.studentIds())).param("overrides", json(input.overrides()))
            .param("actorId", actorId).param("tenantId", tenantId).param("classId", classId)
            .update();
        if (updated == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "CLASS_NOT_EDITABLE",
                "Chỉ lớp Nháp mới có thể chỉnh sửa.");
        }
        replaceDraftChildren(tenantId, classId, actorId, input);
    }

    private void replaceDraftChildren(UUID tenantId, UUID classId, UUID actorId,
                                      ClassDraftInput input) {
        jdbc.sql("DELETE FROM class_schedule_patterns WHERE tenant_id=:tenantId AND class_id=:classId")
            .param("tenantId", tenantId).param("classId", classId).update();
        int sort = 0;
        for (WeeklyPattern pattern : input.patterns()) {
            jdbc.sql("""
                    INSERT INTO class_schedule_patterns (
                      id, tenant_id, class_id, client_key, weekday, start_time, end_time,
                      mode, room_id, sort_order
                    ) VALUES (
                      :id, :tenantId, :classId, :clientKey, :weekday, :startTime, :endTime,
                      :mode, :roomId, :sortOrder
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("classId", classId)
                .param("clientKey", pattern.id()).param("weekday", pattern.weekday())
                .param("startTime", pattern.startTime()).param("endTime", pattern.endTime())
                .param("mode", pattern.mode().name()).param("roomId", pattern.roomId())
                .param("sortOrder", sort++).update();
        }
        jdbc.sql("DELETE FROM class_hourly_rates WHERE tenant_id=:tenantId AND class_id=:classId")
            .param("tenantId", tenantId).param("classId", classId).update();
        jdbc.sql("""
                INSERT INTO class_hourly_rates (
                  id, tenant_id, class_id, effective_date, hourly_rate, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, :classId, :effectiveDate, :hourlyRate, :actorId, :actorId
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("classId", classId)
            .param("effectiveDate", input.startDate()).param("hourlyRate", input.hourlyRate())
            .param("actorId", actorId).update();
    }

    ClassDraftRecord draft(UUID tenantId, UUID classId, boolean lock) {
        String suffix = lock ? " FOR UPDATE" : "";
        DraftRow row = jdbc.sql("""
                SELECT c.id, c.code, c.status, c.name, c.description, c.primary_teacher_id,
                       c.start_date, c.total_sessions, c.tuition_amount, c.capacity,
                       c.default_mode, c.draft_student_ids::text AS student_ids,
                       c.draft_overrides::text AS overrides, c.version,
                       (SELECT hourly_rate FROM class_hourly_rates r
                        WHERE r.tenant_id=c.tenant_id AND r.class_id=c.id
                        ORDER BY effective_date DESC LIMIT 1) AS hourly_rate
                FROM classes c
                WHERE c.tenant_id=:tenantId AND c.id=:classId
                """ + suffix)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, number) -> new DraftRow(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("status"),
                rs.getString("name"), rs.getString("description"),
                rs.getObject("primary_teacher_id", UUID.class),
                rs.getObject("start_date", LocalDate.class), rs.getInt("total_sessions"),
                rs.getBigDecimal("tuition_amount"), rs.getBigDecimal("hourly_rate"),
                (Integer) rs.getObject("capacity"), DeliveryMode.valueOf(rs.getString("default_mode")),
                rs.getString("student_ids"), rs.getString("overrides"), rs.getLong("version")))
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND",
                "Không tìm thấy lớp."));
        List<WeeklyPattern> patterns = jdbc.sql("""
                SELECT client_key, weekday, start_time, end_time, mode, room_id
                FROM class_schedule_patterns
                WHERE tenant_id=:tenantId AND class_id=:classId ORDER BY sort_order, client_key
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, number) -> new WeeklyPattern(
                rs.getString("client_key"), rs.getInt("weekday"),
                rs.getObject("start_time", LocalTime.class), rs.getObject("end_time", LocalTime.class),
                DeliveryMode.valueOf(rs.getString("mode")), rs.getObject("room_id", UUID.class)))
            .list();
        return new ClassDraftRecord(row.id(), row.code(), uiStatus(row.status()), row.name(),
            row.description(), row.teacherId(), row.startDate(), row.totalSessions(),
            row.tuitionAmount(), row.hourlyRate(), row.capacity(), row.defaultMode(),
            read(row.studentsJson(), new TypeReference<List<UUID>>() {}), patterns,
            read(row.overridesJson(), new TypeReference<List<SessionOverride>>() {}), row.version());
    }

    PageResponse<ClassListItem> listClasses(UUID tenantId, String search, String month, String status,
                                            UUID teacherId, int page, int pageSize, String sort) {
        String normalized = "%" + (search == null ? "" : search.trim().toLowerCase()) + "%";
        String dbStatus = status == null || status.isBlank() ? null : dbStatus(status);
        long total = jdbc.sql("""
                SELECT count(*) FROM classes c
                WHERE c.tenant_id=:tenantId AND lower(c.name) LIKE :search
                  AND (CAST(:month AS varchar) IS NULL OR EXISTS (
                    SELECT 1 FROM class_sessions sm
                    WHERE sm.tenant_id=c.tenant_id AND sm.class_id=c.id
                      AND to_char(sm.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')=:month
                  ))
                  AND (CAST(:status AS varchar) IS NULL OR c.status=:status)
                  AND (CAST(:teacherId AS uuid) IS NULL OR c.primary_teacher_id=:teacherId)
                """)
            .param("tenantId", tenantId).param("search", normalized)
            .param("month", month == null || month.isBlank() ? null : month)
            .param("status", dbStatus).param("teacherId", teacherId)
            .query(Long.class).single();
        String order = classListOrder(sort);
        String listSql = """
                SELECT c.id, c.code, c.name, c.total_sessions, c.expected_end_date, c.status,
                       t.id AS teacher_id, u.display_name AS teacher_name,
                       (SELECT count(*) FROM class_sessions s WHERE s.tenant_id=c.tenant_id
                         AND s.class_id=c.id AND s.status='COMPLETED') AS completed_sessions
                FROM classes c
                JOIN teacher_profiles t ON t.tenant_id=c.tenant_id AND t.id=c.primary_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE c.tenant_id=:tenantId AND lower(c.name) LIKE :search
                  AND (CAST(:month AS varchar) IS NULL OR EXISTS (
                    SELECT 1 FROM class_sessions sm
                    WHERE sm.tenant_id=c.tenant_id AND sm.class_id=c.id
                      AND to_char(sm.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')=:month
                  ))
                  AND (CAST(:status AS varchar) IS NULL OR c.status=:status)
                  AND (CAST(:teacherId AS uuid) IS NULL OR c.primary_teacher_id=:teacherId)
                ORDER BY %s
                LIMIT :limit OFFSET :offset
                """.formatted(order);
        List<ClassListItem> items = jdbc.sql(listSql)
            .param("tenantId", tenantId).param("search", normalized)
            .param("month", month == null || month.isBlank() ? null : month)
            .param("status", dbStatus).param("teacherId", teacherId)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, number) -> new ClassListItem(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                new TeacherOption(rs.getObject("teacher_id", UUID.class), rs.getString("teacher_name")),
                scheduleSummary(tenantId, rs.getObject("id", UUID.class)),
                rs.getInt("completed_sessions"), rs.getInt("total_sessions"),
                rs.getObject("expected_end_date", LocalDate.class), uiStatus(rs.getString("status")),
                sessionMonths(tenantId, rs.getObject("id", UUID.class))))
            .list();
        return PageResponse.of(items, page, pageSize, total);
    }

    private String classListOrder(String sort) {
        String normalized = sort == null || sort.isBlank() ? "name,asc" : sort.trim();
        String[] parts = normalized.split(",", 2);
        String column = parts[0];
        String direction = parts.length > 1 && "desc".equalsIgnoreCase(parts[1]) ? "DESC" : "ASC";
        String tieBreaker = "ASC".equals(direction) ? "ASC" : "DESC";
        String completedSessions = """
                (SELECT count(*) FROM class_sessions ps
                 WHERE ps.tenant_id=c.tenant_id AND ps.class_id=c.id AND ps.status='COMPLETED')
                """;
        return switch (column) {
            case "progress" -> "(%s::numeric / NULLIF(c.total_sessions, 0)) %s NULLS LAST, %s %s, lower(c.name) ASC"
                .formatted(completedSessions, direction, completedSessions, direction);
            case "expectedEndDate" -> "c.expected_end_date %s NULLS LAST, lower(c.name) ASC"
                .formatted(direction);
            default -> "lower(c.name) %s, c.name %s".formatted(direction, tieBreaker);
        };
    }

    Optional<SessionRow> sessionForUpdate(UUID tenantId, UUID sessionId) {
        return jdbc.sql("""
                SELECT s.id, s.class_id, s.ordinal, s.session_key, s.start_at, s.end_at,
                       s.planned_teacher_id, s.actual_teacher_id, s.mode, s.room_id, s.version,
                       c.code, c.name, u.display_name AS teacher_name, r.name AS room_name
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                WHERE s.tenant_id=:tenantId AND s.id=:sessionId
                FOR UPDATE OF s
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query(sessionMapper())
            .optional();
    }

    List<CalendarSession> calendar(UUID tenantId, LocalDate weekStart, UUID teacherId, UUID roomId,
                                   boolean canManage) {
        OffsetDateTime from = weekStart.atStartOfDay(SchedulingZone.ZONE).toOffsetDateTime();
        OffsetDateTime to = weekStart.plusDays(7).atStartOfDay(SchedulingZone.ZONE).toOffsetDateTime();
        return jdbc.sql("""
                SELECT s.id, s.class_id, s.ordinal, s.session_key, s.start_at, s.end_at,
                       s.planned_teacher_id, s.actual_teacher_id, s.mode, s.room_id, s.version,
                       s.is_substitution, COALESCE(s.online_link, '') AS online_link,
                       s.status, s.makeup_root_session_id, s.replaces_session_id,
                       s.cancellation_reason,
                       EXISTS(SELECT 1 FROM session_check_ins ci
                         WHERE ci.tenant_id=s.tenant_id AND ci.session_id=s.id) AS checked_in,
                       (SELECT child.id FROM class_sessions child
                        WHERE child.tenant_id=s.tenant_id AND child.replaces_session_id=s.id
                        LIMIT 1) AS replacement_session_id,
                       c.code, c.name, u.display_name AS teacher_name, r.name AS room_name
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                WHERE s.tenant_id=:tenantId
                  AND s.start_at >= :from AND s.start_at < :to
                  AND (CAST(:teacherId AS uuid) IS NULL
                    OR s.actual_teacher_id=:teacherId OR s.planned_teacher_id=:teacherId)
                  AND (CAST(:roomId AS uuid) IS NULL OR s.room_id=:roomId)
                ORDER BY s.start_at, c.name
                """)
            .param("tenantId", tenantId).param("from", from).param("to", to)
            .param("teacherId", teacherId).param("roomId", roomId)
            .query((rs, number) -> {
                OffsetDateTime startAt = rs.getObject("start_at", OffsetDateTime.class);
                boolean checkedIn = rs.getBoolean("checked_in");
                String status = rs.getString("status");
                UUID replacementId = rs.getObject("replacement_session_id", UUID.class);
                return new CalendarSession(
                    rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
                    rs.getString("code"), rs.getString("name"), rs.getInt("ordinal"),
                    startAt, rs.getObject("end_at", OffsetDateTime.class),
                    rs.getObject("planned_teacher_id", UUID.class),
                    rs.getObject("actual_teacher_id", UUID.class), rs.getString("teacher_name"),
                    DeliveryMode.valueOf(rs.getString("mode")), rs.getObject("room_id", UUID.class),
                    rs.getString("room_name"), rs.getString("online_link"),
                    rs.getBoolean("is_substitution"),
                    rs.getObject("replaces_session_id", UUID.class) != null,
                    status,
                    scheduleStateResolver.resolve(startAt, status, checkedIn),
                    rs.getObject("makeup_root_session_id", UUID.class),
                    rs.getObject("replaces_session_id", UUID.class),
                    replacementId,
                    rs.getString("cancellation_reason"),
                    allowedActions(canManage, status, checkedIn, replacementId),
                    rs.getLong("version"));
            })
            .list();
    }

    private List<SessionAction> allowedActions(boolean canManage, String status,
                                               boolean checkedIn, UUID replacementSessionId) {
        if (!canManage) {
            return List.of();
        }
        if ("SCHEDULED".equals(status) || "PENDING_CONFIRMATION".equals(status)) {
            if (!checkedIn) {
                return List.of(SessionAction.SUBSTITUTE_TEACHER, SessionAction.CANCEL_SESSION,
                    SessionAction.RESCHEDULE_SESSION);
            }
            return List.of(SessionAction.RESCHEDULE_SESSION);
        }
        if ("CANCELLED".equals(status) && replacementSessionId == null) {
            return List.of(SessionAction.CREATE_MAKEUP);
        }
        return List.of();
    }

    UUID teacherProfileIdForUser(UUID tenantId, UUID userId) {
        return jdbc.sql("""
                SELECT id FROM teacher_profiles WHERE tenant_id=:tenantId AND user_id=:userId
                """)
            .param("tenantId", tenantId).param("userId", userId)
            .query(UUID.class).optional()
            .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "TEACHER_PROFILE_REQUIRED",
                "Tài khoản chưa có hồ sơ giáo viên."));
    }

    List<UUID> activeStudentIds(UUID tenantId, UUID classId) {
        return jdbc.sql("""
                SELECT student_id FROM class_enrollments
                WHERE tenant_id=:tenantId AND class_id=:classId AND status='ACTIVE'
                ORDER BY student_id
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query(UUID.class).list();
    }

    List<SessionRow> scheduledSessionsFrom(UUID tenantId, UUID classId, int fromOrdinal) {
        return jdbc.sql("""
                SELECT s.id, s.class_id, s.ordinal, s.session_key, s.start_at, s.end_at,
                       s.planned_teacher_id, s.actual_teacher_id, s.mode, s.room_id, s.version,
                       c.code, c.name, u.display_name AS teacher_name, r.name AS room_name
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                WHERE s.tenant_id=:tenantId AND s.class_id=:classId
                  AND s.ordinal >= :fromOrdinal
                  AND s.status IN ('SCHEDULED', 'PENDING_CONFIRMATION')
                  AND s.replaces_session_id IS NULL
                ORDER BY s.ordinal ASC
                FOR UPDATE OF s
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("fromOrdinal", fromOrdinal)
            .query(sessionMapper())
            .list();
    }

    List<WeeklyPattern> classPatterns(UUID tenantId, UUID classId) {
        return jdbc.sql("""
                SELECT client_key, weekday, start_time, end_time, mode, room_id
                FROM class_schedule_patterns
                WHERE tenant_id=:tenantId AND class_id=:classId
                ORDER BY weekday, start_time, client_key
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, number) -> new WeeklyPattern(
                rs.getString("client_key"), rs.getInt("weekday"),
                rs.getObject("start_time", LocalTime.class), rs.getObject("end_time", LocalTime.class),
                DeliveryMode.valueOf(rs.getString("mode")), rs.getObject("room_id", UUID.class)))
            .list();
    }

    List<UUID> classParticipantUserIds(UUID tenantId, UUID classId) {
        return jdbc.sql("""
                SELECT DISTINCT user_id FROM (
                  SELECT t.user_id
                  FROM classes c
                  JOIN teacher_profiles t ON t.tenant_id=c.tenant_id AND t.id=c.primary_teacher_id
                  WHERE c.tenant_id=:tenantId AND c.id=:classId
                  UNION
                  SELECT sp.user_id
                  FROM class_enrollments e
                  JOIN student_profiles sp ON sp.tenant_id=e.tenant_id AND sp.id=e.student_id
                  WHERE e.tenant_id=:tenantId AND e.class_id=:classId AND e.status='ACTIVE'
                ) participants
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query(UUID.class).list();
    }

    String scheduleSummary(UUID tenantId, UUID classId) {
        List<String> lines = jdbc.sql("""
                SELECT weekday, start_time, end_time FROM class_schedule_patterns
                WHERE tenant_id=:tenantId AND class_id=:classId ORDER BY weekday, start_time
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, number) -> "Thứ " + (rs.getInt("weekday") + 1) + " "
                + rs.getObject("start_time", LocalTime.class) + "–"
                + rs.getObject("end_time", LocalTime.class))
            .list();
        return String.join(", ", lines);
    }

    List<String> sessionMonths(UUID tenantId, UUID classId) {
        return jdbc.sql("""
                SELECT DISTINCT to_char(start_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS month
                FROM class_sessions WHERE tenant_id=:tenantId AND class_id=:classId ORDER BY month
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query(String.class).list();
    }

    String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    <T> T read(String value, TypeReference<T> type) {
        try {
            return mapper.readValue(value, type);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    static String uiStatus(String status) {
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

    private static String dbStatus(String status) {
        return switch (status) {
            case "Draft" -> "DRAFT";
            case "Scheduled" -> "SCHEDULED";
            case "Active" -> "ACTIVE";
            case "AwaitingClose" -> "AWAITING_CLOSE";
            case "Closed" -> "CLOSED";
            case "Cancelled" -> "CANCELLED";
            default -> status.toUpperCase();
        };
    }

    private org.springframework.jdbc.core.RowMapper<SessionRow> sessionMapper() {
        return (rs, number) -> new SessionRow(
            rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
            rs.getInt("ordinal"), rs.getString("session_key"),
            rs.getObject("start_at", OffsetDateTime.class), rs.getObject("end_at", OffsetDateTime.class),
            rs.getObject("planned_teacher_id", UUID.class),
            rs.getObject("actual_teacher_id", UUID.class),
            DeliveryMode.valueOf(rs.getString("mode")), rs.getObject("room_id", UUID.class),
            rs.getLong("version"), rs.getString("code"), rs.getString("name"),
            rs.getString("teacher_name"), rs.getString("room_name"));
    }

    record SessionRow(
        UUID id, UUID classId, int ordinal, String sessionKey,
        OffsetDateTime startAt, OffsetDateTime endAt,
        UUID plannedTeacherId, UUID actualTeacherId,
        DeliveryMode mode, UUID roomId, long version,
        String classCode, String className, String teacherName, String roomName
    ) {
    }

    private record DraftRow(
        UUID id, String code, String status, String name, String description,
        UUID teacherId, LocalDate startDate, int totalSessions,
        BigDecimal tuitionAmount, BigDecimal hourlyRate, Integer capacity,
        DeliveryMode defaultMode, String studentsJson, String overridesJson, long version
    ) {
    }

    private record OccupiedRow(
        UUID id, UUID classId, UUID teacherId, UUID roomId, DeliveryMode mode,
        OffsetDateTime startAt, OffsetDateTime endAt, String classCode,
        String className, String teacherName, String roomName
    ) {
    }

    static final class SchedulingZone {
        static final java.time.ZoneId ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
        private SchedulingZone() {
        }
    }
}
