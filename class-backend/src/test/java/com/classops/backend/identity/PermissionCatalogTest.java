package com.classops.backend.identity;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PermissionCatalogTest {
    @Test
    void unionsPermissionsForMultiRoleAccount() {
        assertThat(PermissionCatalog.union(List.of("TEACHER", "ACCOUNTANT")))
            .contains("VIEW_OWN_SCHEDULE", "VIEW_MANAGEMENT_SCHEDULE", "VIEW_FINANCE",
                "VIEW_OWN_SALARY", "VIEW_SALARY", "MANAGE_SALARY")
            .doesNotContain("MANAGE_CLASSES");
    }

    @Test
    void accountantIsReadOnlyForScheduling() {
        assertThat(PermissionCatalog.union(List.of("ACCOUNTANT")))
            .contains("VIEW_MANAGEMENT_SCHEDULE", "VIEW_SALARY", "MANAGE_SALARY")
            .doesNotContain("MANAGE_SESSION_SCHEDULE");
    }

    @Test
    void studentCanOnlyViewOwnLearning() {
        assertThat(PermissionCatalog.union(List.of("STUDENT")))
            .containsExactly("VIEW_OWN_LEARNING");
    }

    @Test
    void academicManagerCanManageRatesButCannotSeePayroll() {
        assertThat(PermissionCatalog.union(List.of("ACADEMIC_MANAGER")))
            .contains("MANAGE_CLASS_RATES")
            .doesNotContain("VIEW_SALARY", "MANAGE_SALARY");
    }

}
