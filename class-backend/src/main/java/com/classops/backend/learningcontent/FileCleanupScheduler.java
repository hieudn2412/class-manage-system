package com.classops.backend.learningcontent;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class FileCleanupScheduler {
    private final FileStorageService storage;

    public FileCleanupScheduler(FileStorageService storage) {
        this.storage = storage;
    }

    @Scheduled(fixedDelayString = "${app.teaching.scheduler-delay-ms:30000}")
    public void cleanup() {
        storage.cleanupExpiredStaging();
    }
}
