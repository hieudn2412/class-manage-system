package com.classops.backend.scheduling;

import com.classops.backend.common.ApiException;
import com.classops.backend.scheduling.SchedulingDtos.ClassDraftInput;
import com.classops.backend.scheduling.SchedulingDtos.DeliveryMode;
import com.classops.backend.scheduling.SchedulingDtos.ExistingSessionSummary;
import com.classops.backend.scheduling.SchedulingDtos.PreviewSession;
import com.classops.backend.scheduling.SchedulingDtos.ScheduleConflict;
import com.classops.backend.scheduling.SchedulingDtos.SessionOverride;
import com.classops.backend.scheduling.SchedulingDtos.SkippedHoliday;
import com.classops.backend.scheduling.SchedulingDtos.WeeklyPattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
public class SchedulingEngine {
    private final SchedulingProperties properties;

    public SchedulingEngine(SchedulingProperties properties) {
        this.properties = properties;
    }

    public GenerationResult generate(
        ClassDraftInput input,
        String teacherName,
        Map<UUID, String> roomNames,
        List<Holiday> holidays,
        List<OccupiedSession> occupied
    ) {
        validate(input, roomNames);
        Map<String, SessionOverride> overrides = new HashMap<>();
        for (SessionOverride override : input.overrides()) {
            overrides.put(override.sessionKey(), override);
        }
        List<WeeklyPattern> orderedPatterns = input.patterns().stream()
            .sorted(Comparator.comparingInt(WeeklyPattern::weekday)
                .thenComparing(WeeklyPattern::startTime)
                .thenComparing(WeeklyPattern::id))
            .toList();
        List<PreviewSession> generated = new ArrayList<>();
        List<SkippedHoliday> skipped = new ArrayList<>();
        LocalDate date = input.startDate();
        int scannedDays = 0;
        while (generated.size() < input.totalSessions()) {
            if (scannedDays++ > properties.maxGenerationDays()) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "SCHEDULE_CANNOT_COMPLETE",
                    "Không thể sinh đủ số buổi trong phạm vi lịch được hỗ trợ.");
            }
            final LocalDate candidateDate = date;
            List<WeeklyPattern> patterns = orderedPatterns.stream()
                .filter(pattern -> pattern.weekday() == candidateDate.getDayOfWeek().getValue())
                .sorted(Comparator.comparing(WeeklyPattern::startTime).thenComparing(WeeklyPattern::id))
                .toList();
            for (WeeklyPattern pattern : patterns) {
                if (generated.size() >= input.totalSessions()) {
                    break;
                }
                Holiday holiday = holidayAt(candidateDate, holidays);
                if (holiday != null) {
                    skipped.add(new SkippedHoliday(candidateDate, holiday.id(), holiday.name(), pattern.id()));
                    continue;
                }
                String sessionKey = pattern.id() + "@" + candidateDate;
                SessionOverride override = overrides.get(sessionKey);
                DeliveryMode mode = override == null ? pattern.mode() : override.mode();
                UUID roomId = override == null ? pattern.roomId() : override.roomId();
                validateModeRoom(mode, roomId, roomNames, "overrides");
                ZoneId zone = properties.zoneId();
                OffsetDateTime start = ZonedDateTime.of(candidateDate, pattern.startTime(), zone)
                    .toOffsetDateTime();
                OffsetDateTime end = ZonedDateTime.of(candidateDate, pattern.endTime(), zone)
                    .toOffsetDateTime();
                generated.add(new PreviewSession(
                    sessionKey, generated.size() + 1, start, end,
                    input.primaryTeacherId(), teacherName, mode, roomId,
                    roomId == null ? null : roomNames.get(roomId)));
            }
            date = date.plusDays(1);
        }
        List<ScheduleConflict> conflicts = conflicts(generated, input.studentIds(), occupied);
        return new GenerationResult(List.copyOf(generated), List.copyOf(skipped),
            generated.get(generated.size() - 1).startAt().toLocalDate(), conflicts);
    }

    private void validate(ClassDraftInput input, Map<UUID, String> roomNames) {
        if (input.patterns().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PATTERN_REQUIRED",
                "Cần ít nhất một ca lặp để xem trước lịch.");
        }
        Set<String> ids = new HashSet<>();
        for (WeeklyPattern pattern : input.patterns()) {
            if (!ids.add(pattern.id())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_PATTERN_ID",
                    "Mã ca lặp không được trùng.");
            }
            if (!pattern.endTime().isAfter(pattern.startTime())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME_RANGE",
                    "Giờ kết thúc phải sau giờ bắt đầu.");
            }
            validateModeRoom(pattern.mode(), pattern.roomId(), roomNames, "patterns");
        }
    }

    private void validateModeRoom(DeliveryMode mode, UUID roomId, Map<UUID, String> roomNames,
                                  String field) {
        if (mode == DeliveryMode.IN_PERSON && roomId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROOM_REQUIRED",
                "Ca tại lớp bắt buộc chọn phòng.", Map.of("field", field));
        }
        if (mode == DeliveryMode.ONLINE && roomId != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ONLINE_ROOM_NOT_ALLOWED",
                "Ca online không được gán phòng.", Map.of("field", field));
        }
        if (roomId != null && !roomNames.containsKey(roomId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROOM_NOT_FOUND",
                "Phòng không tồn tại trong trung tâm.", Map.of("roomId", roomId));
        }
    }

    private Holiday holidayAt(LocalDate date, List<Holiday> holidays) {
        return holidays.stream()
            .filter(item -> !date.isBefore(item.startDate()) && !date.isAfter(item.endDate()))
            .findFirst().orElse(null);
    }

    public List<ScheduleConflict> conflicts(List<PreviewSession> proposed,
                                            List<UUID> selectedStudents,
                                            List<OccupiedSession> occupied) {
        LinkedHashMap<String, ScheduleConflict> conflicts = new LinkedHashMap<>();
        for (int i = 0; i < proposed.size(); i++) {
            PreviewSession current = proposed.get(i);
            for (int j = 0; j < i; j++) {
                PreviewSession previous = proposed.get(j);
                if (!overlaps(current.startAt(), current.endAt(), previous.startAt(), previous.endAt())) {
                    continue;
                }
                if (current.teacherId().equals(previous.teacherId())) {
                    add(conflicts, "TEACHER_OVERLAP", "BLOCKING", current, List.of(),
                        synthetic(previous));
                }
                if (current.mode() == DeliveryMode.IN_PERSON
                    && previous.mode() == DeliveryMode.IN_PERSON
                    && current.roomId().equals(previous.roomId())) {
                    add(conflicts, "ROOM_OVERLAP", "BLOCKING", current, List.of(),
                        synthetic(previous));
                }
            }
            for (OccupiedSession existing : occupied) {
                if (!overlaps(current.startAt(), current.endAt(), existing.startAt(), existing.endAt())) {
                    continue;
                }
                ExistingSessionSummary summary = existing.summary();
                if (current.teacherId().equals(existing.teacherId())) {
                    add(conflicts, "TEACHER_OVERLAP", "BLOCKING", current, List.of(), summary);
                }
                if (current.mode() == DeliveryMode.IN_PERSON
                    && existing.mode() == DeliveryMode.IN_PERSON
                    && current.roomId() != null
                    && current.roomId().equals(existing.roomId())) {
                    add(conflicts, "ROOM_OVERLAP", "BLOCKING", current, List.of(), summary);
                }
                List<String> names = existing.students().entrySet().stream()
                    .filter(entry -> selectedStudents.contains(entry.getKey()))
                    .map(Map.Entry::getValue)
                    .sorted()
                    .toList();
                if (!names.isEmpty()) {
                    add(conflicts, "STUDENT_OVERLAP", "WARNING", current, names, summary);
                }
            }
        }
        return List.copyOf(conflicts.values());
    }

    private ExistingSessionSummary synthetic(PreviewSession session) {
        return new ExistingSessionSummary(null, "DRAFT", "Lớp đang tạo",
            session.startAt(), session.endAt(), session.teacherName(), session.roomName());
    }

    private void add(Map<String, ScheduleConflict> target, String code, String severity,
                     PreviewSession current, List<String> names, ExistingSessionSummary existing) {
        String raw = code + "|" + current.key() + "|"
            + (existing.sessionId() == null ? existing.startAt() : existing.sessionId()) + "|" + names;
        String id = sha256(raw).substring(0, 24);
        target.putIfAbsent(id, new ScheduleConflict(
            id, code, severity, current.key(), List.copyOf(names), existing));
    }

    public static boolean overlaps(OffsetDateTime start, OffsetDateTime end,
                                   OffsetDateTime otherStart, OffsetDateTime otherEnd) {
        return start.isBefore(otherEnd) && end.isAfter(otherStart);
    }

    public static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public record Holiday(UUID id, String name, LocalDate startDate, LocalDate endDate) {
    }

    public record OccupiedSession(
        UUID teacherId,
        UUID roomId,
        DeliveryMode mode,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        ExistingSessionSummary summary,
        Map<UUID, String> students
    ) {
    }

    public record GenerationResult(
        List<PreviewSession> sessions,
        List<SkippedHoliday> skippedHolidays,
        LocalDate expectedEndDate,
        List<ScheduleConflict> conflicts
    ) {
    }
}
