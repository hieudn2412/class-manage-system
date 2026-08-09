package com.classops.backend.accounts;

import com.classops.backend.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/accounts")
@PreAuthorize("hasAnyAuthority('MANAGE_TENANT_ACCOUNTS','MANAGE_LEARNING_ACCOUNTS')")
public class AccountController {
    private final AccountService service;
    public AccountController(AccountService service) { this.service = service; }

    @GetMapping
    public PageResponse<AccountService.AccountView> list(@RequestParam(required=false) String search,
        @RequestParam(required=false) String status, @RequestParam(required=false) String role,
        @RequestParam(required=false) String profileType, @RequestParam(defaultValue="1") int page,
        @RequestParam(defaultValue="20") int pageSize,
        @RequestParam(defaultValue="createdAt,desc") String sort) {
        return service.list(search,status,role,profileType,page,pageSize,sort);
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public AccountService.CreatedAccount create(@Valid @RequestBody CreateRequest r) {
        return service.create(new AccountService.CreateAccount(r.profileType(),r.username(),r.displayName(),
            r.email(),r.roles(),r.parentName(),r.parentPhone()));
    }
    @GetMapping("/{id}") public AccountService.AccountView get(@PathVariable UUID id) { return service.get(id); }
    @PatchMapping("/{id}") public AccountService.AccountView update(@PathVariable UUID id,
        @Valid @RequestBody UpdateRequest r) {
        return service.update(id,new AccountService.UpdateAccount(r.displayName(),r.email(),r.roles(),
            r.parentName(),r.parentPhone(),r.version()));
    }
    @PatchMapping("/{id}/status") public AccountService.AccountView status(@PathVariable UUID id,
        @Valid @RequestBody StatusRequest r) { return service.changeStatus(id,r.status(),r.reason(),r.version()); }
    @PostMapping("/{id}/credential-resets") public AccountService.CredentialReset reset(@PathVariable UUID id,
        @Valid @RequestBody ResetRequest r) { return service.reset(id,r.reason(),r.version()); }

    public record CreateRequest(@NotBlank String profileType,@NotBlank String username,
        @NotBlank String displayName,@Email String email,@NotEmpty List<@NotBlank String> roles,
        String parentName,String parentPhone) {}
    public record UpdateRequest(@NotBlank String displayName,@Email String email,
        @NotEmpty List<@NotBlank String> roles,String parentName,String parentPhone,
        @PositiveOrZero long version) {}
    public record StatusRequest(@NotBlank String status,@NotBlank String reason,@PositiveOrZero long version) {}
    public record ResetRequest(@NotBlank String reason,@PositiveOrZero long version) {}
}
