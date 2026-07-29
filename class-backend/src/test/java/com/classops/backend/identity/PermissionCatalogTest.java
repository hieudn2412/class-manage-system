package com.classops.backend.identity;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PermissionCatalogTest {
    @Test
    void unionsPermissionsForMultiRoleAccount() {
        assertThat(PermissionCatalog.union(List.of("TEACHER", "ACCOUNTANT")))
            .contains("VIEW_OWN_SCHEDULE", "VIEW_MANAGEMENT_SCHEDULE", "VIEW_FINANCE")
            .doesNotContain("MANAGE_CLASSES");
    }

    @Test
    void accountantIsReadOnlyForScheduling() {
        assertThat(PermissionCatalog.union(List.of("ACCOUNTANT")))
            .contains("VIEW_MANAGEMENT_SCHEDULE")
            .doesNotContain("MANAGE_SESSION_SCHEDULE");
    }
}
