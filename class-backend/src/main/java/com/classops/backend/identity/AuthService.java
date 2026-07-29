package com.classops.backend.identity;

import com.classops.backend.common.ApiException;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.security.SecurityProperties;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AuthService {
    private final JdbcClient jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final SecurityProperties properties;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final LoginAttemptService loginAttempts;
    private final CurrentActor actor;
    private final EntityManager entityManager;

    public AuthService(JdbcClient jdbc, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder,
                       SecurityProperties properties, TenantRepository tenantRepository,
                       UserRepository userRepository, LoginAttemptService loginAttempts,
                       CurrentActor actor, EntityManager entityManager) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.loginAttempts = loginAttempts;
        this.actor = actor;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public TenantDto tenant(String slug) {
        TenantEntity entity = tenantRepository.findBySlug(slug)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND",
                "Không tìm thấy trung tâm."));
        if (!"ACTIVE".equals(entity.getStatus())) {
            throw new ApiException(HttpStatus.LOCKED, "TENANT_LOCKED",
                "Trung tâm đang bị khóa. Vui lòng liên hệ quản trị nền tảng.");
        }
        return tenantDto(entity);
    }

    @Transactional
    public AuthSession login(String tenantSlug, String username, String password, String clientIp) {
        TenantDto tenant = tenant(tenantSlug);
        loginAttempts.ensureAllowed(tenant.id(), username, clientIp);
        UserEntity user = userRepository
            .findByTenantIdAndUsernameIgnoreCase(tenant.id(), username.trim())
            .orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            loginAttempts.recordFailure(tenant.id(), username, clientIp);
            throw invalidCredentials();
        }
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                "Tài khoản đang bị khóa. Vui lòng liên hệ quản lý trung tâm.");
        }
        loginAttempts.clear(tenant.id(), username, clientIp);
        return issueSession(user, tenant);
    }

    @Transactional
    public MessageResponse forgotPassword(String tenantSlug, String username, String clientIp) {
        String message =
            "Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email đã đăng ký.";
        TenantEntity tenant = tenantRepository.findBySlug(tenantSlug).orElse(null);
        if (tenant == null || !"ACTIVE".equals(tenant.getStatus())) {
            return new MessageResponse(message);
        }
        UserEntity user = userRepository
            .findByTenantIdAndUsernameIgnoreCase(tenant.getId(), username.trim())
            .orElse(null);
        boolean canQueueEmail = user != null
            && user.getEmail() != null && !user.getEmail().isBlank()
            && "ACTIVE".equals(user.getStatus());
        jdbc.sql("""
                INSERT INTO password_reset_requests (
                  id, tenant_id, user_id, requested_username, request_ip_hash, status
                ) VALUES (
                  :id, :tenantId, :userId, :username, :ipHash, :status
                )
                """)
            .param("id", UUID.randomUUID())
            .param("tenantId", tenant.getId())
            .param("userId", user == null ? null : user.getId())
            .param("username", username.trim())
            .param("ipHash", LoginAttemptService.hashClientIp(clientIp))
            .param("status", canQueueEmail ? "QUEUED_FOR_EMAIL" : "RECEIVED")
            .update();
        if (canQueueEmail) {
            jdbc.sql("""
                    INSERT INTO outbox_events (
                      id, tenant_id, aggregate_type, aggregate_id, event_type, payload
                    ) VALUES (
                      :id, :tenantId, 'User', :userId, 'PASSWORD_RESET_REQUESTED',
                      jsonb_build_object('userId', CAST(:userId AS text), 'email', :email)
                    )
                    """)
                .param("id", UUID.randomUUID())
                .param("tenantId", tenant.getId())
                .param("userId", user.getId())
                .param("email", user.getEmail())
                .update();
        }
        return new MessageResponse(message);
    }

    @Transactional
    public AuthSession changePassword(String newPassword) {
        UUID tenantId = actor.tenantId();
        UUID userId = actor.userId();
        UserEntity current = userRepository.findById(userId)
            .filter(user -> tenantId.equals(user.getTenantId()))
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                "Phiên đổi mật khẩu không hợp lệ."));
        if (!"MUST_CHANGE".equals(current.getPasswordState())) {
            throw new ApiException(HttpStatus.CONFLICT, "PASSWORD_CHANGE_NOT_REQUIRED",
                "Tài khoản không ở trạng thái bắt buộc đổi mật khẩu.");
        }
        int changed = jdbc.sql("""
                UPDATE users
                SET password_hash=:passwordHash, password_state='READY',
                    token_version=token_version+1, version=version+1, updated_at=now()
                WHERE tenant_id=:tenantId AND id=:userId
                  AND status='ACTIVE' AND password_state='MUST_CHANGE'
                """)
            .param("passwordHash", passwordEncoder.encode(newPassword))
            .param("tenantId", tenantId)
            .param("userId", userId)
            .update();
        if (changed != 1) {
            throw new ApiException(HttpStatus.CONFLICT, "PASSWORD_STATE_CHANGED",
                "Trạng thái tài khoản đã thay đổi. Vui lòng đăng nhập lại.");
        }
        entityManager.clear();
        jdbc.sql("""
                INSERT INTO audit_events (
                  id, tenant_id, actor_user_id, action, entity_type, entity_id,
                  old_value, new_value
                ) VALUES (
                  :id, :tenantId, :userId, 'PASSWORD_CHANGED', 'User', :userId,
                  CAST(:oldValue AS jsonb), CAST(:newValue AS jsonb)
                )
                """)
            .param("id", UUID.randomUUID())
            .param("tenantId", tenantId)
            .param("userId", userId)
            .param("oldValue", "{\"passwordState\":\"MUST_CHANGE\"}")
            .param("newValue", "{\"passwordState\":\"READY\"}")
            .update();
        UserEntity updated = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                "Không tìm thấy tài khoản."));
        TenantEntity tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND",
                "Không tìm thấy trung tâm."));
        return issueSession(updated, tenantDto(tenant));
    }

    private AuthSession issueSession(UserEntity user, TenantDto tenant) {
        List<String> roles = jdbc.sql("""
                SELECT role_code FROM user_roles
                WHERE tenant_id = :tenantId AND user_id = :userId ORDER BY role_code
                """)
            .param("tenantId", tenant.id())
            .param("userId", user.getId())
            .query(String.class)
            .list();
        List<String> permissions = PermissionCatalog.union(roles);
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.accessTokenTtl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("class-backend")
            .issuedAt(now)
            .expiresAt(expiresAt)
            .subject(user.getId().toString())
            .claim("tenantId", tenant.id().toString())
            .claim("tenantSlug", tenant.slug())
            .claim("roles", roles)
            .claim("permissions", permissions)
            .claim("tokenVersion", user.getTokenVersion())
            .claim("passwordState", user.getPasswordState())
            .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(
            JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        UserDto dto = new UserDto(user.getId(), user.getTenantId(), user.getUsername(),
            user.getDisplayName(), roles, user.getStatus(), user.getPasswordState());
        return new AuthSession(token, dto, tenant, expiresAt);
    }

    private TenantDto tenantDto(TenantEntity entity) {
        return new TenantDto(entity.getId(), entity.getSlug(), entity.getName(), entity.getStatus());
    }

    private ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
            "Tên đăng nhập hoặc mật khẩu không đúng.");
    }

    public record TenantDto(UUID id, String slug, String name, String status) {
    }

    public record UserDto(UUID id, UUID tenantId, String username, String displayName,
                          List<String> roles, String status, String passwordState) {
    }

    public record AuthSession(String token, UserDto user, TenantDto tenant, Instant expiresAt) {
    }

    public record MessageResponse(String message) {
    }
}
