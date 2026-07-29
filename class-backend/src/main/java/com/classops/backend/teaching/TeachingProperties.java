package com.classops.backend.teaching;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.time.ZoneId;

@ConfigurationProperties("app.teaching")
public record TeachingProperties(
    ZoneId zoneId,
    Duration checkInBeforeStart,
    long schedulerDelayMs
) {
}
