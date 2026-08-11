package com.classops.backend.tenantemail;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.gmail")
public record GmailProperties(
    boolean oauthEnabled,
    String clientId,
    String clientSecret,
    String redirectUri,
    String tokenEncryptionKey,
    Duration oauthStateTtl,
    Duration outboxRetention,
    Duration httpTimeout,
    String authorizationUri,
    String tokenUri,
    String userInfoUri,
    String sendUri,
    int keyVersion
) {
    public static final String GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
    public static final String OPENID_SCOPE = "openid";
    public static final String EMAIL_SCOPE = "email";

    public boolean configured() {
        return oauthEnabled
            && present(clientId)
            && present(clientSecret)
            && present(redirectUri)
            && present(tokenEncryptionKey);
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }
}
