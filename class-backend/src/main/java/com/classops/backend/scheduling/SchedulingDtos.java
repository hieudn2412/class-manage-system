package com.classops.backend.scheduling;

import com.classops.backend.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class SchedulingDtos {
    private SchedulingDtos() {
    }

    public enum DeliveryMode {
        IN_PERSON, ONLINE
    }

    public enum ScheduleState {
        UPCOMING, TAUGHT, MISSING_CHECK_IN, CANCELLED
    }

    public enum SessionAction {
        SUBSTITUTE_TEACHER, CANCEL_SESSION, CREATE_MAKEUP, RESCHEDULE_SESSION
    }

    public record TeacherOption(UUID id, String name) {
    }

    public record RoomOption(UUID id, String code, String name, int capacity, String status) {
    }

    public record StudentOption(UUID id, String code, String name) {
    }

    public record SchedulingOptions(List<TeacherOption> teachers, List<RoomOption> rooms) {
    }

    public record WeeklyPattern(
        @NotBlank String id,
        @Min(1) @Max(7) int weekday,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotNull DeliveryMode mode,
        UUID roomId
    ) {
    }

    public record SessionOverride(
        @NotBlank String sessionKey,
        @NotNull DeliveryMode mode,
        UUID roomId
    ) {
    }

    public record ClassDraftInput(
        @NotBlank String name,
        String description,
        @NotNull UUID primaryTeacherId,
        @NotNull LocalDate startDate,
        @Positive int totalSessions,
        @NotNull @DecimalMin(value = "0.01") BigDecimal tuitionAmount,
        @NotNull @DecimalMin(value = "0.01") BigDecimal hourlyRate,
        @Positive Integer capacity,
        @NotNull DeliveryMode defaultMode,
        List<UUID> studentIds,
        @Valid List<WeeklyPattern> patterns,
        @Valid List<SessionOverride> overrides
    ) {
        public ClassDraftInput {
            description = description == null ? "" : description;
            studentIds = studentIds == null ? List.of() : List.copyOf(studentIds);
            patterns = patterns == null ? List.of() : List.copyOf(patterns);
            overrides = overrides == null ? List.of() : List.copyOf(overrides);
        }
    }

    public record ClassDraftRecord(
        UUID id,
        String code,
        String status,
        String name,
        String description,
        UUID primaryTeacherId,
        LocalDate startDate,
        int totalSessions,
        BigDecimal tuitionAmount,
        BigDecimal hourlyRate,
        Integer capacity,
        DeliveryMode defaultMode,
        List<UUID> studentIds,
        List<WeeklyPattern> patterns,
        List<SessionOverride> overrides,
        long version
    ) {
    }

    public record ExistingSessionSummary(
        UUID sessionId,
        String classCode,
        String className,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        String teacherName,
        String roomName
    ) {
    }

    public record ScheduleConflict(
        String id,
        String code,
        String severity,
        String proposedSessionKey,
        List<String> studentNames,
        ExistingSessionSummary conflictingSession
    ) {
    }

    public record PreviewSession(
        String key,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        UUID teacherId,
        String teacherName,
        DeliveryMode mode,
        UUID roomId,
        String roomName
    ) {
    }

    public record SkippedHoliday(
        LocalDate date,
        UUID holidayId,
        String holidayName,
        String patternId
    ) {
    }

    public record SchedulePreview(
        UUID previewId,
        Instant generatedAt,
        Instant expiresAt,
        String inputVersion,
        List<PreviewSession> sessions,
        List<SkippedHoliday> skippedHolidays,
        LocalDate expectedEndDate,
        List<ScheduleConflict> conflicts
    ) {
    }

    public record PublishClassInput(
        @NotNull UUID previewId,
        List<String> acknowledgedWarningIds
    ) {
        public PublishClassInput {
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record SessionScheduleInput(
        @NotNull DeliveryMode mode,
        UUID roomId,
        @NotNull Long version
    ) {
    }

    public record ApplySessionScheduleInput(
        @NotNull DeliveryMode mode,
        UUID roomId,
        @NotNull Long version,
        @NotNull UUID previewId,
        List<String> acknowledgedWarningIds
    ) {
        public ApplySessionScheduleInput {
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record SubstitutionPreviewInput(
        @NotNull UUID teacherId,
        String note,
        @NotNull Long version
    ) {
        public SubstitutionPreviewInput {
            note = note == null ? "" : note.trim();
        }
    }

    public record ApplySubstitutionInput(
        @NotNull UUID teacherId,
        String note,
        @NotNull Long version,
        @NotNull UUID previewId,
        List<String> acknowledgedWarningIds
    ) {
        public ApplySubstitutionInput {
            note = note == null ? "" : note.trim();
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record MakeupScheduleInput(
        @NotNull LocalDate date,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotNull UUID teacherId,
        @NotNull DeliveryMode mode,
        UUID roomId
    ) {
    }

    public record MakeupPreviewInput(
        @Valid @NotNull MakeupScheduleInput makeup,
        @NotNull Long version
    ) {
    }

    public record CancelSessionInput(
        @NotBlank String reason,
        @NotNull Long version,
        @Valid MakeupScheduleInput makeup,
        UUID previewId,
        List<String> acknowledgedWarningIds
    ) {
        public CancelSessionInput {
            reason = reason == null ? "" : reason.trim();
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record CreateMakeupInput(
        @NotNull Long version,
        @NotNull UUID previewId,
        @Valid @NotNull MakeupScheduleInput makeup,
        List<String> acknowledgedWarningIds
    ) {
        public CreateMakeupInput {
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record ReschedulePreviewInput(
        @NotNull Long version
    ) {
    }

    public record ApplyRescheduleInput(
        @NotNull Long version,
        @NotNull UUID previewId,
        List<String> acknowledgedWarningIds
    ) {
        public ApplyRescheduleInput {
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record RescheduleResult(
        int affectedSessions,
        List<PreviewSession> rescheduledSessions,
        List<ScheduleConflict> conflicts
    ) {
        public RescheduleResult {
            rescheduledSessions = List.copyOf(rescheduledSessions);
            conflicts = conflicts == null ? List.of() : List.copyOf(conflicts);
        }
    }

    public record CalendarSession(
        UUID id,
        UUID classId,
        String classCode,
        String className,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        UUID plannedTeacherId,
        UUID actualTeacherId,
        String teacherName,
        DeliveryMode mode,
        UUID roomId,
        String roomName,
        String onlineUrl,
        boolean isSubstitution,
        boolean isMakeup,
        String status,
        ScheduleState scheduleState,
        UUID makeupRootSessionId,
        UUID replacesSessionId,
        UUID replacementSessionId,
        String cancellationReason,
        List<SessionAction> allowedActions,
        long version
    ) {
        public CalendarSession {
            allowedActions = allowedActions == null ? List.of() : List.copyOf(allowedActions);
        }
    }

    public record SessionMutationView(
        UUID id,
        UUID classId,
        String classCode,
        String className,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        UUID plannedTeacherId,
        UUID actualTeacherId,
        String teacherName,
        DeliveryMode mode,
        UUID roomId,
        String roomName,
        boolean isSubstitution,
        boolean isMakeup,
        String status,
        UUID makeupRootSessionId,
        UUID replacesSessionId,
        UUID replacementSessionId,
        String cancellationReason,
        List<SessionAction> allowedActions,
        long version
    ) {
        public SessionMutationView {
            allowedActions = allowedActions == null ? List.of() : List.copyOf(allowedActions);
        }
    }

    public record SessionMutationResult(
        SessionMutationView source,
        SessionMutationView makeup,
        List<ScheduleConflict> conflicts
    ) {
        public SessionMutationResult {
            conflicts = conflicts == null ? List.of() : List.copyOf(conflicts);
        }
    }

    public record WeekSchedule(
        LocalDate weekStart,
        LocalDate weekEnd,
        List<CalendarSession> sessions,
        boolean canManageSessionSchedule
    ) {
    }

    public record ClassListItem(
        UUID id,
        String code,
        String name,
        TeacherOption teacher,
        String scheduleSummary,
        int completedSessions,
        int totalSessions,
        LocalDate expectedEndDate,
        String status,
        List<String> sessionMonths
    ) {
    }

    public record ClassSessionSummary(
        UUID id,
        int ordinal,
        OffsetDateTime startAt,
        String lessonName,
        String teacherName,
        BigDecimal attendanceRate,
        String recordStatus,
        String recordUrl
    ) {
    }

    public record CloseReadinessWarning(String id, String code, String message) {
    }

    public record CloseReadiness(
        int missingAttendanceCount,
        int missingRecordCount,
        List<CloseReadinessWarning> warnings
    ) {
        public CloseReadiness {
            warnings = List.copyOf(warnings);
        }
    }

    public record ClassDetail(
        UUID id,
        String code,
        String name,
        TeacherOption teacher,
        String scheduleSummary,
        int completedSessions,
        int totalSessions,
        LocalDate expectedEndDate,
        String status,
        List<String> sessionMonths,
        BigDecimal hourlyRate,
        BigDecimal attendanceRate,
        BigDecimal homeworkCompletionRate,
        String currentLesson,
        String room,
        String deliveryMode,
        int studentCount,
        List<String> outstandingItems,
        List<ClassSessionSummary> sessions,
        long version,
        List<String> allowedTransitions,
        CloseReadiness closeReadiness,
        int futureSessionCount
    ) {
        public ClassDetail {
            allowedTransitions = List.copyOf(allowedTransitions);
        }
    }
}
