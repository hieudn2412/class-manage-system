package com.classops.backend.learningcontent;

import com.classops.backend.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.nio.file.Files;

@Component
public class MaintenanceWriteGuard {
    private final ContentProperties properties;

    public MaintenanceWriteGuard(ContentProperties properties) {
        this.properties = properties;
    }

    public void requireWritable() {
        if (properties.maintenanceFlagPath() != null
            && Files.exists(properties.maintenanceFlagPath())) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MAINTENANCE_MODE",
                "Hệ thống đang backup/bảo trì, vui lòng thử lại sau.",
                java.util.Map.of("retryAfterSeconds", 60));
        }
    }
}
