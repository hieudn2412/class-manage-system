package com.classops.backend.accounts;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.platform.PlatformTenantService;
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
import java.util.*;

@Service
public class AccountService {
    private static final Set<String> STAFF_ROLES = Set.of("ADMIN", "ACADEMIC_MANAGER", "ACCOUNTANT");
    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final PasswordEncoder passwords;
    private final ObjectMapper json;

    public AccountService(JdbcClient jdbc, CurrentActor actor, PasswordEncoder passwords,
                          ObjectMapper json) {
        this.jdbc = jdbc; this.actor = actor; this.passwords = passwords; this.json = json;
    }

    @Transactional(readOnly = true)
    public PageResponse<AccountView> list(String search, String status, String role,
                                          String profileType, int page, int pageSize, String sort) {
        Access access = access();
        page = Math.max(1, page); pageSize = Math.max(1, Math.min(100, pageSize));
        String term = clean(search) == null ? "" : search.trim();
        String normalizedStatus = optionalEnum(status, Set.of("ACTIVE", "LOCKED"));
        String normalizedProfile = optionalEnum(profileType, Set.of("STAFF", "TEACHER", "STUDENT"));
        String normalizedRole = optionalEnum(role, Set.of("ADMIN", "ACADEMIC_MANAGER", "ACCOUNTANT", "TEACHER", "STUDENT"));
        String restriction = access.admin ? "" : """
             AND u.profile_type IN ('TEACHER','STUDENT')
             AND NOT EXISTS (SELECT 1 FROM user_roles mr WHERE mr.tenant_id=u.tenant_id
                 AND mr.user_id=u.id AND mr.role_code IN ('ADMIN','ACADEMIC_MANAGER','ACCOUNTANT'))
            """;
        String where = """
            WHERE u.tenant_id=:tenant
              AND (CAST(:status AS varchar) IS NULL OR u.status=:status)
              AND (CAST(:profile AS varchar) IS NULL OR u.profile_type=:profile)
              AND (CAST(:role AS varchar) IS NULL OR EXISTS (SELECT 1 FROM user_roles fr WHERE fr.tenant_id=u.tenant_id
                  AND fr.user_id=u.id AND fr.role_code=:role))
              AND (:term='' OR unaccent(lower(u.display_name)) LIKE unaccent(lower(:pattern))
                  OR lower(u.username) LIKE lower(:pattern)
                  OR unaccent(lower(coalesce(u.email,''))) LIKE unaccent(lower(:pattern))
                  OR lower(coalesce(tp.code,sp.code,'')) LIKE lower(:pattern))
            """ + restriction;
        String from = " FROM users u LEFT JOIN teacher_profiles tp ON tp.tenant_id=u.tenant_id AND tp.user_id=u.id " +
            "LEFT JOIN student_profiles sp ON sp.tenant_id=u.tenant_id AND sp.user_id=u.id ";
        JdbcClient.StatementSpec count = bind(jdbc.sql("SELECT count(*)" + from + where), access.tenantId,
            normalizedStatus, normalizedProfile, normalizedRole, term);
        long total = count.query(Long.class).single();
        String order = switch (sort == null ? "createdAt,desc" : sort) {
            case "displayName,asc" -> "u.display_name ASC";
            case "displayName,desc" -> "u.display_name DESC";
            case "createdAt,asc" -> "u.created_at ASC";
            default -> "u.created_at DESC";
        };
        List<UUID> ids = bind(jdbc.sql("SELECT u.id" + from + where + " ORDER BY " + order +
                " LIMIT :limit OFFSET :offset"), access.tenantId, normalizedStatus,
                normalizedProfile, normalizedRole, term)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query(UUID.class).list();
        return PageResponse.of(ids.stream().map(id -> find(access.tenantId, id)).toList(),
            page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public AccountView get(UUID id) {
        Access access = access();
        AccountView value = find(access.tenantId, id);
        requireVisible(access, value);
        return value;
    }

    @Transactional
    public CreatedAccount create(CreateAccount command) {
        Access access = access();
        String profile = requiredEnum(command.profileType(), Set.of("STAFF", "TEACHER", "STUDENT"));
        List<String> roles = validateRoles(profile, command.roles(), access.admin);
        if (!access.admin && "STAFF".equals(profile)) forbidden();
        if ("STUDENT".equals(profile) && (clean(command.parentName()) == null || clean(command.parentPhone()) == null)) {
            throw bad("VALIDATION_ERROR", "Học sinh bắt buộc có tên và số điện thoại phụ huynh.");
        }
        UUID id = UUID.randomUUID();
        String username = command.username().trim().toLowerCase(Locale.ROOT);
        try {
            jdbc.sql("""
                INSERT INTO users(id,tenant_id,username,display_name,email,password_hash,status,
                                  password_state,profile_type)
                VALUES (:id,:tenant,:username,:name,:email,:password,'ACTIVE','READY',:profile)
                """).param("id", id).param("tenant", access.tenantId).param("username", username)
                .param("name", command.displayName().trim()).param("email", clean(command.email()))
                .param("password", passwords.encode(PlatformTenantService.DEFAULT_PASSWORD))
                .param("profile", profile).update();
            for (String role : roles) jdbc.sql("""
                INSERT INTO user_roles(tenant_id,user_id,role_code) VALUES (:tenant,:id,:role)
                """).param("tenant", access.tenantId).param("id", id).param("role", role).update();
            if ("TEACHER".equals(profile)) {
                jdbc.sql("INSERT INTO teacher_profiles(id,tenant_id,user_id,code) VALUES (:pid,:tenant,:id,:code)")
                    .param("pid", UUID.randomUUID()).param("tenant", access.tenantId).param("id", id)
                    .param("code", nextCode(access.tenantId, "TEACHER")).update();
            } else if ("STUDENT".equals(profile)) {
                jdbc.sql("""
                    INSERT INTO student_profiles(id,tenant_id,user_id,code,parent_name,parent_phone)
                    VALUES (:pid,:tenant,:id,:code,:parentName,:parentPhone)
                    """).param("pid", UUID.randomUUID()).param("tenant", access.tenantId).param("id", id)
                    .param("code", nextCode(access.tenantId, "STUDENT"))
                    .param("parentName", clean(command.parentName())).param("parentPhone", clean(command.parentPhone())).update();
            }
            audit(access.tenantId, "ACCOUNT_CREATED", id, null, Map.of("profileType", profile,
                "username", username, "roles", roles, "reason", "TENANT_ACCOUNT_PROVISIONING"));
        } catch (DuplicateKeyException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_USERNAME", "Tên đăng nhập đã tồn tại trong trung tâm.");
        }
        return new CreatedAccount(find(access.tenantId, id), PlatformTenantService.DEFAULT_PASSWORD);
    }

    @Transactional
    public AccountView update(UUID id, UpdateAccount command) {
        Access access = access();
        lockTenant(access.tenantId);
        AccountView before = find(access.tenantId, id); requireVisible(access, before);
        List<String> roles = validateRoles(before.profileType(), command.roles(), access.admin);
        if (id.equals(actor.userId()) && before.roles().contains("ADMIN") && !roles.contains("ADMIN")) selfForbidden();
        if (before.roles().contains("ADMIN") && !roles.contains("ADMIN")) ensureAnotherActiveAdmin(access.tenantId, id);
        int changed = jdbc.sql("""
            UPDATE users SET display_name=:name,email=:email,updated_at=now(),version=version+1,
                token_version=token_version + CASE WHEN :rolesChanged THEN 1 ELSE 0 END
            WHERE tenant_id=:tenant AND id=:id AND version=:version
            """).param("name", command.displayName().trim()).param("email", clean(command.email()))
            .param("rolesChanged", !new HashSet<>(before.roles()).equals(new HashSet<>(roles)))
            .param("tenant", access.tenantId).param("id", id).param("version", command.version()).update();
        ensureVersion(changed);
        jdbc.sql("DELETE FROM user_roles WHERE tenant_id=:tenant AND user_id=:id")
            .param("tenant", access.tenantId).param("id", id).update();
        for (String role : roles) jdbc.sql("INSERT INTO user_roles(tenant_id,user_id,role_code) VALUES (:tenant,:id,:role)")
            .param("tenant", access.tenantId).param("id", id).param("role", role).update();
        if ("STUDENT".equals(before.profileType())) {
            if (clean(command.parentName()) == null || clean(command.parentPhone()) == null)
                throw bad("VALIDATION_ERROR", "Học sinh bắt buộc có thông tin phụ huynh.");
            jdbc.sql("""
                UPDATE student_profiles SET parent_name=:name,parent_phone=:phone
                WHERE tenant_id=:tenant AND user_id=:id
                """).param("name", clean(command.parentName())).param("phone", clean(command.parentPhone()))
                .param("tenant", access.tenantId).param("id", id).update();
        }
        audit(access.tenantId, "ACCOUNT_UPDATED", id, before,
            Map.of("displayName", command.displayName().trim(), "roles", roles,
                "reason", "TENANT_ACCOUNT_PROFILE_UPDATE"));
        return find(access.tenantId, id);
    }

    @Transactional
    public AccountView changeStatus(UUID id, String status, String reason, long version) {
        Access access = access(); lockTenant(access.tenantId);
        AccountView before = find(access.tenantId, id); requireVisible(access, before);
        if (id.equals(actor.userId())) selfForbidden();
        String next = requiredEnum(status, Set.of("ACTIVE", "LOCKED"));
        if ("LOCKED".equals(next) && before.roles().contains("ADMIN")) ensureAnotherActiveAdmin(access.tenantId, id);
        int changed = jdbc.sql("""
            UPDATE users SET status=:status,token_version=token_version+1,updated_at=now(),version=version+1
            WHERE tenant_id=:tenant AND id=:id AND version=:version
            """).param("status", next).param("tenant", access.tenantId).param("id", id).param("version", version).update();
        ensureVersion(changed);
        audit(access.tenantId, "ACCOUNT_STATUS_CHANGED", id, before, Map.of("status", next, "reason", reason.trim()));
        return find(access.tenantId, id);
    }

    @Transactional
    public CredentialReset reset(UUID id, String reason, long version) {
        Access access = access(); AccountView before = find(access.tenantId, id); requireVisible(access, before);
        if (id.equals(actor.userId())) selfForbidden();
        int changed = jdbc.sql("""
            UPDATE users SET password_hash=:password,password_state='READY',token_version=token_version+1,
                updated_at=now(),version=version+1 WHERE tenant_id=:tenant AND id=:id AND version=:version
            """).param("password", passwords.encode(PlatformTenantService.DEFAULT_PASSWORD))
            .param("tenant", access.tenantId).param("id", id).param("version", version).update();
        ensureVersion(changed);
        audit(access.tenantId, "ACCOUNT_CREDENTIAL_RESET", id, before,
            Map.of("passwordState", "READY", "reason", reason.trim()));
        return new CredentialReset(id, PlatformTenantService.DEFAULT_PASSWORD, "READY");
    }

    private AccountView find(UUID tenantId, UUID id) {
        AccountView view = jdbc.sql("""
            SELECT u.id,u.profile_type,u.username,u.display_name,u.email,u.status,u.password_state,
                   u.last_login_at,u.created_at,u.version,coalesce(tp.code,sp.code) code,
                   sp.parent_name,sp.parent_phone
            FROM users u LEFT JOIN teacher_profiles tp ON tp.tenant_id=u.tenant_id AND tp.user_id=u.id
            LEFT JOIN student_profiles sp ON sp.tenant_id=u.tenant_id AND sp.user_id=u.id
            WHERE u.tenant_id=:tenant AND u.id=:id
            """).param("tenant", tenantId).param("id", id).query((rs,row) -> new AccountView(
                rs.getObject("id", UUID.class), rs.getString("profile_type"), rs.getString("code"),
                rs.getString("username"), rs.getString("display_name"), rs.getString("email"), List.of(),
                rs.getString("status"), rs.getString("password_state"), rs.getString("parent_name"),
                rs.getString("parent_phone"), instant(rs.getObject("last_login_at", OffsetDateTime.class)),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(), rs.getLong("version")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản."));
        List<String> roles = jdbc.sql("SELECT role_code FROM user_roles WHERE tenant_id=:tenant AND user_id=:id ORDER BY role_code")
            .param("tenant", tenantId).param("id", id).query(String.class).list();
        return new AccountView(view.id(), view.profileType(), view.code(), view.username(), view.displayName(),
            view.email(), roles, view.status(), view.passwordState(), view.parentName(), view.parentPhone(),
            view.lastLoginAt(), view.createdAt(), view.version());
    }

    private Access access() {
        UUID tenant = actor.tenantId();
        boolean admin = actor.hasPermission("MANAGE_TENANT_ACCOUNTS");
        if (!admin && !actor.hasPermission("MANAGE_LEARNING_ACCOUNTS")) forbidden();
        return new Access(tenant, admin);
    }

    private void requireVisible(Access access, AccountView account) {
        if (!access.admin && (!(Set.of("TEACHER", "STUDENT").contains(account.profileType())) ||
            account.roles().stream().anyMatch(STAFF_ROLES::contains))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");
        }
    }

    private List<String> validateRoles(String profile, List<String> input, boolean admin) {
        Set<String> roles = new LinkedHashSet<>(input == null ? List.of() : input.stream()
            .map(v -> v.toUpperCase(Locale.ROOT)).toList());
        boolean valid = switch (profile) {
            case "STUDENT" -> roles.equals(Set.of("STUDENT"));
            case "TEACHER" -> roles.contains("TEACHER") && roles.stream().allMatch(r -> r.equals("TEACHER") || STAFF_ROLES.contains(r));
            case "STAFF" -> !roles.isEmpty() && roles.stream().allMatch(STAFF_ROLES::contains);
            default -> false;
        };
        if (!admin && !(roles.equals(Set.of("TEACHER")) || roles.equals(Set.of("STUDENT")))) valid = false;
        if (!valid) throw bad("INVALID_ROLE_COMBINATION", "Tổ hợp vai trò không phù hợp với loại hồ sơ hoặc quyền hiện tại.");
        return roles.stream().sorted().toList();
    }

    private String nextCode(UUID tenantId, String profile) {
        int number = jdbc.sql("""
            INSERT INTO tenant_profile_counters(tenant_id,profile_type,next_value) VALUES (:tenant,:profile,2)
            ON CONFLICT (tenant_id,profile_type) DO UPDATE SET next_value=tenant_profile_counters.next_value+1
            RETURNING next_value-1
            """).param("tenant", tenantId).param("profile", profile).query(Integer.class).single();
        return ("TEACHER".equals(profile) ? "GV-" : "HS-") + String.format("%04d", number);
    }

    private void lockTenant(UUID tenantId) {
        jdbc.sql("SELECT id FROM tenants WHERE id=:id FOR UPDATE").param("id", tenantId).query(UUID.class).single();
    }
    private void ensureAnotherActiveAdmin(UUID tenantId, UUID excluded) {
        long count = jdbc.sql("""
            SELECT count(*) FROM users u JOIN user_roles r ON r.tenant_id=u.tenant_id AND r.user_id=u.id
            WHERE u.tenant_id=:tenant AND u.id<>:excluded AND u.status='ACTIVE' AND r.role_code='ADMIN'
            """).param("tenant", tenantId).param("excluded", excluded).query(Long.class).single();
        if (count == 0) throw new ApiException(HttpStatus.CONFLICT, "LAST_ACTIVE_ADMIN",
            "Trung tâm phải luôn còn ít nhất một Admin hoạt động.");
    }

    private void audit(UUID tenantId, String action, UUID id, Object before, Object after) {
        jdbc.sql("""
            INSERT INTO audit_events(id,tenant_id,actor_user_id,actor_type,action,entity_type,entity_id,old_value,new_value)
            VALUES (:audit,:tenant,:actor,'USER',:action,'User',:entity,CAST(:oldValue AS jsonb),CAST(:newValue AS jsonb))
            """).param("audit", UUID.randomUUID()).param("tenant", tenantId).param("actor", actor.userId())
            .param("action", action).param("entity", id).param("oldValue", toJson(before)).param("newValue", toJson(after)).update();
    }
    private String toJson(Object value) { if (value == null) return null; try { return json.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException(ex); } }
    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec q, UUID tenant, String status,
                                           String profile, String role, String term) {
        return q.param("tenant", tenant).param("status", status).param("profile", profile)
            .param("role", role).param("term", term).param("pattern", "%" + term + "%");
    }
    private String optionalEnum(String value, Set<String> allowed) { return clean(value) == null ? null : requiredEnum(value, allowed); }
    private String requiredEnum(String value, Set<String> allowed) {
        String result = value == null ? "" : value.toUpperCase(Locale.ROOT);
        if (!allowed.contains(result)) throw bad("VALIDATION_ERROR", "Giá trị bộ lọc hoặc trạng thái không hợp lệ.");
        return result;
    }
    private void ensureVersion(int changed) { if (changed != 1) throw new ApiException(HttpStatus.CONFLICT,
        "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại."); }
    private void selfForbidden() { throw new ApiException(HttpStatus.CONFLICT, "SELF_MANAGEMENT_FORBIDDEN",
        "Không thể tự khóa, tự bỏ quyền Admin hoặc tự reset tài khoản."); }
    private void forbidden() { throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Bạn không có quyền quản lý tài khoản này."); }
    private ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static Instant instant(OffsetDateTime value) { return value == null ? null : value.toInstant(); }

    private record Access(UUID tenantId, boolean admin) {}
    public record CreateAccount(String profileType, String username, String displayName, String email,
                                List<String> roles, String parentName, String parentPhone) {}
    public record UpdateAccount(String displayName, String email, List<String> roles,
                                String parentName, String parentPhone, long version) {}
    public record AccountView(UUID id, String profileType, String code, String username,
                              String displayName, String email, List<String> roles, String status,
                              String passwordState, String parentName, String parentPhone,
                              Instant lastLoginAt, Instant createdAt, long version) {}
    public record CreatedAccount(AccountView account, String temporaryPassword) {}
    public record CredentialReset(UUID accountId, String temporaryPassword, String passwordState) {}
}
