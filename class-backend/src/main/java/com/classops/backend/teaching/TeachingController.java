package com.classops.backend.teaching;

import com.classops.backend.common.PageResponse;
import com.classops.backend.teaching.TeachingDtos.CheckInInput;
import com.classops.backend.teaching.TeachingDtos.PedagogicalRecordInput;
import com.classops.backend.teaching.TeachingDtos.SessionOperationsDetail;
import com.classops.backend.teaching.TeachingDtos.TeacherClassItem;
import com.classops.backend.teaching.TeachingDtos.TeacherClassSessions;
import com.classops.backend.teaching.TeachingDtos.TeacherDashboardData;
import com.classops.backend.teaching.TeachingDtos.TestResult;
import com.classops.backend.teaching.TeachingDtos.TestResultInput;
import com.classops.backend.teaching.TeachingDtos.VerificationDecisionInput;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Teaching operations")
@SecurityRequirement(name = "bearerAuth")
public class TeachingController {
    private final TeachingService service;

    public TeachingController(TeachingService service) {
        this.service = service;
    }

    @GetMapping("/teachers/me/dashboard")
    @PreAuthorize("hasAuthority('VIEW_OWN_TEACHING')")
    TeacherDashboardData dashboard() {
        return service.dashboard();
    }

    @GetMapping("/teachers/me/classes")
    @PreAuthorize("hasAuthority('VIEW_OWN_TEACHING')")
    PageResponse<TeacherClassItem> classes(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "") String role,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.classes(search, status, role, from, to, page, pageSize);
    }

    @GetMapping("/teachers/me/classes/{classId}/sessions")
    @PreAuthorize("hasAuthority('VIEW_OWN_TEACHING')")
    TeacherClassSessions classSessions(
        @PathVariable UUID classId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.classSessions(classId, page, pageSize);
    }

    @GetMapping("/sessions/{sessionId}")
    @PreAuthorize("hasAnyAuthority('VIEW_OWN_TEACHING','MANAGE_SESSION_VERIFICATION')")
    SessionOperationsDetail detail(@PathVariable UUID sessionId) {
        return service.detail(sessionId);
    }

    @PostMapping("/sessions/{sessionId}/check-ins")
    @PreAuthorize("hasAuthority('EDIT_OWN_SESSION_RECORDS')")
    @Operation(summary = "Check-in một buổi; Online bắt buộc nhập link của đúng buổi")
    SessionOperationsDetail checkIn(
        @PathVariable UUID sessionId,
        @Valid @RequestBody CheckInInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        HttpServletRequest request
    ) {
        return service.checkIn(sessionId, input, idempotencyKey,
            clientIp(request), request.getHeader("User-Agent"));
    }

    @PatchMapping("/sessions/{sessionId}/pedagogical-record")
    @PreAuthorize("hasAuthority('EDIT_OWN_SESSION_RECORDS')")
    SessionOperationsDetail savePedagogicalRecord(
        @PathVariable UUID sessionId,
        @Valid @RequestBody PedagogicalRecordInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.savePedagogicalRecord(sessionId, input, idempotencyKey);
    }

    @PostMapping("/sessions/{sessionId}/students/{studentId}/test-results")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('EDIT_OWN_SESSION_RECORDS')")
    TestResult addTestResult(
        @PathVariable UUID sessionId,
        @PathVariable UUID studentId,
        @Valid @RequestBody TestResultInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.addTestResult(sessionId, studentId, input, idempotencyKey);
    }

    @PutMapping("/sessions/{sessionId}/students/{studentId}/test-results/{resultId}")
    @PreAuthorize("hasAuthority('EDIT_OWN_SESSION_RECORDS')")
    TestResult updateTestResult(
        @PathVariable UUID sessionId,
        @PathVariable UUID studentId,
        @PathVariable UUID resultId,
        @Valid @RequestBody TestResultInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.updateTestResult(
            sessionId, studentId, resultId, input, idempotencyKey);
    }

    @PostMapping("/sessions/{sessionId}/verification-decisions")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_VERIFICATION')")
    SessionOperationsDetail verify(
        @PathVariable UUID sessionId,
        @Valid @RequestBody VerificationDecisionInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.verify(sessionId, input, idempotencyKey);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
