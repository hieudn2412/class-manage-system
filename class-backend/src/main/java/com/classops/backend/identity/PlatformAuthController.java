package com.classops.backend.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/auth")
@Tag(name = "Platform authentication")
public class PlatformAuthController {
    private final AuthService service;

    public PlatformAuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/login")
    @Operation(summary = "Login as the single platform Super Admin")
    AuthService.AuthSession login(@Valid @RequestBody LoginRequest request,
                                  HttpServletRequest httpRequest) {
        return service.platformLogin(request.username(), request.password(),
            httpRequest.getRemoteAddr());
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }
}
