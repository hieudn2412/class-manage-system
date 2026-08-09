package com.classops.backend.platform;

import com.classops.backend.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/platform/tenants")
@PreAuthorize("hasAuthority('MANAGE_PLATFORM_TENANTS')")
public class PlatformTenantController {
    private final PlatformTenantService service;
    public PlatformTenantController(PlatformTenantService service) { this.service = service; }

    @GetMapping
    public PageResponse<PlatformTenantService.TenantView> list(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return service.list(search, status, page, pageSize, sort);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlatformTenantService.CreatedTenant create(@Valid @RequestBody CreateRequest request) {
        return service.create(new PlatformTenantService.CreateTenant(request.name(), request.slug(),
            new PlatformTenantService.InitialAdminInput(request.initialAdmin().username(),
                request.initialAdmin().displayName(), request.initialAdmin().email())));
    }

    @GetMapping("/{id}")
    public PlatformTenantService.TenantView get(@PathVariable UUID id) { return service.get(id); }

    @PatchMapping("/{id}")
    public PlatformTenantService.TenantView rename(@PathVariable UUID id,
                                                    @Valid @RequestBody RenameRequest request) {
        return service.rename(id, request.name(), request.version());
    }

    @PatchMapping("/{id}/status")
    public PlatformTenantService.TenantView status(@PathVariable UUID id,
                                                    @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(id, request.status(), request.reason(), request.version());
    }

    @PatchMapping("/{id}/initial-administrator/status")
    @PreAuthorize("hasAuthority('MANAGE_INITIAL_ADMIN')")
    public PlatformTenantService.InitialAdminView initialAdminStatus(
        @PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return service.changeInitialAdminStatus(id, request.status(), request.reason(), request.version());
    }

    @PostMapping("/{id}/initial-administrator/credential-resets")
    @PreAuthorize("hasAuthority('MANAGE_INITIAL_ADMIN')")
    public PlatformTenantService.CredentialReset resetInitialAdmin(
        @PathVariable UUID id, @Valid @RequestBody ResetRequest request) {
        return service.resetInitialAdmin(id, request.reason(), request.version());
    }

    public record InitialAdminRequest(@NotBlank String username, @NotBlank String displayName,
                                      @Email String email) {}
    public record CreateRequest(@NotBlank String name, @NotBlank String slug,
                                @NotNull @Valid InitialAdminRequest initialAdmin) {}
    public record RenameRequest(@NotBlank String name, @PositiveOrZero long version) {}
    public record StatusRequest(@NotBlank String status, @NotBlank String reason,
                                @PositiveOrZero long version) {}
    public record ResetRequest(@NotBlank String reason, @PositiveOrZero long version) {}
}
