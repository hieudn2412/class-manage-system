package com.classops.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.seed")
public record SeedProperties(
    Admin admin,
    String defaultPassword
) {
    public record Admin(
        String username,
        String password,
        String email
    ) {
    }
}
