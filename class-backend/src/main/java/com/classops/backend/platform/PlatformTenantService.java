package com.classops.backend.platform;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.config.SeedProperties;
import com.classops.backend.security.CurrentActor;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class PlatformTenantService {
    private final JdbcClient jdbc;
    private final PasswordEncoder passwords;
    private final CurrentActor actor;
    private final ObjectMapper json;
    private final SeedProperties seed;

    public PlatformTenantService(JdbcClient jdbc, PasswordEncoder passwords,
                                 CurrentActor actor, ObjectMapper json, SeedProperties seed) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.actor = actor;
        this.json = json;
        this.seed = seed;
    }

    @Transactional(readOnly = true)
    public PageResponse<TenantView> list(String search, String status, int page, int pageSize,
                                         String sort) {
        actor.requirePlatform();
        page = Math.max(1, page);
        pageSize = Math.max(1, Math.min(100, pageSize));
        String normalizedStatus = normalizeStatus(status, true);
        String term = search == null ? "" : search.trim();
        String order = switch (sort == null ? "createdAt,desc" : sort) {
            case "name,asc" -> "t.name ASC";
            case "name,desc" -> "t.name DESC";
            case "createdAt,asc" -> "t.created_at ASC";
            default -> "t.created_at DESC";
        };
        String where = """
            WHERE (CAST(:status AS varchar) IS NULL OR t.status=:status)
              AND (:term='' OR unaccent(lower(t.name)) LIKE unaccent(lower(:pattern))
                    OR lower(t.slug) LIKE lower(:pattern))
            """;
        long total = jdbc.sql("SELECT count(*) FROM tenants t " + where)
            .param("status", normalizedStatus).param("term", term).param("pattern", "%" + term + "%")
            .query(Long.class).single();
        List<TenantView> items = jdbc.sql("""
                SELECT t.id, t.slug, t.name, t.status, t.created_at, t.version,
                       u.id admin_id, u.username admin_username, u.display_name admin_name,
                       u.email admin_email, u.status admin_status, u.version admin_version
                FROM tenants t LEFT JOIN users u
                  ON u.tenant_id=t.id AND u.id=t.initial_admin_user_id
                """ + where + " ORDER BY " + order + " LIMIT :limit OFFSET :offset")
            .param("status", normalizedStatus).param("term", term).param("pattern", "%" + term + "%")
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> new TenantView(
                rs.getObject("id", UUID.class), rs.getString("slug"), rs.getString("name"),
                rs.getString("status"), rs.getObject("admin_id", UUID.class) == null ? null :
                    new InitialAdminView(rs.getObject("admin_id", UUID.class),
                        rs.getString("admin_username"), rs.getString("admin_name"),
                        rs.getString("admin_email"), rs.getString("admin_status"),
                        rs.getLong("admin_version")),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(), rs.getLong("version")))
            .list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public TenantView get(UUID id) {
        actor.requirePlatform();
        return find(id);
    }

    @Transactional
    public CreatedTenant create(CreateTenant command) {
        actor.requirePlatform();
        String slug = command.slug().trim().toLowerCase(Locale.ROOT);
        String username = command.initialAdmin().username().trim().toLowerCase(Locale.ROOT);
        if (!slug.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) {
            throw bad("VALIDATION_ERROR", "Slug chỉ gồm chữ thường, số và dấu gạch ngang.");
        }
        UUID tenantId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        try {
            jdbc.sql("""
                    INSERT INTO tenants(id, slug, name, status)
                    VALUES (:id, :slug, :name, 'ACTIVE')
                    """).param("id", tenantId).param("slug", slug)
                .param("name", command.name().trim()).update();
            jdbc.sql("""
                    INSERT INTO users(id, tenant_id, username, display_name, email, password_hash,
                                      status, password_state, profile_type)
                    VALUES (:id, :tenantId, :username, :displayName, :email, :password,
                            'ACTIVE', 'READY', 'STAFF')
                    """).param("id", adminId).param("tenantId", tenantId).param("username", username)
                .param("displayName", command.initialAdmin().displayName().trim())
                .param("email", clean(command.initialAdmin().email()))
                .param("password", passwords.encode(defaultPassword())).update();
            jdbc.sql("INSERT INTO user_roles(tenant_id,user_id,role_code) VALUES (:tenant,:user,'ADMIN')")
                .param("tenant", tenantId).param("user", adminId).update();
            jdbc.sql("UPDATE tenants SET initial_admin_user_id=:admin WHERE id=:tenant")
                .param("admin", adminId).param("tenant", tenantId).update();
            audit(tenantId, "TENANT_CREATED", "Tenant", tenantId, null,
                Map.of("slug", slug, "name", command.name().trim(), "initialAdminUserId", adminId,
                    "reason", "PLATFORM_TENANT_PROVISIONING"));
        } catch (DuplicateKeyException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_TENANT_SLUG",
                "Slug trung tâm đã tồn tại.");
        }
        return new CreatedTenant(find(tenantId), defaultPassword());
    }

    @Transactional
    public TenantView rename(UUID id, String name, long version) {
        actor.requirePlatform();
        TenantView before = find(id);
        int changed = jdbc.sql("""
                UPDATE tenants SET name=:name, updated_at=now(), version=version+1
                WHERE id=:id AND version=:version
                """).param("name", name.trim()).param("id", id).param("version", version).update();
        ensureVersion(changed);
        audit(id, "TENANT_UPDATED", "Tenant", id, before,
            Map.of("name", name.trim(), "reason", "PLATFORM_TENANT_RENAME"));
        return find(id);
    }

    @Transactional
    public TenantView changeStatus(UUID id, String status, String reason, long version) {
        actor.requirePlatform();
        String next = normalizeStatus(status, false);
        TenantView before = find(id);
        int changed = jdbc.sql("""
                UPDATE tenants SET status=:status, updated_at=now(), version=version+1
                WHERE id=:id AND version=:version
                """).param("status", next).param("id", id).param("version", version).update();
        ensureVersion(changed);
        if (!before.status().equals(next)) {
            jdbc.sql("""
                UPDATE users SET token_version=token_version+1, updated_at=now()
                WHERE tenant_id=:tenant
                """).param("tenant", id).update();
        }
        audit(id, "TENANT_STATUS_CHANGED", "Tenant", id, before,
            Map.of("status", next, "reason", reason.trim()));
        return find(id);
    }

    @Transactional
    public InitialAdminView changeInitialAdminStatus(UUID tenantId, String status,
                                                     String reason, long version) {
        actor.requirePlatform();
        String next = normalizeStatus(status, false);
        InitialAdminView before = initialAdmin(tenantId);
        int changed = jdbc.sql("""
                UPDATE users SET status=:status, token_version=token_version+1,
                    updated_at=now(), version=version+1
                WHERE tenant_id=:tenant AND id=:id AND version=:version
                """).param("status", next).param("tenant", tenantId).param("id", before.id())
            .param("version", version).update();
        ensureVersion(changed);
        audit(tenantId, "INITIAL_ADMIN_STATUS_CHANGED", "User", before.id(), before,
            Map.of("status", next, "reason", reason.trim()));
        return initialAdmin(tenantId);
    }

    @Transactional
    public CredentialReset resetInitialAdmin(UUID tenantId, String reason, long version) {
        actor.requirePlatform();
        InitialAdminView before = initialAdmin(tenantId);
        int changed = jdbc.sql("""
                UPDATE users SET password_hash=:password, password_state='READY', status='ACTIVE',
                    token_version=token_version+1, updated_at=now(), version=version+1
                WHERE tenant_id=:tenant AND id=:id AND version=:version
                """).param("password", passwords.encode(defaultPassword())).param("tenant", tenantId)
            .param("id", before.id()).param("version", version).update();
        ensureVersion(changed);
        audit(tenantId, "INITIAL_ADMIN_CREDENTIAL_RESET", "User", before.id(), before,
            Map.of("passwordState", "READY", "status", "ACTIVE", "reason", reason.trim()));
        return new CredentialReset(before.id(), defaultPassword(), "READY");
    }

    private TenantView find(UUID id) {
        return jdbc.sql("""
                SELECT t.id, t.slug, t.name, t.status, t.created_at, t.version,
                       u.id admin_id, u.username admin_username, u.display_name admin_name,
                       u.email admin_email, u.status admin_status, u.version admin_version
                FROM tenants t LEFT JOIN users u ON u.tenant_id=t.id AND u.id=t.initial_admin_user_id
                WHERE t.id=:id
                """).param("id", id).query((rs, row) -> new TenantView(
                    rs.getObject("id", UUID.class), rs.getString("slug"), rs.getString("name"),
                    rs.getString("status"), rs.getObject("admin_id", UUID.class) == null ? null :
                        new InitialAdminView(rs.getObject("admin_id", UUID.class),
                            rs.getString("admin_username"), rs.getString("admin_name"),
                            rs.getString("admin_email"), rs.getString("admin_status"), rs.getLong("admin_version")),
                    rs.getObject("created_at", OffsetDateTime.class).toInstant(), rs.getLong("version")))
                .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                    "TENANT_NOT_FOUND", "Không tìm thấy trung tâm."));
    }

    private InitialAdminView initialAdmin(UUID tenantId) {
        TenantView tenant = find(tenantId);
        if (tenant.initialAdmin() == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "INITIAL_ADMIN_NOT_FOUND",
                "Không tìm thấy Admin ban đầu của trung tâm.");
        }
        return tenant.initialAdmin();
    }

    private void audit(UUID tenantId, String action, String type, UUID entityId,
                       Object before, Object after) {
        jdbc.sql("""
                INSERT INTO audit_events(id, tenant_id, actor_type, platform_actor_user_id,
                                         action, entity_type, entity_id, old_value, new_value)
                VALUES (:id,:tenant,'PLATFORM',:actor,:action,:type,:entity,
                        CAST(:oldValue AS jsonb),CAST(:newValue AS jsonb))
                """).param("id", UUID.randomUUID()).param("tenant", tenantId)
            .param("actor", actor.userId()).param("action", action).param("type", type)
            .param("entity", entityId).param("oldValue", toJson(before)).param("newValue", toJson(after)).update();
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try { return json.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException(ex); }
    }

    private void ensureVersion(int changed) {
        if (changed != 1) throw new ApiException(HttpStatus.CONFLICT, "VERSION_CONFLICT",
            "Dữ liệu đã được cập nhật bởi người khác. Vui lòng tải lại.");
    }

    private String normalizeStatus(String status, boolean nullable) {
        if (status == null || status.isBlank()) return nullable ? null : failStatus();
        String value = status.toUpperCase(Locale.ROOT);
        if (!List.of("ACTIVE", "LOCKED").contains(value)) return failStatus();
        return value;
    }

    private String failStatus() { throw bad("VALIDATION_ERROR", "Trạng thái không hợp lệ."); }
    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String defaultPassword() { return seed.defaultPassword(); }

    public record InitialAdminInput(String username, String displayName, String email) {}
    public record CreateTenant(String name, String slug, InitialAdminInput initialAdmin) {}
    public record InitialAdminView(UUID id, String username, String displayName, String email,
                                   String status, long version) {}
    public record TenantView(UUID id, String slug, String name, String status,
                             InitialAdminView initialAdmin, Instant createdAt, long version) {}
    public record CreatedTenant(TenantView tenant, String temporaryPassword) {}
    public record CredentialReset(UUID accountId, String temporaryPassword, String passwordState) {}
}
