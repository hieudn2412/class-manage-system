package com.classops.backend.learningcontent;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;
import java.time.Duration;

@ConfigurationProperties("app.content")
public record ContentProperties(
    Path storageRoot,
    Path stagingRoot,
    long defaultTenantQuotaBytes,
    Duration stagingTtl,
    long imageLimitBytes,
    long submissionImageLimitBytes,
    long documentLimitBytes,
    long audioLimitBytes,
    int submissionMaxFiles,
    String clamavHost,
    int clamavPort,
    Duration clamavTimeout,
    boolean clamavEnabled,
    Path maintenanceFlagPath,
    Path backupDirectory,
    int backupRetentionDays
) {
}
