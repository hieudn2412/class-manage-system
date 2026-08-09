package com.classops.backend.salary;

import com.classops.backend.salary.SalaryDtos.CompletionCorrectionInput;
import com.classops.backend.salary.SalaryDtos.CompletionCorrectionView;
import com.classops.backend.salary.SalaryDtos.CreateAdjustmentInput;
import com.classops.backend.salary.SalaryDtos.CreateHourlyRateInput;
import com.classops.backend.salary.SalaryDtos.CreatePaymentInput;
import com.classops.backend.salary.SalaryDtos.HourlyRateView;
import com.classops.backend.salary.SalaryDtos.PayrollPage;
import com.classops.backend.salary.SalaryDtos.SalaryAdjustmentView;
import com.classops.backend.salary.SalaryDtos.SalaryPaymentView;
import com.classops.backend.salary.SalaryDtos.SalaryYearSummary;
import com.classops.backend.salary.SalaryDtos.TeacherPayrollDetail;
import com.classops.backend.salary.SalaryDtos.UpdateAdjustmentInput;
import com.classops.backend.salary.SalaryDtos.UpdateHourlyRateInput;
import com.classops.backend.salary.SalaryDtos.UpdatePaymentInput;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Salary and payroll")
@SecurityRequirement(name = "bearerAuth")
public class SalaryController {
    private final SalaryService service;
    private final SalaryExportService exportService;

    public SalaryController(SalaryService service, SalaryExportService exportService) {
        this.service = service;
        this.exportService = exportService;
    }

    @GetMapping("/classes/{classId}/hourly-rates")
    @PreAuthorize("hasAnyAuthority('VIEW_CLASSES','VIEW_SALARY')")
    List<HourlyRateView> hourlyRates(@PathVariable UUID classId) {
        return service.hourlyRates(classId);
    }

    @PostMapping("/classes/{classId}/hourly-rates")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('MANAGE_CLASS_RATES')")
    HourlyRateView createHourlyRate(
        @PathVariable UUID classId,
        @Valid @RequestBody CreateHourlyRateInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.createHourlyRate(classId, input, idempotencyKey);
    }

    @PatchMapping("/classes/{classId}/hourly-rates/{rateId}")
    @PreAuthorize("hasAuthority('MANAGE_CLASS_RATES')")
    HourlyRateView updateHourlyRate(
        @PathVariable UUID classId,
        @PathVariable UUID rateId,
        @Valid @RequestBody UpdateHourlyRateInput input
    ) {
        return service.updateHourlyRate(classId, rateId, input);
    }

    @PatchMapping("/sessions/{sessionId}/completion-correction")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    CompletionCorrectionView correctCompletion(
        @PathVariable UUID sessionId,
        @Valid @RequestBody CompletionCorrectionInput input
    ) {
        return service.correctCompletion(sessionId, input);
    }

    @GetMapping("/salary/payroll")
    @PreAuthorize("hasAuthority('VIEW_SALARY')")
    PayrollPage payroll(
        @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month,
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(defaultValue = "teacherName") String sort
    ) {
        return service.payroll(month, search, status, page, pageSize, sort);
    }

    @GetMapping("/salary/payroll/export")
    @PreAuthorize("hasAuthority('VIEW_SALARY')")
    @Operation(summary = "Xuất bảng lương tháng theo bộ lọc hiện tại dưới dạng XLSX")
    ResponseEntity<byte[]> export(
        @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month,
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "teacherName") String sort
    ) {
        byte[] content = exportService.export(month, search, status, sort);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=salary-payroll-" + month + ".xlsx")
            .contentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .contentLength(content.length)
            .body(content);
    }

    @GetMapping("/salary/payroll/{teacherId}")
    @PreAuthorize("hasAuthority('VIEW_SALARY')")
    TeacherPayrollDetail teacherPayroll(
        @PathVariable UUID teacherId,
        @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month
    ) {
        return service.teacherPayroll(teacherId, month);
    }

    @GetMapping("/teachers/me/salary")
    @PreAuthorize("hasAuthority('VIEW_OWN_SALARY')")
    TeacherPayrollDetail ownPayroll(
        @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month
    ) {
        return service.ownPayroll(month);
    }

    @PostMapping("/salary/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('MANAGE_SALARY')")
    SalaryAdjustmentView createAdjustment(
        @Valid @RequestBody CreateAdjustmentInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.createAdjustment(input, idempotencyKey);
    }

    @PatchMapping("/salary/adjustments/{adjustmentId}")
    @PreAuthorize("hasAuthority('MANAGE_SALARY')")
    SalaryAdjustmentView updateAdjustment(
        @PathVariable UUID adjustmentId,
        @Valid @RequestBody UpdateAdjustmentInput input
    ) {
        return service.updateAdjustment(adjustmentId, input);
    }

    @PostMapping("/salary/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('MANAGE_SALARY')")
    SalaryPaymentView createPayment(
        @Valid @RequestBody CreatePaymentInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.createPayment(input, idempotencyKey);
    }

    @PatchMapping("/salary/payments/{paymentId}")
    @PreAuthorize("hasAuthority('MANAGE_SALARY')")
    SalaryPaymentView updatePayment(
        @PathVariable UUID paymentId,
        @Valid @RequestBody UpdatePaymentInput input
    ) {
        return service.updatePayment(paymentId, input);
    }

    @GetMapping("/finance/salary-summary")
    @PreAuthorize("hasAuthority('VIEW_SALARY')")
    SalaryYearSummary salarySummary(@RequestParam int year) {
        return service.salarySummary(year);
    }
}
