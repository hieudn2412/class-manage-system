package com.classops.backend.scheduling;

import com.classops.backend.common.ApiException;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.salary.SalaryAccrualService;
import com.classops.backend.scheduling.SchedulingDtos.ApplyRescheduleInput;
import com.classops.backend.scheduling.SchedulingDtos.ApplySubstitutionInput;
import com.classops.backend.scheduling.SchedulingDtos.CancelSessionInput;
import com.classops.backend.scheduling.SchedulingDtos.CreateMakeupInput;
import com.classops.backend.scheduling.SchedulingDtos.DeliveryMode;
import com.classops.backend.scheduling.SchedulingDtos.MakeupPreviewInput;
import com.classops.backend.scheduling.SchedulingDtos.MakeupScheduleInput;
import com.classops.backend.scheduling.SchedulingDtos.PreviewSession;
import com.classops.backend.scheduling.SchedulingDtos.ReschedulePreviewInput;
import com.classops.backend.scheduling.SchedulingDtos.RescheduleResult;
import com.classops.backend.scheduling.SchedulingDtos.ScheduleConflict;
import com.classops.backend.scheduling.SchedulingDtos.SchedulePreview;
import com.classops.backend.scheduling.SchedulingDtos.SessionAction;
import com.classops.backend.scheduling.SchedulingDtos.SessionMutationResult;
import com.classops.backend.scheduling.SchedulingDtos.SessionMutationView;
import com.classops.backend.scheduling.SchedulingDtos.SessionOverride;
import com.classops.backend.scheduling.SchedulingDtos.SubstitutionPreviewInput;
import com.classops.backend.scheduling.SchedulingDtos.WeeklyPattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SessionMutationService {
    private final SchedulingStore store;
    private final SchedulingEngine engine;
    private final SchedulingProperties properties;
    private final ClassSchedulingService classService;
    private final CurrentActor actor;
    private final JdbcClient jdbc;
    private final SalaryAccrualService salaryAccruals;

    public SessionMutationService(SchedulingStore store, SchedulingEngine engine,
                                  SchedulingProperties properties,
                                  ClassSchedulingService classService,
                                  CurrentActor actor, JdbcClient jdbc,
                                  SalaryAccrualService salaryAccruals) {
        this.store = store;
        this.engine = engine;
        this.properties = properties;
        this.classService = classService;
        this.actor = actor;
        this.jdbc = jdbc;
        this.salaryAccruals = salaryAccruals;
    }

    @Transactional
    public SchedulePreview previewSubstitution(UUID sessionId, SubstitutionPreviewInput input) {
        UUID tenantId = actor.tenantId();
        MutationSession session = lock(tenantId, sessionId);
        requireVersion(session, input.version());
        requireMutableBeforeTeaching(session);
        SchedulingDtos.TeacherOption teacher = store.requireTeacher(tenantId, input.teacherId());
        if (teacher.id().equals(session.actualTeacherId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_TEACHER",
                "Giáo viên thay thế phải khác giáo viên hiện tại.");
        }
        PreviewSession proposed = new PreviewSession(
            session.sessionKey(), session.ordinal(), session.startAt(), session.endAt(),
            teacher.id(), teacher.name(), session.mode(), session.roomId(), session.roomName());
        return savePreview(tenantId, session, substitutionHash(sessionId, input),
            List.of(proposed), conflicts(tenantId, session, proposed));
    }

    @Transactional
    public SessionMutationResult substitute(UUID sessionId, ApplySubstitutionInput input,
                                            String idempotencyKey) {
        classService.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "SUBSTITUTE_SESSION:" + sessionId;
        String requestHash = SchedulingEngine.sha256(store.json(input));
        SessionMutationResult repeated = repeated(tenantId, operation, idempotencyKey,
            requestHash, SessionMutationResult.class);
        if (repeated != null) {
            return repeated;
        }
        MutationSession session = lock(tenantId, sessionId);
        requireVersion(session, input.version());
        requireMutableBeforeTeaching(session);
        SchedulingDtos.TeacherOption teacher = store.requireTeacher(tenantId, input.teacherId());
        if (teacher.id().equals(session.actualTeacherId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_TEACHER",
                "Giáo viên thay thế phải khác giáo viên hiện tại.");
        }
        SubstitutionPreviewInput previewInput = new SubstitutionPreviewInput(
            input.teacherId(), input.note(), input.version());
        classService.requirePreview(tenantId, input.previewId(), "SESSION", sessionId,
            substitutionHash(sessionId, previewInput));
        PreviewSession proposed = new PreviewSession(
            session.sessionKey(), session.ordinal(), session.startAt(), session.endAt(),
            teacher.id(), teacher.name(), session.mode(), session.roomId(), session.roomName());
        List<ScheduleConflict> conflicts = conflicts(tenantId, session, proposed);
        classService.enforceConflicts(conflicts, input.acknowledgedWarningIds());

        jdbc.sql("""
                UPDATE class_sessions
                SET actual_teacher_id=:teacherId,
                    is_substitution=(:teacherId <> planned_teacher_id),
                    substitution_note=:note, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId AND version=:version
                """)
            .param("teacherId", teacher.id()).param("note", emptyToNull(input.note()))
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .param("version", input.version()).update();
        classService.audit(tenantId, actor.userId(), "SESSION_TEACHER_SUBSTITUTED", "SESSION",
            sessionId,
            Map.of("actualTeacherId", session.actualTeacherId(), "teacherName", session.teacherName()),
            Map.of("actualTeacherId", teacher.id(), "teacherName", teacher.name(), "note", input.note()));
        notifyTeachers(tenantId, List.of(session.actualTeacherId(), teacher.id()),
            "SESSION_TEACHER_SUBSTITUTED", "Thay giáo viên một buổi",
            "Buổi " + session.className() + " đã được đổi giáo viên.");
        classService.outbox(tenantId, "SESSION", sessionId, "SESSION_TEACHER_SUBSTITUTED",
            Map.of("sessionId", sessionId, "classId", session.classId(),
                "fromTeacherId", session.actualTeacherId(), "toTeacherId", teacher.id()));
        SessionMutationResult response = new SessionMutationResult(view(tenantId, sessionId), null,
            conflicts);
        remember(tenantId, operation, idempotencyKey, requestHash, response);
        return response;
    }

    @Transactional
    public SchedulePreview previewMakeup(UUID sessionId, MakeupPreviewInput input) {
        UUID tenantId = actor.tenantId();
        MutationSession session = lock(tenantId, sessionId);
        requireVersion(session, input.version());
        requireCanPreviewMakeup(session);
        PreviewSession proposed = makeupPreviewSession(tenantId, session, input.makeup());
        return savePreview(tenantId, session, makeupHash(sessionId, input),
            List.of(proposed), conflicts(tenantId, session, proposed));
    }

    @Transactional
    public SessionMutationResult cancel(UUID sessionId, CancelSessionInput input,
                                        String idempotencyKey) {
        classService.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "CANCEL_SESSION:" + sessionId;
        String requestHash = SchedulingEngine.sha256(store.json(input));
        SessionMutationResult repeated = repeated(tenantId, operation, idempotencyKey,
            requestHash, SessionMutationResult.class);
        if (repeated != null) {
            return repeated;
        }
        MutationSession session = lock(tenantId, sessionId);
        requireVersion(session, input.version());
        requireMutableBeforeTeaching(session);
        PreviewSession proposed = null;
        List<ScheduleConflict> conflicts = List.of();
        if (input.makeup() != null) {
            if (input.previewId() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "PREVIEW_REQUIRED",
                    "Cần bản xem trước trước khi tạo buổi bù.");
            }
            MakeupPreviewInput previewInput = new MakeupPreviewInput(input.makeup(), input.version());
            classService.requirePreview(tenantId, input.previewId(), "SESSION", sessionId,
                makeupHash(sessionId, previewInput));
            proposed = makeupPreviewSession(tenantId, session, input.makeup());
            conflicts = conflicts(tenantId, session, proposed);
            classService.enforceConflicts(conflicts, input.acknowledgedWarningIds());
        }

        cancelLocked(session, input.reason(), "SESSION_CANCELLED");
        UUID makeupId = proposed == null ? null : insertMakeup(session, input.makeup(), proposed);
        refreshExpectedEndDate(tenantId, session.classId());
        classService.audit(tenantId, actor.userId(), "SESSION_CANCELLED", "SESSION", sessionId,
            Map.of("status", session.status()),
            Map.of("status", "CANCELLED", "reason", input.reason(),
                "makeupSessionId", makeupId == null ? "" : makeupId));
        LinkedHashSet<UUID> recipientTeachers = new LinkedHashSet<>();
        recipientTeachers.add(session.actualTeacherId());
        if (input.makeup() != null) {
            recipientTeachers.add(input.makeup().teacherId());
        }
        notifyTeachers(tenantId, List.copyOf(recipientTeachers), "SESSION_CANCELLED",
            "Buổi học đã bị hủy", "Buổi " + session.className() + " đã bị hủy.");
        classService.outbox(tenantId, "SESSION", sessionId, "SESSION_CANCELLED",
            Map.of("sessionId", sessionId, "classId", session.classId(),
                "reason", input.reason(), "makeupSessionId", makeupId == null ? "" : makeupId));
        SessionMutationResult response = new SessionMutationResult(
            view(tenantId, sessionId), makeupId == null ? null : view(tenantId, makeupId), conflicts);
        remember(tenantId, operation, idempotencyKey, requestHash, response);
        return response;
    }

    @Transactional
    public SessionMutationResult createMakeup(UUID sessionId, CreateMakeupInput input,
                                              String idempotencyKey) {
        classService.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "CREATE_MAKEUP_SESSION:" + sessionId;
        String requestHash = SchedulingEngine.sha256(store.json(input));
        SessionMutationResult repeated = repeated(tenantId, operation, idempotencyKey,
            requestHash, SessionMutationResult.class);
        if (repeated != null) {
            return repeated;
        }
        MutationSession session = lock(tenantId, sessionId);
        requireVersion(session, input.version());
        requireCanCreateMakeup(session);
        MakeupPreviewInput previewInput = new MakeupPreviewInput(input.makeup(), input.version());
        classService.requirePreview(tenantId, input.previewId(), "SESSION", sessionId,
            makeupHash(sessionId, previewInput));
        PreviewSession proposed = makeupPreviewSession(tenantId, session, input.makeup());
        List<ScheduleConflict> conflicts = conflicts(tenantId, session, proposed);
        classService.enforceConflicts(conflicts, input.acknowledgedWarningIds());
        UUID makeupId = insertMakeup(session, input.makeup(), proposed);
        jdbc.sql("""
                UPDATE class_sessions
                SET updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId AND version=:version
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .param("version", input.version()).update();
        refreshExpectedEndDate(tenantId, session.classId());
        classService.audit(tenantId, actor.userId(), "SESSION_MAKEUP_CREATED", "SESSION",
            makeupId, null, Map.of("sourceSessionId", sessionId, "rootSessionId", rootOf(session)));
        notifyTeachers(tenantId, List.of(input.makeup().teacherId()), "SESSION_MAKEUP_CREATED",
            "Buổi dạy bù đã được xếp", "Buổi " + session.className() + " đã có lịch dạy bù.");
        classService.outbox(tenantId, "SESSION", makeupId, "SESSION_MAKEUP_CREATED",
            Map.of("sessionId", makeupId, "sourceSessionId", sessionId,
                "classId", session.classId()));
        SessionMutationResult response = new SessionMutationResult(
            view(tenantId, sessionId), view(tenantId, makeupId), conflicts);
        remember(tenantId, operation, idempotencyKey, requestHash, response);
        return response;
    }

    @Transactional
    public SchedulePreview previewReschedule(UUID sessionId, ReschedulePreviewInput input) {
        UUID tenantId = actor.tenantId();
        MutationSession session = lock(tenantId, sessionId);
        requireVersion(session, input.version());
        requireMutableBeforeTeaching(session);

        List<SchedulingStore.SessionRow> sessions =
            store.scheduledSessionsFrom(tenantId, session.classId(), session.ordinal());
        if (sessions.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_SESSIONS_TO_RESCHEDULE",
                "Không có buổi nào để dời.");
        }
        List<WeeklyPattern> patterns = store.classPatterns(tenantId, session.classId());
        if (patterns.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_PATTERNS",
                "Lớp không có lịch tuần. Không thể tính slot kế tiếp.");
        }
        List<SchedulingEngine.Holiday> holidays = store.holidays(tenantId);
        List<PreviewSession> proposed = computeRescheduledSlots(sessions, patterns, holidays);

        List<ScheduleConflict> conflicts = engine.conflicts(proposed,
            store.activeStudentIds(tenantId, session.classId()),
            store.occupied(tenantId, null, session.classId()));

        return saveReschedulePreview(tenantId, session, input, proposed, conflicts);
    }

    @Transactional
    public RescheduleResult reschedule(UUID sessionId, ApplyRescheduleInput input,
                                       String idempotencyKey) {
        classService.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "RESCHEDULE_SESSION:" + sessionId;
        String requestHash = SchedulingEngine.sha256(store.json(input));
        RescheduleResult repeated = repeated(tenantId, operation, idempotencyKey,
            requestHash, RescheduleResult.class);
        if (repeated != null) {
            return repeated;
        }
        MutationSession session = lock(tenantId, sessionId);
        requireVersion(session, input.version());
        requireMutableBeforeTeaching(session);

        ReschedulePreviewInput previewInput = new ReschedulePreviewInput(input.version());
        classService.requirePreview(tenantId, input.previewId(), "SESSION", sessionId,
            rescheduleHash(sessionId, previewInput));

        List<SchedulingStore.SessionRow> sessions =
            store.scheduledSessionsFrom(tenantId, session.classId(), session.ordinal());
        List<WeeklyPattern> patterns = store.classPatterns(tenantId, session.classId());
        List<SchedulingEngine.Holiday> holidays = store.holidays(tenantId);
        List<PreviewSession> proposed = computeRescheduledSlots(sessions, patterns, holidays);

        List<ScheduleConflict> conflicts = engine.conflicts(proposed,
            store.activeStudentIds(tenantId, session.classId()),
            store.occupied(tenantId, null, session.classId()));
        classService.enforceConflicts(conflicts, input.acknowledgedWarningIds());

        // Pass 1: Set temporary session_key to avoid UNIQUE(tenant_id, class_id, session_key) collision during cascade shift
        for (SchedulingStore.SessionRow s : sessions) {
            jdbc.sql("""
                    UPDATE class_sessions
                    SET session_key = 'TEMP:' || id::text
                    WHERE tenant_id = :tenantId AND id = :sessionId
                    """)
                .param("tenantId", tenantId)
                .param("sessionId", s.id())
                .update();
        }

        // Pass 2: Update each session to its new schedule and final session_key
        LinkedHashSet<UUID> affectedTeachers = new LinkedHashSet<>();
        for (int i = 0; i < sessions.size(); i++) {
            SchedulingStore.SessionRow original = sessions.get(i);
            PreviewSession newSlot = proposed.get(i);
            String patternKey = newSlot.key().split("@")[0];
            jdbc.sql("""
                    UPDATE class_sessions
                    SET start_at=:startAt, end_at=:endAt, pattern_key=:patternKey,
                        session_key=:sessionKey, status='SCHEDULED', updated_at=now(), version=version+1
                    WHERE tenant_id=:tenantId AND id=:sessionId
                    """)
                .param("startAt", newSlot.startAt()).param("endAt", newSlot.endAt())
                .param("patternKey", patternKey)
                .param("sessionKey", newSlot.key())
                .param("tenantId", tenantId).param("sessionId", original.id())
                .update();
            affectedTeachers.add(original.actualTeacherId());
            classService.audit(tenantId, actor.userId(), "SESSION_RESCHEDULED", "SESSION",
                original.id(),
                Map.of("startAt", original.startAt(), "endAt", original.endAt()),
                Map.of("startAt", newSlot.startAt(), "endAt", newSlot.endAt()));
        }
        refreshExpectedEndDate(tenantId, session.classId());
        notifyTeachers(tenantId, List.copyOf(affectedTeachers), "SESSION_RESCHEDULED",
            "Lịch dạy đã được dời",
            "Lịch lớp " + session.className() + " đã được dời từ buổi " + session.ordinal() + ".");
        classService.outbox(tenantId, "SESSION", sessionId, "SESSION_RESCHEDULED",
            Map.of("sessionId", sessionId, "classId", session.classId(),
                "affectedSessions", sessions.size()));
        RescheduleResult response = new RescheduleResult(sessions.size(), proposed, conflicts);
        remember(tenantId, operation, idempotencyKey, requestHash, response);
        return response;
    }

    private List<PreviewSession> computeRescheduledSlots(
        List<SchedulingStore.SessionRow> sessions,
        List<WeeklyPattern> patterns,
        List<SchedulingEngine.Holiday> holidays
    ) {
        List<PreviewSession> result = new ArrayList<>();
        LocalDate cursor = sessions.get(0).startAt()
            .atZoneSameInstant(properties.zoneId()).toLocalDate().plusDays(1);
        int maxDays = properties.maxGenerationDays();
        int scanned = 0;
        for (SchedulingStore.SessionRow session : sessions) {
            boolean slotFound = false;
            while (!slotFound) {
                if (scanned++ > maxDays) {
                    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "SCHEDULE_CANNOT_COMPLETE",
                        "Không thể tìm đủ slot trong phạm vi lịch được hỗ trợ.");
                }
                final LocalDate candidateDate = cursor;
                boolean isHoliday = holidays.stream().anyMatch(h ->
                    !candidateDate.isBefore(h.startDate()) && !candidateDate.isAfter(h.endDate()));
                if (!isHoliday) {
                    WeeklyPattern matchedPattern = patterns.stream()
                        .filter(p -> p.weekday() == candidateDate.getDayOfWeek().getValue())
                        .findFirst()
                        .orElse(null);
                    if (matchedPattern != null) {
                        OffsetDateTime originalStart = session.startAt()
                            .atZoneSameInstant(properties.zoneId()).toOffsetDateTime();
                        OffsetDateTime originalEnd = session.endAt()
                            .atZoneSameInstant(properties.zoneId()).toOffsetDateTime();
                        OffsetDateTime newStart = ZonedDateTime.of(
                            candidateDate, originalStart.toLocalTime(), properties.zoneId())
                            .toOffsetDateTime();
                        OffsetDateTime newEnd = ZonedDateTime.of(
                            candidateDate, originalEnd.toLocalTime(), properties.zoneId())
                            .toOffsetDateTime();
                        String sessionKey = matchedPattern.id() + "@" + candidateDate + "#rs-" + session.id();
                        result.add(new PreviewSession(
                            sessionKey, session.ordinal(), newStart, newEnd,
                            session.actualTeacherId(), session.teacherName(),
                            session.mode(), session.roomId(), session.roomName()));
                        cursor = cursor.plusDays(1);
                        slotFound = true;
                    }
                }
                if (!slotFound) {
                    cursor = cursor.plusDays(1);
                }
            }
        }
        return List.copyOf(result);
    }

    private SchedulePreview saveReschedulePreview(UUID tenantId, MutationSession session,
                                                   ReschedulePreviewInput input,
                                                   List<PreviewSession> proposed,
                                                   List<ScheduleConflict> conflicts) {
        Instant now = Instant.now();
        LocalDate expectedEnd = proposed.get(proposed.size() - 1).startAt().toLocalDate();
        SchedulePreview preview = new SchedulePreview(
            UUID.randomUUID(), now, now.plus(properties.previewTtl()),
            rescheduleHash(session.id(), input), proposed, List.of(), expectedEnd, conflicts);
        jdbc.sql("""
                INSERT INTO schedule_previews (
                  id, tenant_id, owner_user_id, class_id, session_id, kind,
                  input_hash, input_version, result_json, created_at, expires_at
                ) VALUES (
                  :id, :tenantId, :ownerId, :classId, :sessionId, 'SESSION',
                  :hash, :hash, CAST(:result AS jsonb), :createdAt, :expiresAt
                )
                """)
            .param("id", preview.previewId()).param("tenantId", tenantId)
            .param("ownerId", actor.userId()).param("classId", session.classId())
            .param("sessionId", session.id())
            .param("hash", rescheduleHash(session.id(), input))
            .param("result", store.json(preview))
            .param("createdAt", OffsetDateTime.ofInstant(preview.generatedAt(), ZoneOffset.UTC))
            .param("expiresAt", OffsetDateTime.ofInstant(preview.expiresAt(), ZoneOffset.UTC))
            .update();
        return preview;
    }

    private String rescheduleHash(UUID sessionId, ReschedulePreviewInput input) {
        return SchedulingEngine.sha256("RESCHEDULE|" + sessionId + "|" + store.json(input));
    }

    @Transactional
    public void cancelFromVerification(UUID tenantId, UUID sessionId, UUID actorId,
                                       String reason, OffsetDateTime now) {
        MutationSession session = lock(tenantId, sessionId);
        if (!"PENDING_CONFIRMATION".equals(session.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Chỉ buổi đang chờ xác nhận mới có thể hủy trong luồng này.");
        }
        cancelLocked(session, reason, "SESSION_CANCELLED_AFTER_VERIFICATION");
        refreshExpectedEndDate(tenantId, session.classId());
        classService.audit(tenantId, actorId, "SESSION_CANCELLED_AFTER_VERIFICATION",
            "SESSION", sessionId, Map.of("status", session.status()),
            Map.of("status", "CANCELLED", "reason", reason, "cancelledAt", now));
        notifyTeachers(tenantId, List.of(session.actualTeacherId()), "SESSION_CANCELLED",
            "Buổi dạy đã bị hủy",
            "Buổi " + session.className() + " đã được quản lý hủy sau khi xác minh.");
        classService.outbox(tenantId, "SESSION", sessionId, "SESSION_CANCELLED",
            Map.of("sessionId", sessionId, "classId", session.classId(), "reason", reason));
    }

    private SchedulePreview savePreview(UUID tenantId, MutationSession session, String hash,
                                        List<PreviewSession> proposed,
                                        List<ScheduleConflict> conflicts) {
        Instant now = Instant.now();
        SchedulePreview preview = new SchedulePreview(
            UUID.randomUUID(), now, now.plus(properties.previewTtl()), hash,
            proposed, List.of(), proposed.get(0).startAt().toLocalDate(), conflicts);
        jdbc.sql("""
                INSERT INTO schedule_previews (
                  id, tenant_id, owner_user_id, class_id, session_id, kind,
                  input_hash, input_version, result_json, created_at, expires_at
                ) VALUES (
                  :id, :tenantId, :ownerId, :classId, :sessionId, 'SESSION',
                  :hash, :hash, CAST(:result AS jsonb), :createdAt, :expiresAt
                )
                """)
            .param("id", preview.previewId()).param("tenantId", tenantId)
            .param("ownerId", actor.userId()).param("classId", session.classId())
            .param("sessionId", session.id()).param("hash", hash)
            .param("result", store.json(preview))
            .param("createdAt", OffsetDateTime.ofInstant(preview.generatedAt(), ZoneOffset.UTC))
            .param("expiresAt", OffsetDateTime.ofInstant(preview.expiresAt(), ZoneOffset.UTC))
            .update();
        return preview;
    }

    private PreviewSession makeupPreviewSession(UUID tenantId, MutationSession source,
                                                MakeupScheduleInput input) {
        validateModeRoom(input.mode(), input.roomId());
        if (!input.endTime().isAfter(input.startTime())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME_RANGE",
                "Giờ kết thúc phải sau giờ bắt đầu.");
        }
        SchedulingDtos.TeacherOption teacher = store.requireTeacher(tenantId, input.teacherId());
        Map<UUID, String> rooms = store.requireRooms(tenantId, List.of(),
            List.of(new SessionOverride(source.sessionKey(), input.mode(), input.roomId())));
        OffsetDateTime start = ZonedDateTime.of(input.date(), input.startTime(), properties.zoneId())
            .toOffsetDateTime();
        OffsetDateTime end = ZonedDateTime.of(input.date(), input.endTime(), properties.zoneId())
            .toOffsetDateTime();
        if (!start.isAfter(OffsetDateTime.now(properties.zoneId()))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MAKEUP_START_IN_PAST",
                "Buổi bù phải bắt đầu trong tương lai theo múi giờ Việt Nam.");
        }
        return new PreviewSession("makeup:" + source.id(), source.ordinal(), start, end,
            teacher.id(), teacher.name(), input.mode(), input.roomId(), rooms.get(input.roomId()));
    }

    private List<ScheduleConflict> conflicts(UUID tenantId, MutationSession source,
                                             PreviewSession proposed) {
        return engine.conflicts(List.of(proposed), store.activeStudentIds(tenantId, source.classId()),
            store.occupied(tenantId, source.id(), null));
    }

    private UUID insertMakeup(MutationSession source, MakeupScheduleInput input,
                              PreviewSession proposed) {
        UUID makeupId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO class_sessions (
                  id, tenant_id, class_id, ordinal, pattern_key, session_key,
                  start_at, end_at, planned_teacher_id, actual_teacher_id,
                  mode, room_id, online_link, status, is_substitution,
                  makeup_root_session_id, replaces_session_id
                ) VALUES (
                  :id, :tenantId, :classId, :ordinal, :patternKey, :sessionKey,
                  :startAt, :endAt, :plannedTeacherId, :actualTeacherId,
                  :mode, :roomId, NULL, 'SCHEDULED', :substitution,
                  :rootSessionId, :replacesSessionId
                )
                """)
            .param("id", makeupId).param("tenantId", source.tenantId())
            .param("classId", source.classId()).param("ordinal", source.ordinal())
            .param("patternKey", "MAKEUP:" + source.id())
            .param("sessionKey", source.sessionKey() + "#makeup-" + makeupId)
            .param("startAt", proposed.startAt()).param("endAt", proposed.endAt())
            .param("plannedTeacherId", source.plannedTeacherId())
            .param("actualTeacherId", input.teacherId())
            .param("mode", input.mode().name()).param("roomId", input.roomId())
            .param("substitution", !input.teacherId().equals(source.plannedTeacherId()))
            .param("rootSessionId", rootOf(source)).param("replacesSessionId", source.id())
            .update();
        return makeupId;
    }

    private void cancelLocked(MutationSession session, String reason, String action) {
        jdbc.sql("""
                UPDATE class_sessions
                SET status='CANCELLED', cancelled_at=now(), cancelled_by=:actorId,
                    cancellation_reason=:reason, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId
                """)
            .param("actorId", actor.userId()).param("reason", reason)
            .param("tenantId", session.tenantId()).param("sessionId", session.id()).update();
        salaryAccruals.reconcile(session.tenantId(), session.id(), actor.userId(), reason);
    }

    private void refreshExpectedEndDate(UUID tenantId, UUID classId) {
        LocalDate expectedEnd = jdbc.sql("""
                SELECT max((start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                FROM class_sessions
                WHERE tenant_id=:tenantId AND class_id=:classId AND status <> 'CANCELLED'
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query(LocalDate.class).optional().orElse(null);
        jdbc.sql("""
                UPDATE classes
                SET expected_end_date=:expectedEnd, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:classId
                """)
            .param("expectedEnd", expectedEnd).param("tenantId", tenantId)
            .param("classId", classId).update();
    }

    private void notifyTeachers(UUID tenantId, List<UUID> teacherIds, String eventType,
                                String title, String body) {
        LinkedHashSet<UUID> recipients = new LinkedHashSet<>();
        for (UUID teacherId : teacherIds) {
            if (teacherId == null) {
                continue;
            }
            jdbc.sql("""
                    SELECT user_id FROM teacher_profiles
                    WHERE tenant_id=:tenantId AND id=:teacherId
                    """)
                .param("tenantId", tenantId).param("teacherId", teacherId)
                .query(UUID.class).optional().ifPresent(recipients::add);
        }
        for (UUID userId : recipients) {
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
    }

    private MutationSession lock(UUID tenantId, UUID sessionId) {
        return sessionQuery("""
                WHERE s.tenant_id=:tenantId AND s.id=:sessionId
                FOR UPDATE OF s
                """, tenantId, sessionId);
    }

    private SessionMutationView view(UUID tenantId, UUID sessionId) {
        MutationSession session = sessionQuery("""
                WHERE s.tenant_id=:tenantId AND s.id=:sessionId
                """, tenantId, sessionId);
        return new SessionMutationView(
            session.id(), session.classId(), session.classCode(), session.className(),
            session.ordinal(), session.startAt(), session.endAt(), session.plannedTeacherId(),
            session.actualTeacherId(), session.teacherName(), session.mode(), session.roomId(),
            session.roomName(), session.substitution(), session.replacesSessionId() != null,
            session.status(), session.makeupRootSessionId(), session.replacesSessionId(),
            session.replacementSessionId(), session.cancellationReason(),
            allowedActions(session), session.version());
    }

    private MutationSession sessionQuery(String where, UUID tenantId, UUID sessionId) {
        return jdbc.sql("""
                SELECT s.id, s.tenant_id, s.class_id, c.code AS class_code, c.name AS class_name,
                       s.ordinal, s.session_key, s.start_at, s.end_at, s.planned_teacher_id,
                       s.actual_teacher_id, s.mode, s.room_id, s.status, s.is_substitution,
                       s.makeup_root_session_id, s.replaces_session_id, s.cancellation_reason,
                       s.version, u.display_name AS teacher_name, r.name AS room_name,
                       EXISTS(SELECT 1 FROM session_check_ins ci
                         WHERE ci.tenant_id=s.tenant_id AND ci.session_id=s.id) AS checked_in,
                       (SELECT child.id FROM class_sessions child
                        WHERE child.tenant_id=s.tenant_id AND child.replaces_session_id=s.id
                        LIMIT 1) AS replacement_session_id
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                """ + where)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new MutationSession(
                rs.getObject("id", UUID.class), rs.getObject("tenant_id", UUID.class),
                rs.getObject("class_id", UUID.class), rs.getString("class_code"),
                rs.getString("class_name"), rs.getInt("ordinal"), rs.getString("session_key"),
                rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getObject("planned_teacher_id", UUID.class),
                rs.getObject("actual_teacher_id", UUID.class),
                SchedulingDtos.DeliveryMode.valueOf(rs.getString("mode")),
                rs.getObject("room_id", UUID.class), rs.getString("status"),
                rs.getBoolean("is_substitution"),
                rs.getObject("makeup_root_session_id", UUID.class),
                rs.getObject("replaces_session_id", UUID.class),
                rs.getObject("replacement_session_id", UUID.class),
                rs.getString("cancellation_reason"), rs.getLong("version"),
                rs.getString("teacher_name"), rs.getString("room_name"),
                rs.getBoolean("checked_in")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "SESSION_NOT_FOUND", "Không tìm thấy buổi học."));
    }

    private List<SessionAction> allowedActions(MutationSession session) {
        if ("SCHEDULED".equals(session.status()) || "PENDING_CONFIRMATION".equals(session.status())) {
            if (!session.checkedIn()) {
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

    private void requireMutableBeforeTeaching(MutationSession session) {
        if (!("SCHEDULED".equals(session.status()) || "PENDING_CONFIRMATION".equals(session.status()))) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Chỉ buổi chưa hoàn tất mới có thể thao tác.");
        }
    }

    private void requireCanPreviewMakeup(MutationSession session) {
        if ("CANCELLED".equals(session.status())) {
            requireCanCreateMakeup(session);
            return;
        }
        requireMutableBeforeTeaching(session);
    }

    private void requireCanCreateMakeup(MutationSession session) {
        if (!"CANCELLED".equals(session.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Chỉ buổi đã hủy mới có thể tạo buổi bù sau.");
        }
        if (session.replacementSessionId() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "MAKEUP_ALREADY_EXISTS",
                "Buổi này đã có buổi kế tiếp trong chuỗi dạy bù.");
        }
    }

    private UUID rootOf(MutationSession session) {
        return session.makeupRootSessionId() == null ? session.id() : session.makeupRootSessionId();
    }

    private void requireVersion(MutationSession session, Long requestedVersion) {
        if (requestedVersion == null || session.version() != requestedVersion) {
            throw new ApiException(HttpStatus.CONFLICT, "OPTIMISTIC_LOCK_CONFLICT",
                "Buổi học đã được thay đổi. Vui lòng tải lại.");
        }
    }

    private void validateModeRoom(DeliveryMode mode, UUID roomId) {
        if (mode == DeliveryMode.IN_PERSON && roomId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROOM_REQUIRED",
                "Buổi tại lớp bắt buộc chọn phòng.");
        }
        if (mode == DeliveryMode.ONLINE && roomId != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ONLINE_ROOM_NOT_ALLOWED",
                "Buổi online không được gán phòng.");
        }
    }

    private String substitutionHash(UUID sessionId, SubstitutionPreviewInput input) {
        return SchedulingEngine.sha256("SUBSTITUTE|" + sessionId + "|" + store.json(input));
    }

    private String makeupHash(UUID sessionId, MakeupPreviewInput input) {
        return SchedulingEngine.sha256("MAKEUP|" + sessionId + "|" + store.json(input));
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private <T> T repeated(UUID tenantId, String operation, String key, String requestHash,
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
        return classService.read(stored.responseJson(), responseType);
    }

    private void remember(UUID tenantId, String operation, String key, String requestHash,
                          Object response) {
        jdbc.sql("""
                INSERT INTO idempotency_records (
                  id, tenant_id, operation, idempotency_key, request_hash,
                  response_status, response_json
                ) VALUES (
                  :id, :tenantId, :operation, :key, :requestHash, 200, CAST(:response AS jsonb)
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId)
            .param("operation", operation).param("key", key)
            .param("requestHash", requestHash).param("response", store.json(response)).update();
    }

    private record StoredResponse(String requestHash, String responseJson) {
    }

    private record MutationSession(
        UUID id,
        UUID tenantId,
        UUID classId,
        String classCode,
        String className,
        int ordinal,
        String sessionKey,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        UUID plannedTeacherId,
        UUID actualTeacherId,
        DeliveryMode mode,
        UUID roomId,
        String status,
        boolean substitution,
        UUID makeupRootSessionId,
        UUID replacesSessionId,
        UUID replacementSessionId,
        String cancellationReason,
        long version,
        String teacherName,
        String roomName,
        boolean checkedIn
    ) {
    }
}
