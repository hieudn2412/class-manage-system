package com.classops.backend.dashboard;

import com.classops.backend.common.PageResponse;
import com.classops.backend.dashboard.DashboardDtos.PendingConfirmationItem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Management dashboard")
@SecurityRequirement(name = "bearerAuth")
public class DashboardController {
    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('VIEW_MANAGEMENT_DASHBOARD')")
    @Operation(summary = "Get the tenant-scoped management dashboard")
    DashboardDtos.DashboardData dashboard() {
        return service.dashboard();
    }

    @GetMapping("/dashboard/pending-confirmations")
    @PreAuthorize("hasAuthority('VIEW_MANAGEMENT_DASHBOARD')")
    @Operation(summary = "List sessions waiting for management confirmation")
    PageResponse<PendingConfirmationItem> pendingConfirmations(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "") String mode,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue = "startAt") String sort,
        @RequestParam(defaultValue = "asc") String direction,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return service.pendingConfirmations(search, mode, from, to, sort, direction, page, pageSize);
    }
}
