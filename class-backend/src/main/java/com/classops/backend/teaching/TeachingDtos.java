package com.classops.backend.teaching;

import com.classops.backend.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class TeachingDtos {
    private TeachingDtos() {
    }

    public enum AttendanceStatus {
        PRESENT, LATE, LEFT_EARLY, ABSENT_EXCUSED, ABSENT_UNEXCUSED
    }

    public enum CheckInState {
        TOO_EARLY, OPEN, CHECKED_IN, WINDOW_CLOSED, COMPLETED, CANCELLED
    }

    public enum VerificationDecision {
        CONFIRM_TAUGHT, CANCEL
    }

    public record TeacherDashboardMetrics(
        long todaySessions,
        long checkInAvailable,
        long missingDocumentation,
        BigDecimal monthTeachingHours,
        BigDecimal monthAccruedSalary
    ) {
    }

    public record TodayTeachingSession(
        UUID id,
        UUID classId,
        String classCode,
        String className,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        String mode,
        String roomName,
        String status,
        CheckInState checkInState,
        OffsetDateTime checkInOpensAt,
        boolean substitution
    ) {
    }

    public record TeacherDashboardData(
        LocalDate date,
        String teacherName,
        TeacherDashboardMetrics metrics,
        List<TodayTeachingSession> sessions
    ) {
    }

    public record TeacherClassItem(
        UUID id,
        String code,
        String name,
        String status,
        String teacherRole,
        LocalDate startDate,
        LocalDate expectedEndDate,
        int completedSessions,
        int totalSessions,
        OffsetDateTime latestSessionAt
    ) {
    }

    public record TeacherClassHeader(
        UUID id,
        String code,
        String name,
        String status,
        int completedSessions,
        int totalSessions
    ) {
    }

    public record TeacherSessionSummary(
        UUID id,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        String status,
        String actualTeacherName,
        boolean actualTeacher,
        boolean readOnly,
        String lessonName,
        int participatedStudents,
        int rosterStudents,
        boolean missingDocumentation,
        int testResultCount
    ) {
    }

    public record TeacherClassSessions(
        TeacherClassHeader learningClass,
        PageResponse<TeacherSessionSummary> sessions
    ) {
    }

    public record CheckInRecord(
        OffsetDateTime checkedInAt,
        String onlineLink
    ) {
    }

    public record LessonReport(
        String lessonName,
        String lessonContent,
        String recordUrl,
        long version
    ) {
    }

    public record TestResult(
        UUID id,
        String testName,
        BigDecimal score,
        BigDecimal maxScore,
        LocalDate testDate,
        String comment,
        long version
    ) {
    }

    public record RosterStudent(
        UUID studentId,
        String code,
        String name,
        AttendanceStatus attendanceStatus,
        String attendanceNote,
        long attendanceVersion,
        String sessionComment,
        long commentVersion,
        List<TestResult> testResults
    ) {
    }

    public record SessionOperationsDetail(
        UUID id,
        UUID classId,
        String classCode,
        String className,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        String mode,
        String roomName,
        String onlineLink,
        String status,
        String actualTeacherName,
        boolean actualTeacher,
        boolean canEdit,
        boolean canVerify,
        CheckInState checkInState,
        OffsetDateTime checkInOpensAt,
        CheckInRecord checkIn,
        boolean rosterFrozen,
        String rosterRevision,
        boolean missingDocumentation,
        long version,
        LessonReport lessonReport,
        List<RosterStudent> students,
        int participatedStudents
    ) {
    }

    public record CheckInInput(
        String onlineLink,
        @NotNull Long version
    ) {
    }

    public record LessonReportInput(
        String lessonName,
        String lessonContent,
        String recordUrl,
        @Min(0) long version
    ) {
        public LessonReportInput {
            lessonName = lessonName == null ? "" : lessonName.trim();
            lessonContent = lessonContent == null ? "" : lessonContent.trim();
            recordUrl = recordUrl == null || recordUrl.isBlank() ? null : recordUrl.trim();
        }
    }

    public record StudentRecordInput(
        @NotNull UUID studentId,
        AttendanceStatus attendanceStatus,
        String attendanceNote,
        @Min(0) long attendanceVersion,
        String sessionComment,
        @Min(0) long commentVersion
    ) {
        public StudentRecordInput {
            attendanceNote = attendanceNote == null ? "" : attendanceNote.trim();
            sessionComment = sessionComment == null ? "" : sessionComment.trim();
        }
    }

    public record PedagogicalRecordInput(
        @NotBlank String rosterRevision,
        @NotNull @Valid LessonReportInput lessonReport,
        @Valid List<StudentRecordInput> students
    ) {
        public PedagogicalRecordInput {
            students = students == null ? List.of() : List.copyOf(students);
        }
    }

    public record TestResultInput(
        @NotBlank String testName,
        @NotNull @DecimalMin("0") BigDecimal score,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal maxScore,
        @NotNull LocalDate testDate,
        String comment,
        @Min(0) long version
    ) {
        public TestResultInput {
            testName = testName == null ? "" : testName.trim();
            comment = comment == null ? "" : comment.trim();
        }
    }

    public record VerificationDecisionInput(
        @NotNull VerificationDecision decision,
        @NotBlank String reason,
        @NotNull Long version
    ) {
        public VerificationDecisionInput {
            reason = reason == null ? "" : reason.trim();
        }
    }
}
