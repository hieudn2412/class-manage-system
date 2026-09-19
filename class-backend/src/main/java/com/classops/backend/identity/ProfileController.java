package com.classops.backend.identity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile/me")
@Tag(name = "Personal profile")
public class ProfileController {
    private final ProfileService profiles;
    private final AuthService auth;

    public ProfileController(ProfileService profiles, AuthService auth) {
        this.profiles = profiles;
        this.auth = auth;
    }

    @GetMapping
    @Operation(summary = "View the current account profile")
    ProfileService.SelfProfile me() {
        return profiles.me();
    }

    @PutMapping("/password")
    @Operation(summary = "Change the current account password and issue a fresh session")
    AuthService.AuthSession changePassword(@Valid @RequestBody PasswordChangeRequest request) {
        return auth.changeOwnPassword(request.currentPassword(), request.newPassword());
    }

    public record PasswordChangeRequest(
        @NotBlank(message = "Vui lòng nhập mật khẩu hiện tại.") String currentPassword,
        @NotBlank(message = "Vui lòng nhập mật khẩu mới.")
        @Size(min = 8, message = "Mật khẩu mới phải có ít nhất 8 ký tự.") String newPassword
    ) {
    }
}
