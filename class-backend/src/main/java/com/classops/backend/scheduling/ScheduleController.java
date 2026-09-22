package com.classops.backend.scheduling;

import com.classops.backend.scheduling.SchedulingDtos.ApplyRescheduleInput;
import com.classops.backend.scheduling.SchedulingDtos.ApplySessionScheduleInput;
import com.classops.backend.scheduling.SchedulingDtos.ApplySubstitutionInput;
import com.classops.backend.scheduling.SchedulingDtos.CancelSessionInput;
import com.classops.backend.scheduling.SchedulingDtos.CreateMakeupInput;
import com.classops.backend.scheduling.SchedulingDtos.MakeupPreviewInput;
import com.classops.backend.scheduling.SchedulingDtos.ReschedulePreviewInput;
import com.classops.backend.scheduling.SchedulingDtos.RescheduleResult;
import com.classops.backend.scheduling.SchedulingDtos.SchedulePreview;
import com.classops.backend.scheduling.SchedulingDtos.SessionMutationResult;
import com.classops.backend.scheduling.SchedulingDtos.SessionScheduleInput;
import com.classops.backend.scheduling.SchedulingDtos.SubstitutionPreviewInput;
import com.classops.backend.scheduling.SchedulingDtos.WeekSchedule;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Weekly schedules")
@SecurityRequirement(name = "bearerAuth")
public class ScheduleController {
    private final ScheduleService service;
    private final SessionMutationService mutationService;

    public ScheduleController(ScheduleService service, SessionMutationService mutationService) {
        this.service = service;
        this.mutationService = mutationService;
    }

    @GetMapping("/schedules/management")
    @PreAuthorize("hasAuthority('VIEW_MANAGEMENT_SCHEDULE')")
    WeekSchedule management(
        @RequestParam LocalDate weekStart,
        @RequestParam(required = false) UUID teacherId,
        @RequestParam(required = false) UUID roomId
    ) {
        return service.management(weekStart, teacherId, roomId);
    }

    @GetMapping("/schedules/me")
    @PreAuthorize("hasAuthority('VIEW_OWN_SCHEDULE')")
    WeekSchedule mine(@RequestParam LocalDate weekStart) {
        return service.mine(weekStart);
    }

    @PostMapping({"/sessions/{sessionId}/schedule-preview",
        "/sessions/{sessionId}/schedule-previews"})
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Preview one session mode/room override; online link is intentionally absent")
    SchedulePreview preview(
        @PathVariable UUID sessionId,
        @Valid @RequestBody SessionScheduleInput input
    ) {
        return service.previewOverride(sessionId, input);
    }

    @PatchMapping("/sessions/{sessionId}/schedule")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    WeekSchedule apply(
        @PathVariable UUID sessionId,
        @Valid @RequestBody ApplySessionScheduleInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return service.applyOverride(sessionId, input, idempotencyKey);
    }

    @PostMapping("/sessions/{sessionId}/substitution-previews")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Preview teacher substitution for one session")
    SchedulePreview previewSubstitution(
        @PathVariable UUID sessionId,
        @Valid @RequestBody SubstitutionPreviewInput input
    ) {
        return mutationService.previewSubstitution(sessionId, input);
    }

    @PostMapping("/sessions/{sessionId}/substitutions")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Apply teacher substitution for one session")
    SessionMutationResult substitute(
        @PathVariable UUID sessionId,
        @Valid @RequestBody ApplySubstitutionInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return mutationService.substitute(sessionId, input, idempotencyKey);
    }

    @PostMapping("/sessions/{sessionId}/makeup-previews")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Preview a makeup session")
    SchedulePreview previewMakeup(
        @PathVariable UUID sessionId,
        @Valid @RequestBody MakeupPreviewInput input
    ) {
        return mutationService.previewMakeup(sessionId, input);
    }

    @PostMapping("/sessions/{sessionId}/cancellations")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Cancel a session, optionally creating a makeup in one transaction")
    SessionMutationResult cancel(
        @PathVariable UUID sessionId,
        @Valid @RequestBody CancelSessionInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return mutationService.cancel(sessionId, input, idempotencyKey);
    }

    @PostMapping("/sessions/{sessionId}/makeups")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Create a makeup for a cancelled session")
    SessionMutationResult createMakeup(
        @PathVariable UUID sessionId,
        @Valid @RequestBody CreateMakeupInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return mutationService.createMakeup(sessionId, input, idempotencyKey);
    }

    @PostMapping("/sessions/{sessionId}/reschedule-previews")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Preview cascade reschedule from a session onward")
    SchedulePreview previewReschedule(
        @PathVariable UUID sessionId,
        @Valid @RequestBody ReschedulePreviewInput input
    ) {
        return mutationService.previewReschedule(sessionId, input);
    }

    @PostMapping("/sessions/{sessionId}/reschedules")
    @PreAuthorize("hasAuthority('MANAGE_SESSION_SCHEDULE')")
    @Operation(summary = "Apply cascade reschedule from a session onward")
    RescheduleResult reschedule(
        @PathVariable UUID sessionId,
        @Valid @RequestBody ApplyRescheduleInput input,
        @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        return mutationService.reschedule(sessionId, input, idempotencyKey);
    }
}
