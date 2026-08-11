package com.classops.backend.tenantemail;

import jakarta.validation.constraints.Email;

import java.time.OffsetDateTime;

public final class GmailDtos {
    private GmailDtos() {
    }

    public record TenantEmailConnectionView(
        String status,
        boolean oauthConfigured,
        String gmailAddressMasked,
        String gmailAddress,
        String connectedBy,
        OffsetDateTime connectedAt,
        OffsetDateTime lastSuccessfulSendAt,
        String lastErrorCode,
        String lastErrorMessage,
        OffsetDateTime lastErrorAt,
        long pendingEmailCount,
        long version
    ) {
    }

    public record GmailAuthorizationView(String authorizationUrl, OffsetDateTime expiresAt) {
    }

    public record TestGmailInput(@Email String recipientEmail) {
    }

    public record TestGmailResult(String gmailMessageId, OffsetDateTime sentAt) {
    }
}
