package com.classops.backend.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties("app.security")
public record SecurityProperties(
    String jwtSecret,
    Duration accessTokenTtl,
    int maxLoginAttempts,
    Duration loginBlockDuration
) {
}
