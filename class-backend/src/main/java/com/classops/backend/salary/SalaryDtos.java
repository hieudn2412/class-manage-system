package com.classops.backend.salary;

import com.classops.backend.common.PageResponse;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

public final class SalaryDtos {
    private SalaryDtos() {
    }

    public enum AccrualStatus { ACTIVE, REVERSED }
    public enum PaymentMethod { CASH, BANK_TRANSFER }
    public enum BalanceStatus { OWED, SETTLED, OVERPAID }

    public record HourlyRateView(
        UUID id,
        UUID classId,
        LocalDate effectiveDate,
        LocalDate effectiveTo,
        BigDecimal hourlyRate,
        long version,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
    ) {
    }

    public record CreateHourlyRateInput(
        @NotNull LocalDate effectiveDate,
        @NotNull @DecimalMin(value = "0.01") BigDecimal hourlyRate,
        @NotBlank @Size(max = 1000) String reason
    ) {
    }

    public record UpdateHourlyRateInput(
        @NotNull LocalDate effectiveDate,
        @NotNull @DecimalMin(value = "0.01") BigDecimal hourlyRate,
        @NotBlank @Size(max = 1000) String reason,
        @NotNull Long version
    ) {
    }

    public record CompletionCorrectionInput(
        @NotNull OffsetDateTime startAt,
        @NotNull OffsetDateTime endAt,
        @NotNull UUID actualTeacherId,
        @NotBlank @Size(max = 1000) String reason,
        @NotNull Long version
    ) {
    }

    public record CompletionCorrectionView(
        UUID sessionId,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        UUID actualTeacherId,
        long version,
        BigDecimal salaryAmount,
        long salaryRevision
    ) {
    }

    public record CreateAdjustmentInput(
        @NotNull UUID teacherId,
        @NotNull YearMonth salaryMonth,
        @NotNull BigDecimal amount,
        @NotBlank @Size(max = 1000) String reason
    ) {
    }

    public record UpdateAdjustmentInput(
        @NotNull UUID teacherId,
        @NotNull YearMonth salaryMonth,
        @NotNull BigDecimal amount,
        @NotBlank @Size(max = 1000) String reason,
        @NotBlank @Size(max = 1000) String editReason,
        @NotNull Long version
    ) {
    }

    public record CreatePaymentInput(
        @NotNull UUID teacherId,
        @NotNull YearMonth salaryMonth,
        @NotNull LocalDate paidAt,
        @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
        @NotNull PaymentMethod method,
        @Size(max = 250) String reference,
        boolean confirmOverpayment,
        @Size(max = 1000) String overpaymentReason
    ) {
    }

    public record UpdatePaymentInput(
        @NotNull UUID teacherId,
        @NotNull YearMonth salaryMonth,
        @NotNull LocalDate paidAt,
        @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
        @NotNull PaymentMethod method,
        @Size(max = 250) String reference,
        boolean confirmOverpayment,
        @Size(max = 1000) String overpaymentReason,
        @NotBlank @Size(max = 1000) String editReason,
        @NotNull Long version
    ) {
    }

    public record SalaryAdjustmentView(
        UUID id,
        UUID teacherId,
        String teacherName,
        YearMonth salaryMonth,
        BigDecimal amount,
        String reason,
        long version,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
    ) {
    }

    public record SalaryPaymentView(
        UUID id,
        UUID teacherId,
        String teacherName,
        YearMonth salaryMonth,
        LocalDate paidAt,
        BigDecimal amount,
        PaymentMethod method,
        String reference,
        String overpaymentReason,
        long version,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
    ) {
    }

    public record SalaryAccrualLine(
        UUID id,
        UUID sessionId,
        String classCode,
        String className,
        int ordinal,
        LocalDate sessionDate,
        int scheduledMinutes,
        BigDecimal hourlyRate,
        BigDecimal amount,
        long revision,
        AccrualStatus status,
        boolean substitution
    ) {
    }

    public record TeacherPayrollMetrics(
        long sessionCount,
        long totalMinutes,
        BigDecimal accrued,
        BigDecimal adjustments,
        BigDecimal due,
        BigDecimal paid,
        BigDecimal outstanding,
        BalanceStatus status
    ) {
    }

    public record PayrollTeacherRow(
        UUID teacherId,
        String teacherName,
        long sessionCount,
        long totalMinutes,
        BigDecimal accrued,
        BigDecimal adjustments,
        BigDecimal due,
        BigDecimal paid,
        BigDecimal outstanding,
        BalanceStatus status
    ) {
    }

    public record PayrollMetrics(
        long teacherCount,
        long sessionCount,
        long totalMinutes,
        BigDecimal accrued,
        BigDecimal adjustments,
        BigDecimal due,
        BigDecimal paid,
        BigDecimal outstanding,
        long overpaidTeachers
    ) {
    }

    public record PayrollPage(
        YearMonth month,
        PayrollMetrics metrics,
        PageResponse<PayrollTeacherRow> teachers
    ) {
    }

    public record TeacherPayrollDetail(
        YearMonth month,
        UUID teacherId,
        String teacherName,
        TeacherPayrollMetrics metrics,
        List<SalaryAccrualLine> accruals,
        List<SalaryAdjustmentView> adjustments,
        List<SalaryPaymentView> payments
    ) {
    }

    public record SalaryMonthSummary(
        YearMonth month,
        BigDecimal accrued,
        BigDecimal adjustments,
        BigDecimal due,
        BigDecimal paidBySalaryMonth,
        BigDecimal paidCashFlow,
        BigDecimal outstanding
    ) {
    }

    public record SalaryYearSummary(int year, List<SalaryMonthSummary> months) {
    }
}
