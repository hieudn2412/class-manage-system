package com.classops.backend.tenantemail;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Base64;

@Component
public class GmailConfigurationValidator implements InitializingBean {
    private final GmailProperties properties;
    private final Environment environment;

    public GmailConfigurationValidator(GmailProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @Override
    public void afterPropertiesSet() {
        if (!properties.oauthEnabled()) return;
        require(properties.clientId(), "GOOGLE_GMAIL_CLIENT_ID");
        require(properties.clientSecret(), "GOOGLE_GMAIL_CLIENT_SECRET");
        require(properties.redirectUri(), "GOOGLE_GMAIL_REDIRECT_URI");
        require(properties.tokenEncryptionKey(), "GMAIL_TOKEN_ENCRYPTION_KEY");
        if (Base64.getDecoder().decode(properties.tokenEncryptionKey()).length != 32) {
            throw new IllegalStateException("GMAIL_TOKEN_ENCRYPTION_KEY must be a Base64 encoded 32-byte key.");
        }
        if (environment.acceptsProfiles(Profiles.of("prod"))
            && !"https".equalsIgnoreCase(URI.create(properties.redirectUri()).getScheme())) {
            throw new IllegalStateException("GOOGLE_GMAIL_REDIRECT_URI must use HTTPS in production.");
        }
    }

    private void require(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required when GMAIL_OAUTH_ENABLED=true.");
        }
    }
}
