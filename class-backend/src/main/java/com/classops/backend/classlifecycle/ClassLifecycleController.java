package com.classops.backend.classlifecycle;

import com.classops.backend.classlifecycle.LifecycleDtos.AddEnrollmentsInput;
import com.classops.backend.classlifecycle.LifecycleDtos.AddEnrollmentsResult;
import com.classops.backend.classlifecycle.LifecycleDtos.ChangeClassStatusInput;
import com.classops.backend.classlifecycle.LifecycleDtos.ChangeClassStatusResult;
import com.classops.backend.classlifecycle.LifecycleDtos.EndEnrollmentInput;
import com.classops.backend.classlifecycle.LifecycleDtos.EndEnrollmentResult;
import com.classops.backend.classlifecycle.LifecycleDtos.EnrollmentCandidate;
import com.classops.backend.classlifecycle.LifecycleDtos.EnrollmentItem;
import com.classops.backend.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/classes/{classId}")
@Tag(name = "Class lifecycle and enrollments")
@SecurityRequirement(name = "bearerAuth")
public class ClassLifecycleController {
    private final ClassLifecycleService service;

    public ClassLifecycleController(ClassLifecycleService service) {
        this.service = service;
    }

    @GetMapping("/enrollments")
    @PreAuthorize("hasAuthority('VIEW_CLASSES')")
    PageResponse<EnrollmentItem> enrollments(
        @PathVariable UUID classId,
        @RequestParam(defaultValue = "Active") String scope,
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.enrollments(classId, scope, search, page, pageSize);
    }

    @GetMapping("/enrollment-candidates")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    PageResponse<EnrollmentCandidate> candidates(
        @PathVariable UUID classId,
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.candidates(classId, search, page, pageSize);
    }

    @PostMapping("/enrollments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    @Operation(summary = "Atomically enroll one or more students after publication")
    AddEnrollmentsResult add(
        @PathVariable UUID classId,
        @Valid @RequestBody AddEnrollmentsInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.add(classId, input, idempotencyKey);
    }

    @PatchMapping("/enrollments/{enrollmentId}")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    EndEnrollmentResult end(
        @PathVariable UUID classId,
        @PathVariable UUID enrollmentId,
        @Valid @RequestBody EndEnrollmentInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.end(classId, enrollmentId, input, idempotencyKey);
    }

    @PatchMapping("/status")
    @PreAuthorize("hasAuthority('MANAGE_CLASSES')")
    ChangeClassStatusResult status(
        @PathVariable UUID classId,
        @Valid @RequestBody ChangeClassStatusInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.changeStatus(classId, input, idempotencyKey);
    }
}
