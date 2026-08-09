package com.classops.backend.identity;

import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class PermissionCatalog {
    private PermissionCatalog() {
    }

    public enum Role {
        SUPER_ADMIN, ADMIN, ACADEMIC_MANAGER, ACCOUNTANT, TEACHER, STUDENT
    }

    private static final Map<Role, Set<String>> ROLE_PERMISSIONS = new EnumMap<>(Role.class);

    static {
        ROLE_PERMISSIONS.put(Role.SUPER_ADMIN, Set.of(
            "VIEW_PLATFORM_TENANTS", "MANAGE_PLATFORM_TENANTS", "MANAGE_INITIAL_ADMIN"));
        ROLE_PERMISSIONS.put(Role.ADMIN, Set.of(
            "VIEW_CLASSES", "MANAGE_CLASSES", "VIEW_MANAGEMENT_SCHEDULE",
            "MANAGE_SESSION_SCHEDULE", "VIEW_FINANCE", "VIEW_MANAGEMENT_DASHBOARD",
            "MANAGE_SESSION_VERIFICATION", "MANAGE_TENANT_ACCOUNTS",
            "MANAGE_CLASS_RATES", "VIEW_SALARY", "MANAGE_SALARY"));
        ROLE_PERMISSIONS.put(Role.ACADEMIC_MANAGER, Set.of(
            "VIEW_CLASSES", "MANAGE_CLASSES", "VIEW_MANAGEMENT_SCHEDULE",
            "MANAGE_SESSION_SCHEDULE", "VIEW_MANAGEMENT_DASHBOARD",
            "MANAGE_SESSION_VERIFICATION", "MANAGE_LEARNING_ACCOUNTS",
            "MANAGE_CLASS_RATES"));
        ROLE_PERMISSIONS.put(Role.ACCOUNTANT, Set.of(
            "VIEW_CLASSES", "VIEW_MANAGEMENT_SCHEDULE", "VIEW_FINANCE",
            "VIEW_SALARY", "MANAGE_SALARY"));
        ROLE_PERMISSIONS.put(Role.TEACHER, Set.of(
            "VIEW_OWN_SCHEDULE", "VIEW_OWN_TEACHING", "EDIT_OWN_SESSION_RECORDS",
            "VIEW_OWN_SALARY"));
        ROLE_PERMISSIONS.put(Role.STUDENT, Set.of("VIEW_OWN_LEARNING"));
    }

    public static List<String> union(List<String> roles) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String role : roles) {
            result.addAll(ROLE_PERMISSIONS.getOrDefault(Role.valueOf(role), Set.of()));
        }
        return List.copyOf(result);
    }
}
