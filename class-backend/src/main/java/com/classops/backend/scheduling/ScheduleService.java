package com.classops.backend.scheduling;

import com.classops.backend.common.ApiException;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.scheduling.SchedulingDtos.ApplySessionScheduleInput;
import com.classops.backend.scheduling.SchedulingDtos.CalendarSession;
import com.classops.backend.scheduling.SchedulingDtos.DeliveryMode;
import com.classops.backend.scheduling.SchedulingDtos.PreviewSession;
import com.classops.backend.scheduling.SchedulingDtos.ScheduleConflict;
import com.classops.backend.scheduling.SchedulingDtos.SchedulePreview;
import com.classops.backend.scheduling.SchedulingDtos.SessionOverride;
import com.classops.backend.scheduling.SchedulingDtos.SessionScheduleInput;
import com.classops.backend.scheduling.SchedulingDtos.WeekSchedule;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ScheduleService {
    private final SchedulingStore store;
    private final SchedulingEngine engine;
    private final SchedulingProperties properties;
    private final ClassSchedulingService classService;
    private final CurrentActor actor;
    private final JdbcClient jdbc;

    public ScheduleService(SchedulingStore store, SchedulingEngine engine,
                           SchedulingProperties properties, ClassSchedulingService classService,
                           CurrentActor actor, JdbcClient jdbc) {
        this.store = store;
        this.engine = engine;
        this.properties = properties;
        this.classService = classService;
        this.actor = actor;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public WeekSchedule management(LocalDate weekStart, UUID teacherId, UUID roomId) {
        validateMonday(weekStart);
        boolean canManage = actor.hasPermission("MANAGE_SESSION_SCHEDULE");
        return new WeekSchedule(weekStart, weekStart.plusDays(6),
            store.calendar(actor.tenantId(), weekStart, teacherId, roomId, canManage),
            canManage);
    }

    @Transactional(readOnly = true)
    public WeekSchedule mine(LocalDate weekStart) {
        validateMonday(weekStart);
        UUID teacherId = store.teacherProfileIdForUser(actor.tenantId(), actor.userId());
        return new WeekSchedule(weekStart, weekStart.plusDays(6),
            store.calendar(actor.tenantId(), weekStart, teacherId, null, false), false);
    }

    @Transactional
    public SchedulePreview previewOverride(UUID sessionId, SessionScheduleInput input) {
        UUID tenantId = actor.tenantId();
        SchedulingStore.SessionRow session = store.sessionForUpdate(tenantId, sessionId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND",
                "Không tìm thấy buổi học."));
        requireVersion(session, input.version());
        Map<UUID, String> rooms = store.requireRooms(tenantId, List.of(),
            List.of(new SessionOverride(session.sessionKey(), input.mode(), input.roomId())));
        validateModeRoom(input.mode(), input.roomId());
        PreviewSession proposed = new PreviewSession(
            session.sessionKey(), session.ordinal(), session.startAt(), session.endAt(),
            session.actualTeacherId(), session.teacherName(), input.mode(), input.roomId(),
            rooms.get(input.roomId()));
        List<ScheduleConflict> conflicts = engine.conflicts(
            List.of(proposed), store.activeStudentIds(tenantId, session.classId()),
            store.occupied(tenantId, sessionId, null));
        Instant now = Instant.now();
        String hash = overrideHash(sessionId, input);
        SchedulePreview preview = new SchedulePreview(
            UUID.randomUUID(), now, now.plus(properties.previewTtl()), hash,
            List.of(proposed), List.of(), proposed.startAt().toLocalDate(), conflicts);
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
            .param("sessionId", sessionId).param("hash", hash)
            .param("result", store.json(preview))
            .param("createdAt", OffsetDateTime.ofInstant(preview.generatedAt(), ZoneOffset.UTC))
            .param("expiresAt", OffsetDateTime.ofInstant(preview.expiresAt(), ZoneOffset.UTC)).update();
        return preview;
    }

    @Transactional
    public WeekSchedule applyOverride(UUID sessionId, ApplySessionScheduleInput input,
                                      String idempotencyKey) {
        classService.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        SchedulingStore.SessionRow session = store.sessionForUpdate(tenantId, sessionId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND",
                "Không tìm thấy buổi học."));
        String operation = "OVERRIDE_SESSION:" + sessionId;
        String requestHash = SchedulingEngine.sha256(store.json(input));
        StoredResponse repeated = jdbc.sql("""
                SELECT request_hash, response_json::text AS response_json
                FROM idempotency_records
                WHERE tenant_id=:tenantId AND operation=:operation AND idempotency_key=:key
                """)
            .param("tenantId", tenantId).param("operation", operation).param("key", idempotencyKey)
            .query((rs, row) -> new StoredResponse(
                rs.getString("request_hash"), rs.getString("response_json")))
            .optional().orElse(null);
        if (repeated != null) {
            if (!repeated.requestHash().equals(requestHash)) {
                throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key đã được dùng với dữ liệu khác.");
            }
            return classService.read(repeated.responseJson(), WeekSchedule.class);
        }
        requireVersion(session, input.version());
        validateModeRoom(input.mode(), input.roomId());
        Map<UUID, String> rooms = store.requireRooms(tenantId, List.of(),
            List.of(new SessionOverride(session.sessionKey(), input.mode(), input.roomId())));
        SessionScheduleInput previewInput = new SessionScheduleInput(
            input.mode(), input.roomId(), input.version());
        classService.requirePreview(tenantId, input.previewId(), "SESSION", sessionId,
            overrideHash(sessionId, previewInput));
        PreviewSession proposed = new PreviewSession(
            session.sessionKey(), session.ordinal(), session.startAt(), session.endAt(),
            session.actualTeacherId(), session.teacherName(), input.mode(), input.roomId(),
            rooms.get(input.roomId()));
        List<ScheduleConflict> conflicts = engine.conflicts(
            List.of(proposed), store.activeStudentIds(tenantId, session.classId()),
            store.occupied(tenantId, sessionId, null));
        classService.enforceConflicts(conflicts, input.acknowledgedWarningIds());
        int updated = jdbc.sql("""
                UPDATE class_sessions
                SET mode=:mode, room_id=:roomId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId AND version=:version
                """)
            .param("mode", input.mode().name()).param("roomId", input.roomId())
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .param("version", input.version()).update();
        if (updated == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "OPTIMISTIC_LOCK_CONFLICT",
                "Buổi học đã được người khác thay đổi. Vui lòng tải lại.");
        }
        classService.audit(tenantId, actor.userId(), "SESSION_SCHEDULE_OVERRIDDEN", "SESSION",
            sessionId, Map.of("mode", session.mode(), "roomId",
                session.roomId() == null ? "" : session.roomId()),
            Map.of("mode", input.mode(), "roomId", input.roomId() == null ? "" : input.roomId()));
        classService.outbox(tenantId, "SESSION", sessionId, "SESSION_SCHEDULE_CHANGED",
            Map.of("sessionId", sessionId, "classId", session.classId()));
        notifyParticipants(tenantId, session.classId(), sessionId);
        LocalDate weekStart = session.startAt().toLocalDate()
            .with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        WeekSchedule response = new WeekSchedule(weekStart, weekStart.plusDays(6),
            store.calendar(tenantId, weekStart, null, null, true), true);
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

    private void notifyParticipants(UUID tenantId, UUID classId, UUID sessionId) {
        for (UUID userId : store.classParticipantUserIds(tenantId, classId)) {
            jdbc.sql("""
                    INSERT INTO notifications (
                      id, tenant_id, recipient_user_id, event_type, title, body
                    ) VALUES (
                      :id, :tenantId, :userId, 'SESSION_SCHEDULE_CHANGED',
                      'Lịch học đã thay đổi', :body
                    )
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("userId", userId)
                .param("body", "Hình thức hoặc phòng học của buổi " + sessionId + " đã thay đổi.")
                .update();
        }
    }

    private String overrideHash(UUID sessionId, SessionScheduleInput input) {
        return SchedulingEngine.sha256(sessionId + "|" + store.json(input));
    }

    private void requireVersion(SchedulingStore.SessionRow session, Long requestedVersion) {
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

    private void validateMonday(LocalDate weekStart) {
        if (weekStart == null || weekStart.getDayOfWeek() != java.time.DayOfWeek.MONDAY) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WEEK_START",
                "weekStart phải là Thứ Hai.");
        }
    }

    private record StoredResponse(String requestHash, String responseJson) {
    }
}
