package com.classops.backend.scheduling;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.scheduling.SchedulingDtos.ClassDetail;
import com.classops.backend.scheduling.SchedulingDtos.ClassDraftInput;
import com.classops.backend.scheduling.SchedulingDtos.ClassDraftRecord;
import com.classops.backend.scheduling.SchedulingDtos.ClassListItem;
import com.classops.backend.scheduling.SchedulingDtos.PublishClassInput;
import com.classops.backend.scheduling.SchedulingDtos.ScheduleConflict;
import com.classops.backend.scheduling.SchedulingDtos.SchedulePreview;
import com.classops.backend.scheduling.SchedulingDtos.StudentOption;
import com.classops.backend.scheduling.SchedulingDtos.TeacherOption;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ClassSchedulingService {
    private final SchedulingStore store;
    private final SchedulingEngine engine;
    private final SchedulingProperties properties;
    private final CurrentActor actor;
    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public ClassSchedulingService(SchedulingStore store, SchedulingEngine engine,
                                  SchedulingProperties properties, CurrentActor actor,
                                  JdbcClient jdbc, ObjectMapper mapper) {
        this.store = store;
        this.engine = engine;
        this.properties = properties;
        this.actor = actor;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public SchedulingDtos.SchedulingOptions options() {
        UUID tenantId = actor.tenantId();
        return new SchedulingDtos.SchedulingOptions(store.teachers(tenantId), store.rooms(tenantId));
    }

    @Transactional(readOnly = true)
    public List<TeacherOption> teachers() {
        return store.teachers(actor.tenantId());
    }

    @Transactional(readOnly = true)
    public PageResponse<StudentOption> students(String search, int page, int pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                "page phải từ 1 và pageSize trong khoảng 1–100.");
        }
        return store.students(actor.tenantId(), search, page, pageSize);
    }

    @Transactional
    public ClassDraftRecord createDraft(ClassDraftInput input) {
        UUID tenantId = actor.tenantId();
        validateReferences(tenantId, input);
        UUID id = store.insertDraft(tenantId, actor.userId(), input);
        audit(tenantId, actor.userId(), "CLASS_DRAFT_CREATED", "CLASS", id, null, input);
        return store.draft(tenantId, id, false);
    }

    @Transactional
    public ClassDraftRecord updateDraft(UUID classId, ClassDraftInput input) {
        UUID tenantId = actor.tenantId();
        validateReferences(tenantId, input);
        ClassDraftRecord old = store.draft(tenantId, classId, true);
        store.updateDraft(tenantId, classId, actor.userId(), input);
        audit(tenantId, actor.userId(), "CLASS_DRAFT_UPDATED", "CLASS", classId, old, input);
        return store.draft(tenantId, classId, false);
    }

    @Transactional(readOnly = true)
    public ClassDraftRecord draft(UUID classId) {
        ClassDraftRecord record = store.draft(actor.tenantId(), classId, false);
        if (!"Draft".equals(record.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "CLASS_NOT_DRAFT",
                "Lớp không còn ở trạng thái Nháp.");
        }
        return record;
    }

    @Transactional
    public SchedulePreview preview(ClassDraftInput input) {
        UUID tenantId = actor.tenantId();
        TeacherOption teacher = store.requireTeacher(tenantId, input.primaryTeacherId());
        store.requireStudents(tenantId, input.studentIds());
        Map<UUID, String> rooms = store.requireRooms(tenantId, input.patterns(), input.overrides());
        SchedulingEngine.GenerationResult generated = engine.generate(input, teacher.name(), rooms,
            store.holidays(tenantId), store.occupied(tenantId, null, null));
        Instant now = Instant.now();
        String inputVersion = inputHash(input);
        SchedulePreview result = new SchedulePreview(
            UUID.randomUUID(), now, now.plus(properties.previewTtl()), inputVersion,
            generated.sessions(), generated.skippedHolidays(), generated.expectedEndDate(),
            generated.conflicts());
        jdbc.sql("""
                INSERT INTO schedule_previews (
                  id, tenant_id, owner_user_id, kind, input_hash, input_version,
                  result_json, created_at, expires_at
                ) VALUES (
                  :id, :tenantId, :ownerId, 'CLASS', :inputHash, :inputVersion,
                  CAST(:result AS jsonb), :createdAt, :expiresAt
                )
                """)
            .param("id", result.previewId()).param("tenantId", tenantId)
            .param("ownerId", actor.userId()).param("inputHash", inputVersion)
            .param("inputVersion", inputVersion).param("result", store.json(result))
            .param("createdAt", OffsetDateTime.ofInstant(result.generatedAt(), ZoneOffset.UTC))
            .param("expiresAt", OffsetDateTime.ofInstant(result.expiresAt(), ZoneOffset.UTC))
            .update();
        return result;
    }

    @Transactional
    public ClassDetail publish(UUID classId, PublishClassInput request, String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        ClassDraftRecord draft = store.draft(tenantId, classId, true);
        String operation = "PUBLISH_CLASS:" + classId;
        String requestHash = SchedulingEngine.sha256(store.json(request));
        StoredResponse repeated = idempotentResponse(tenantId, operation, idempotencyKey);
        if (repeated != null) {
            if (!repeated.requestHash().equals(requestHash)) {
                throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key đã được dùng với dữ liệu khác.");
            }
            return read(repeated.responseJson(), ClassDetail.class);
        }
        if (!"Draft".equals(draft.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "CLASS_ALREADY_PUBLISHED",
                "Lớp đã được công bố.");
        }
        ClassDraftInput input = inputOf(draft);
        SchedulePreview savedPreview = requirePreview(
            tenantId, request.previewId(), "CLASS", null, inputHash(input));
        TeacherOption teacher = store.requireTeacher(tenantId, input.primaryTeacherId());
        store.requireStudents(tenantId, input.studentIds());
        Map<UUID, String> rooms = store.requireRooms(tenantId, input.patterns(), input.overrides());
        SchedulingEngine.GenerationResult rechecked = engine.generate(
            input, teacher.name(), rooms, store.holidays(tenantId),
            store.occupied(tenantId, null, classId));
        enforceConflicts(rechecked.conflicts(), request.acknowledgedWarningIds());

        for (SchedulingDtos.PreviewSession session : rechecked.sessions()) {
            jdbc.sql("""
                    INSERT INTO class_sessions (
                      id, tenant_id, class_id, ordinal, pattern_key, session_key,
                      start_at, end_at, planned_teacher_id, actual_teacher_id,
                      mode, room_id, online_link, status
                    ) VALUES (
                      :id, :tenantId, :classId, :ordinal, :patternKey, :sessionKey,
                      :startAt, :endAt, :teacherId, :teacherId,
                      :mode, :roomId, NULL, 'SCHEDULED'
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("classId", classId)
                .param("ordinal", session.ordinal())
                .param("patternKey", session.key().substring(0, session.key().lastIndexOf('@')))
                .param("sessionKey", session.key()).param("startAt", session.startAt())
                .param("endAt", session.endAt()).param("teacherId", session.teacherId())
                .param("mode", session.mode().name()).param("roomId", session.roomId()).update();
        }
        for (UUID studentId : input.studentIds()) {
            UUID enrollmentId = UUID.randomUUID();
            jdbc.sql("""
                    INSERT INTO class_enrollments (
                      id, tenant_id, class_id, student_id, status, effective_from
                    ) VALUES (:id, :tenantId, :classId, :studentId, 'ACTIVE', :effectiveFrom)
                    """)
                .param("id", enrollmentId).param("tenantId", tenantId).param("classId", classId)
                .param("studentId", studentId).param("effectiveFrom", input.startDate()).update();
            jdbc.sql("""
                    INSERT INTO tuition_charges (
                      id, tenant_id, class_id, student_id, enrollment_id, amount, status
                    ) VALUES (
                      :id, :tenantId, :classId, :studentId, :enrollmentId, :amount, 'UNPAID'
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("classId", classId)
                .param("studentId", studentId).param("enrollmentId", enrollmentId)
                .param("amount", input.tuitionAmount()).update();
            notifyStudent(tenantId, studentId, classId, draft.name());
        }
        jdbc.sql("""
                INSERT INTO class_teacher_assignments (
                  id, tenant_id, class_id, teacher_id, effective_from
                ) VALUES (
                  :id, :tenantId, :classId, :teacherId, :effectiveFrom
                )
                ON CONFLICT (tenant_id, class_id, teacher_id, effective_from) DO NOTHING
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("classId", classId).param("teacherId", input.primaryTeacherId())
            .param("effectiveFrom", input.startDate()).update();
        UUID teacherUserId = jdbc.sql("""
                SELECT user_id FROM teacher_profiles
                WHERE tenant_id=:tenantId AND id=:teacherId
                """)
            .param("tenantId", tenantId).param("teacherId", input.primaryTeacherId())
            .query(UUID.class).single();
        notifyUser(tenantId, teacherUserId, "CLASS_PUBLISHED",
            "Lớp học đã được xếp lịch",
            "Bạn được phân công dạy lớp " + draft.name() + ".");
        jdbc.sql("""
                UPDATE classes SET status='SCHEDULED', expected_end_date=:endDate,
                  published_at=now(), updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:classId
                """)
            .param("endDate", rechecked.expectedEndDate()).param("actorId", actor.userId())
            .param("tenantId", tenantId).param("classId", classId).update();
        audit(tenantId, actor.userId(), "CLASS_PUBLISHED", "CLASS", classId,
            Map.of("status", "DRAFT"), Map.of(
                "status", "SCHEDULED",
                "sessionCount", rechecked.sessions().size(),
                "enrollmentCount", input.studentIds().size(),
                "previewId", savedPreview.previewId()));
        outbox(tenantId, "CLASS", classId, "CLASS_PUBLISHED",
            Map.of("classId", classId, "sessionCount", rechecked.sessions().size()));
        ClassDetail response = detail(classId);
        jdbc.sql("""
                INSERT INTO idempotency_records (
                  id, tenant_id, operation, idempotency_key, request_hash,
                  response_status, response_json
                ) VALUES (
                  :id, :tenantId, :operation, :key, :requestHash, 200, CAST(:response AS jsonb)
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("operation", operation).param("key", idempotencyKey)
            .param("requestHash", requestHash).param("response", store.json(response)).update();
        return response;
    }

    @Transactional(readOnly = true)
    public PageResponse<ClassListItem> classes(String search, String month, String status, UUID teacherId,
                                               int page, int pageSize, String sort) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                "page phải từ 1 và pageSize trong khoảng 1–100.");
        }
        if (month != null && !month.isBlank() && !month.matches("\\d{4}-(0[1-9]|1[0-2])")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MONTH",
                "month phải có định dạng YYYY-MM.");
        }
        return store.listClasses(actor.tenantId(), search, month, status, teacherId,
            page, pageSize, sort);
    }

    @Transactional(readOnly = true)
    public ClassDetail detail(UUID classId) {
        UUID tenantId = actor.tenantId();
        BaseClass row = jdbc.sql("""
                SELECT c.id, c.code, c.name, c.status, c.total_sessions, c.expected_end_date,
                       c.default_mode, c.primary_teacher_id, u.display_name AS teacher_name,
                       COALESCE((SELECT hourly_rate FROM class_hourly_rates hr
                         WHERE hr.tenant_id=c.tenant_id AND hr.class_id=c.id
                         ORDER BY effective_date DESC LIMIT 1), 0) AS hourly_rate,
                       (SELECT count(*) FROM class_sessions s WHERE s.tenant_id=c.tenant_id
                         AND s.class_id=c.id AND s.status='COMPLETED') AS completed_sessions,
                       (SELECT count(*) FROM class_enrollments e WHERE e.tenant_id=c.tenant_id
                         AND e.class_id=c.id AND e.status='ACTIVE') AS student_count
                FROM classes c
                JOIN teacher_profiles t ON t.tenant_id=c.tenant_id AND t.id=c.primary_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE c.tenant_id=:tenantId AND c.id=:classId
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, number) -> new BaseClass(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("status"), rs.getInt("total_sessions"),
                rs.getObject("expected_end_date", LocalDate.class),
                SchedulingDtos.DeliveryMode.valueOf(rs.getString("default_mode")),
                rs.getObject("primary_teacher_id", UUID.class), rs.getString("teacher_name"),
                rs.getBigDecimal("hourly_rate"), rs.getInt("completed_sessions"),
                rs.getInt("student_count")))
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND",
                "Không tìm thấy lớp."));
        List<SchedulingDtos.ClassSessionSummary> sessions = jdbc.sql("""
                SELECT s.id, s.ordinal, s.start_at, u.display_name AS teacher_name
                FROM class_sessions s
                JOIN teacher_profiles t ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE s.tenant_id=:tenantId AND s.class_id=:classId
                ORDER BY s.ordinal
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, number) -> new SchedulingDtos.ClassSessionSummary(
                rs.getObject("id", UUID.class), rs.getInt("ordinal"),
                rs.getObject("start_at", OffsetDateTime.class), "",
                rs.getString("teacher_name"), null, "MISSING"))
            .list();
        String room = jdbc.sql("""
                SELECT r.name FROM class_schedule_patterns p
                LEFT JOIN rooms r ON r.tenant_id=p.tenant_id AND r.id=p.room_id
                WHERE p.tenant_id=:tenantId AND p.class_id=:classId AND r.name IS NOT NULL
                ORDER BY p.sort_order LIMIT 1
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query(String.class).optional().orElse("");
        return new ClassDetail(
            row.id(), row.code(), row.name(), new TeacherOption(row.teacherId(), row.teacherName()),
            store.scheduleSummary(tenantId, classId), row.completedSessions(), row.totalSessions(),
            row.expectedEndDate(), SchedulingStore.uiStatus(row.status()),
            store.sessionMonths(tenantId, classId), row.hourlyRate(), BigDecimal.ZERO,
            BigDecimal.ZERO, "", room, row.defaultMode() == SchedulingDtos.DeliveryMode.IN_PERSON
                ? "Tại lớp" : "Online",
            row.studentCount(), List.of(), sessions);
    }

    private void validateReferences(UUID tenantId, ClassDraftInput input) {
        store.requireTeacher(tenantId, input.primaryTeacherId());
        store.requireStudents(tenantId, input.studentIds());
        store.requireRooms(tenantId, input.patterns(), input.overrides());
        for (SchedulingDtos.WeeklyPattern pattern : input.patterns()) {
            validateModeRoom(pattern.mode(), pattern.roomId());
            if (!pattern.endTime().isAfter(pattern.startTime())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME_RANGE",
                    "Giờ kết thúc phải sau giờ bắt đầu.");
            }
        }
        for (SchedulingDtos.SessionOverride override : input.overrides()) {
            validateModeRoom(override.mode(), override.roomId());
        }
    }

    private void validateModeRoom(SchedulingDtos.DeliveryMode mode, UUID roomId) {
        if (mode == SchedulingDtos.DeliveryMode.IN_PERSON && roomId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROOM_REQUIRED",
                "Ca tại lớp bắt buộc chọn phòng.");
        }
        if (mode == SchedulingDtos.DeliveryMode.ONLINE && roomId != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ONLINE_ROOM_NOT_ALLOWED",
                "Ca online không được gán phòng.");
        }
    }

    SchedulePreview requirePreview(UUID tenantId, UUID previewId, String kind, UUID sessionId,
                                   String expectedHash) {
        PreviewRow row = jdbc.sql("""
                SELECT input_hash, result_json::text AS result_json, expires_at, owner_user_id,
                       kind, session_id
                FROM schedule_previews
                WHERE tenant_id=:tenantId AND id=:previewId
                """)
            .param("tenantId", tenantId).param("previewId", previewId)
            .query((rs, number) -> new PreviewRow(
                rs.getString("input_hash"), rs.getString("result_json"),
                rs.getObject("expires_at", OffsetDateTime.class).toInstant(),
                rs.getObject("owner_user_id", UUID.class),
                rs.getString("kind"), rs.getObject("session_id", UUID.class)))
            .optional()
            .orElseThrow(() -> stale("Không tìm thấy bản xem trước."));
        if (!row.ownerId().equals(actor.userId()) || !row.kind().equals(kind)
            || (sessionId != null && !sessionId.equals(row.sessionId()))
            || row.expiresAt().isBefore(Instant.now())
            || !row.inputHash().equals(expectedHash)) {
            throw stale("Bản xem trước đã hết hạn hoặc dữ liệu đã thay đổi.");
        }
        return read(row.resultJson(), SchedulePreview.class);
    }

    void enforceConflicts(List<ScheduleConflict> conflicts, List<String> acknowledgedWarningIds) {
        List<ScheduleConflict> blockers = conflicts.stream()
            .filter(item -> "BLOCKING".equals(item.severity())).toList();
        if (!blockers.isEmpty()) {
            ScheduleConflict first = blockers.get(0);
            throw new ApiException(HttpStatus.CONFLICT, first.code(),
                "Lịch vẫn còn xung đột bắt buộc phải xử lý.",
                Map.of("conflicts", blockers));
        }
        Set<String> acknowledged = new HashSet<>(acknowledgedWarningIds);
        List<ScheduleConflict> unacknowledged = conflicts.stream()
            .filter(item -> "WARNING".equals(item.severity()))
            .filter(item -> !acknowledged.contains(item.id()))
            .toList();
        if (!unacknowledged.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "STUDENT_OVERLAP",
                "Cần xác nhận tất cả cảnh báo trùng lịch học sinh trước khi tiếp tục.",
                Map.of("conflicts", unacknowledged));
        }
    }

    String inputHash(ClassDraftInput input) {
        StringBuilder canonical = new StringBuilder()
            .append(input.name().trim()).append('|')
            .append(input.description()).append('|')
            .append(input.primaryTeacherId()).append('|')
            .append(input.startDate()).append('|')
            .append(input.totalSessions()).append('|')
            .append(input.tuitionAmount().stripTrailingZeros().toPlainString()).append('|')
            .append(input.hourlyRate().stripTrailingZeros().toPlainString()).append('|')
            .append(input.capacity()).append('|')
            .append(input.defaultMode()).append('|');
        input.studentIds().stream().sorted().forEach(id -> canonical.append(id).append(','));
        canonical.append('|');
        input.patterns().stream()
            .sorted(java.util.Comparator.comparing(SchedulingDtos.WeeklyPattern::id))
            .forEach(pattern -> canonical.append(pattern.id()).append(':')
                .append(pattern.weekday()).append(':').append(pattern.startTime()).append(':')
                .append(pattern.endTime()).append(':').append(pattern.mode()).append(':')
                .append(pattern.roomId()).append(','));
        canonical.append('|');
        input.overrides().stream()
            .sorted(java.util.Comparator.comparing(SchedulingDtos.SessionOverride::sessionKey))
            .forEach(override -> canonical.append(override.sessionKey()).append(':')
                .append(override.mode()).append(':').append(override.roomId()).append(','));
        return SchedulingEngine.sha256(canonical.toString());
    }

    private ClassDraftInput inputOf(ClassDraftRecord draft) {
        return new ClassDraftInput(draft.name(), draft.description(), draft.primaryTeacherId(),
            draft.startDate(), draft.totalSessions(), draft.tuitionAmount(), draft.hourlyRate(),
            draft.capacity(), draft.defaultMode(), draft.studentIds(), draft.patterns(), draft.overrides());
    }

    private StoredResponse idempotentResponse(UUID tenantId, String operation, String key) {
        return jdbc.sql("""
                SELECT request_hash, response_json::text AS response_json
                FROM idempotency_records
                WHERE tenant_id=:tenantId AND operation=:operation AND idempotency_key=:key
                """)
            .param("tenantId", tenantId).param("operation", operation).param("key", key)
            .query((rs, number) -> new StoredResponse(
                rs.getString("request_hash"), rs.getString("response_json")))
            .optional().orElse(null);
    }

    void requireIdempotencyKey(String key) {
        if (key == null || key.isBlank() || key.length() > 150) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED",
                "Cần Idempotency-Key hợp lệ cho thao tác ghi này.");
        }
    }

    private void notifyStudent(UUID tenantId, UUID studentId, UUID classId, String className) {
        UUID userId = jdbc.sql("""
                SELECT user_id FROM student_profiles WHERE tenant_id=:tenantId AND id=:studentId
                """)
            .param("tenantId", tenantId).param("studentId", studentId)
            .query(UUID.class).single();
        notifyUser(tenantId, userId, "CLASS_PUBLISHED", "Lớp học đã được xếp lịch",
            "Bạn đã được thêm vào lớp " + className + ".");
    }

    private void notifyUser(UUID tenantId, UUID userId, String eventType,
                            String title, String body) {
        jdbc.sql("""
                INSERT INTO notifications (
                  id, tenant_id, recipient_user_id, event_type, title, body
                ) VALUES (
                  :id, :tenantId, :userId, :eventType, :title, :body
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("userId", userId)
            .param("eventType", eventType).param("title", title).param("body", body).update();
    }

    void audit(UUID tenantId, UUID actorId, String action, String entityType,
               UUID entityId, Object oldValue, Object newValue) {
        jdbc.sql("""
                INSERT INTO audit_events (
                  id, tenant_id, actor_user_id, action, entity_type, entity_id,
                  old_value, new_value, trace_id
                ) VALUES (
                  :id, :tenantId, :actorId, :action, :entityType, :entityId,
                  CAST(:oldValue AS jsonb), CAST(:newValue AS jsonb), :traceId
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("actorId", actorId)
            .param("action", action).param("entityType", entityType).param("entityId", entityId)
            .param("oldValue", oldValue == null ? "null" : store.json(oldValue))
            .param("newValue", newValue == null ? "null" : store.json(newValue))
            .param("traceId", MDC.get("traceId")).update();
    }

    void outbox(UUID tenantId, String aggregateType, UUID aggregateId, String eventType,
                Object payload) {
        jdbc.sql("""
                INSERT INTO outbox_events (
                  id, tenant_id, aggregate_type, aggregate_id, event_type, payload
                ) VALUES (
                  :id, :tenantId, :aggregateType, :aggregateId, :eventType, CAST(:payload AS jsonb)
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("aggregateType", aggregateType).param("aggregateId", aggregateId)
            .param("eventType", eventType).param("payload", store.json(payload)).update();
    }

    private ApiException stale(String message) {
        return new ApiException(HttpStatus.CONFLICT, "SCHEDULE_PREVIEW_STALE", message);
    }

    <T> T read(String value, Class<T> type) {
        try {
            return mapper.readValue(value, type);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private record PreviewRow(String inputHash, String resultJson, Instant expiresAt,
                              UUID ownerId, String kind, UUID sessionId) {
    }

    private record StoredResponse(String requestHash, String responseJson) {
    }

    private record BaseClass(
        UUID id, String code, String name, String status, int totalSessions,
        LocalDate expectedEndDate, SchedulingDtos.DeliveryMode defaultMode,
        UUID teacherId, String teacherName, BigDecimal hourlyRate,
        int completedSessions, int studentCount
    ) {
    }
}
