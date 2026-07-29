package com.classops.backend.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Authentication")
public class AuthController {
    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @GetMapping("/tenants/{slug}")
    @Operation(summary = "Resolve a tenant before login")
    AuthService.TenantDto tenant(@PathVariable String slug) {
        return service.tenant(slug);
    }

    @PostMapping("/auth/login")
    @Operation(summary = "Login in one explicit tenant")
    AuthService.AuthSession login(
        @Valid @RequestBody LoginRequest request,
        @RequestHeader(value = "X-Tenant-Slug", required = false) String tenantHeader,
        HttpServletRequest httpRequest
    ) {
        String tenantSlug = request.tenantSlug() != null && !request.tenantSlug().isBlank()
            ? request.tenantSlug() : tenantHeader;
        if (tenantSlug == null || tenantSlug.isBlank()) {
            throw new com.classops.backend.common.ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "TENANT_REQUIRED",
                "Cần chỉ định trung tâm khi đăng nhập.");
        }
        return service.login(tenantSlug, request.username(), request.password(),
            httpRequest.getRemoteAddr());
    }

    @PostMapping("/auth/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Safely acknowledge a password reset request")
    AuthService.MessageResponse forgotPassword(
        @Valid @RequestBody ForgotPasswordRequest request,
        @RequestHeader(value = "X-Tenant-Slug", required = false) String tenantHeader,
        HttpServletRequest httpRequest
    ) {
        String tenantSlug = resolveTenantSlug(request.tenantSlug(), tenantHeader);
        return service.forgotPassword(tenantSlug, request.username(), httpRequest.getRemoteAddr());
    }

    @PostMapping("/auth/change-password")
    @Operation(summary = "Replace a temporary password and issue a new session")
    AuthService.AuthSession changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        return service.changePassword(request.newPassword());
    }

    private String resolveTenantSlug(String bodySlug, String headerSlug) {
        String tenantSlug = bodySlug != null && !bodySlug.isBlank() ? bodySlug : headerSlug;
        if (tenantSlug == null || tenantSlug.isBlank()) {
            throw new com.classops.backend.common.ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "TENANT_REQUIRED",
                "Cần chỉ định trung tâm.");
        }
        return tenantSlug;
    }

    public record LoginRequest(String tenantSlug, @NotBlank String username, @NotBlank String password) {
    }

    public record ForgotPasswordRequest(String tenantSlug, @NotBlank String username) {
    }

    public record ChangePasswordRequest(
        @NotBlank @Size(min = 8, message = "Mật khẩu mới phải có ít nhất 8 ký tự.")
        String newPassword
    ) {
    }
}
