package com.classops.backend.scheduling;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.time.ZoneId;

@ConfigurationProperties("app.scheduling")
public record SchedulingProperties(ZoneId zoneId, Duration previewTtl, int maxGenerationDays) {
}
