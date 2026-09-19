package com.classops.backend.identity;

import com.classops.backend.common.ApiException;
import com.classops.backend.security.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ProfileService {
    private final JdbcClient jdbc;
    private final CurrentActor actor;

    public ProfileService(JdbcClient jdbc, CurrentActor actor) {
        this.jdbc = jdbc;
        this.actor = actor;
    }

    @Transactional(readOnly = true)
    public SelfProfile me() {
        return "PLATFORM".equals(actor.scope()) ? platformProfile() : tenantProfile();
    }

    private SelfProfile tenantProfile() {
        UUID tenantId = actor.tenantId();
        UUID userId = actor.userId();
        SelfProfile profile = jdbc.sql("""
                SELECT u.id, u.username, u.display_name, u.email, u.status, u.profile_type,
                       u.last_login_at, u.created_at, t.id tenant_id, t.slug tenant_slug,
                       t.name tenant_name, coalesce(tp.code, sp.code) code,
                       sp.parent_name, sp.parent_phone
                FROM users u
                JOIN tenants t ON t.id=u.tenant_id
                LEFT JOIN teacher_profiles tp ON tp.tenant_id=u.tenant_id AND tp.user_id=u.id
                LEFT JOIN student_profiles sp ON sp.tenant_id=u.tenant_id AND sp.user_id=u.id
                WHERE u.tenant_id=:tenantId AND u.id=:userId
                """)
            .param("tenantId", tenantId)
            .param("userId", userId)
            .query((rs, row) -> new SelfProfile(
                "TENANT", rs.getObject("id", UUID.class),
                new ProfileTenant(rs.getObject("tenant_id", UUID.class),
                    rs.getString("tenant_slug"), rs.getString("tenant_name")),
                rs.getString("profile_type"), rs.getString("code"),
                rs.getString("username"), rs.getString("display_name"), rs.getString("email"),
                List.of(), rs.getString("status"), rs.getString("parent_name"),
                rs.getString("parent_phone"), instant(rs.getObject("last_login_at", OffsetDateTime.class)),
                rs.getObject("created_at", OffsetDateTime.class).toInstant()))
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PROFILE_NOT_FOUND",
                "Không tìm thấy hồ sơ của bạn."));
        List<String> roles = jdbc.sql("""
                SELECT role_code FROM user_roles
                WHERE tenant_id=:tenantId AND user_id=:userId ORDER BY role_code
                """)
            .param("tenantId", tenantId).param("userId", userId)
            .query(String.class).list();
        return profile.withRoles(roles);
    }

    private SelfProfile platformProfile() {
        UUID userId = actor.userId();
        SelfProfile profile = jdbc.sql("""
                SELECT id, username, display_name, status, last_login_at, created_at
                FROM platform_users WHERE id=:userId
                """)
            .param("userId", userId)
            .query((rs, row) -> new SelfProfile(
                "PLATFORM", rs.getObject("id", UUID.class), null, null, null,
                rs.getString("username"), rs.getString("display_name"), null, List.of(),
                rs.getString("status"), null, null,
                instant(rs.getObject("last_login_at", OffsetDateTime.class)),
                rs.getObject("created_at", OffsetDateTime.class).toInstant()))
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PROFILE_NOT_FOUND",
                "Không tìm thấy hồ sơ của bạn."));
        List<String> roles = jdbc.sql("""
                SELECT role_code FROM platform_user_roles
                WHERE user_id=:userId ORDER BY role_code
                """)
            .param("userId", userId).query(String.class).list();
        return profile.withRoles(roles);
    }

    private static Instant instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }

    public record ProfileTenant(UUID id, String slug, String name) {
    }

    public record SelfProfile(String scope, UUID id, ProfileTenant tenant, String profileType,
                              String code, String username, String displayName, String email,
                              List<String> roles, String status, String parentName,
                              String parentPhone, Instant lastLoginAt, Instant createdAt) {
        SelfProfile withRoles(List<String> nextRoles) {
            return new SelfProfile(scope, id, tenant, profileType, code, username, displayName,
                email, List.copyOf(nextRoles), status, parentName, parentPhone, lastLoginAt, createdAt);
        }
    }
}
