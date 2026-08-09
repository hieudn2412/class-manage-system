package com.classops.backend.classlifecycle;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class LifecycleDtos {
    private LifecycleDtos() {
    }

    public record WarningItem(String id, String code, String message,
                              List<UUID> studentIds) {
        public WarningItem {
            studentIds = studentIds == null ? List.of() : List.copyOf(studentIds);
        }
    }

    public record StudentSummary(UUID id, String code, String name,
                                 String parentName, String parentPhone) {
    }

    public record EnrollmentItem(
        UUID id,
        StudentSummary student,
        String status,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String endReason,
        UUID tuitionChargeId,
        BigDecimal originalTuitionAmount,
        String tuitionStatus,
        long version
    ) {
    }

    public record EnrollmentCandidate(UUID id, String code, String name,
                                      String parentName, String parentPhone) {
    }

    public record AddEnrollmentsInput(
        @NotEmpty List<@NotNull UUID> studentIds,
        @PositiveOrZero long classVersion,
        List<String> acknowledgedWarningIds
    ) {
        public AddEnrollmentsInput {
            studentIds = studentIds == null ? List.of() : List.copyOf(studentIds);
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record AddEnrollmentsResult(List<EnrollmentItem> enrollments, long classVersion) {
        public AddEnrollmentsResult {
            enrollments = List.copyOf(enrollments);
        }
    }

    public record EndEnrollmentInput(
        @NotBlank String targetStatus,
        @NotBlank String reason,
        @PositiveOrZero long classVersion,
        @PositiveOrZero long enrollmentVersion
    ) {
    }

    public record EndEnrollmentResult(EnrollmentItem enrollment, long classVersion) {
    }

    public record ChangeClassStatusInput(
        @NotBlank String targetStatus,
        String reason,
        @PositiveOrZero long version,
        List<String> acknowledgedWarningIds
    ) {
        public ChangeClassStatusInput {
            acknowledgedWarningIds = acknowledgedWarningIds == null
                ? List.of() : List.copyOf(acknowledgedWarningIds);
        }
    }

    public record ChangeClassStatusResult(
        UUID classId,
        String status,
        long version,
        int cancelledFutureSessions,
        List<WarningItem> acknowledgedWarnings
    ) {
        public ChangeClassStatusResult {
            acknowledgedWarnings = List.copyOf(acknowledgedWarnings);
        }
    }

    public record StudentClassItem(
        UUID id,
        String code,
        String name,
        String teacherName,
        String scheduleSummary,
        String status,
        String access,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        int completedSessions,
        int totalSessions,
        LocalDate expectedEndDate
    ) {
    }

    public record StudentClassDetail(
        UUID id,
        String code,
        String name,
        String description,
        String teacherName,
        String scheduleSummary,
        String status,
        int completedSessions,
        int totalSessions,
        LocalDate expectedEndDate
    ) {
    }

    public record StudentSessionItem(
        UUID id,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        String status,
        String teacherName,
        String lessonName,
        String lessonContent,
        String attendanceStatus,
        String attendanceNote,
        String recordUrl,
        String comment,
        StudentTestResult testResult
    ) {
    }

    public record StudentTestResult(
        UUID id,
        String testName,
        BigDecimal score,
        BigDecimal maxScore,
        LocalDate testDate,
        String comment,
        String testComment
    ) {
    }
}
