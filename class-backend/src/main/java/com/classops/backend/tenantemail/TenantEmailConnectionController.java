package com.classops.backend.tenantemail;

import com.classops.backend.tenantemail.GmailDtos.GmailAuthorizationView;
import com.classops.backend.tenantemail.GmailDtos.TenantEmailConnectionView;
import com.classops.backend.tenantemail.GmailDtos.TestGmailInput;
import com.classops.backend.tenantemail.GmailDtos.TestGmailResult;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "FL-10.1 tenant Gmail connection")
@SecurityRequirement(name = "bearerAuth")
public class TenantEmailConnectionController {
    private final TenantEmailConnectionService service;

    public TenantEmailConnectionController(TenantEmailConnectionService service) {
        this.service = service;
    }

    @GetMapping("/tenant-email-connection")
    @PreAuthorize("hasAuthority('MANAGE_TENANT_EMAIL')")
    TenantEmailConnectionView status() {
        return service.status();
    }

    @PostMapping("/tenant-email-connection/oauth-authorizations")
    @PreAuthorize("hasAuthority('MANAGE_TENANT_EMAIL')")
    ResponseEntity<GmailAuthorizationView> authorize(@RequestHeader("Idempotency-Key") String key) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.authorize(key));
    }

    @PostMapping("/tenant-email-connection/test-messages")
    @PreAuthorize("hasAuthority('MANAGE_TENANT_EMAIL')")
    TestGmailResult test(@Valid @RequestBody(required = false) TestGmailInput input,
                         @RequestHeader("Idempotency-Key") String key) {
        return service.test(input, key);
    }

    @DeleteMapping("/tenant-email-connection")
    @PreAuthorize("hasAuthority('MANAGE_TENANT_EMAIL')")
    ResponseEntity<Void> disconnect(@RequestParam long version) {
        service.disconnect(version);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/oauth/google/gmail/callback")
    ResponseEntity<Void> callback(@RequestParam(required = false) String state,
                                  @RequestParam(required = false) String code,
                                  @RequestParam(required = false, name = "error") String googleError) {
        return ResponseEntity.status(HttpStatus.SEE_OTHER)
            .location(URI.create(service.callbackRedirect(state, code, googleError)))
            .build();
    }
}
