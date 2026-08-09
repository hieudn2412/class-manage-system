package com.classops.backend.security;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

public final class AccountJwtValidator implements OAuth2TokenValidator<Jwt> {
    private static final OAuth2Error INVALID = new OAuth2Error(
        "invalid_token", "Tài khoản hoặc tenant đã bị khóa.", null);
    private final JdbcClient jdbc;

    public AccountJwtValidator(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        try {
            String scope = token.getClaimAsString("accountScope");
            UUID userId = UUID.fromString(token.getSubject());
            Number tokenVersion = token.getClaim("tokenVersion");
            int version = tokenVersion == null ? -1 : tokenVersion.intValue();
            boolean valid = "PLATFORM".equals(scope)
                ? validPlatform(userId, version, token)
                : "TENANT".equals(scope) && validTenant(userId, version, token);
            return valid ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(INVALID);
        } catch (RuntimeException ex) {
            return OAuth2TokenValidatorResult.failure(INVALID);
        }
    }

    private boolean validPlatform(UUID userId, int tokenVersion, Jwt token) {
        if (token.hasClaim("tenantId")) {
            return false;
        }
        return jdbc.sql("""
                SELECT EXISTS (
                  SELECT 1 FROM platform_users
                  WHERE id=:userId AND status='ACTIVE' AND token_version=:tokenVersion
                )
                """)
            .param("userId", userId).param("tokenVersion", tokenVersion)
            .query(Boolean.class).single();
    }

    private boolean validTenant(UUID userId, int tokenVersion, Jwt token) {
        UUID tenantId = UUID.fromString(token.getClaimAsString("tenantId"));
        return jdbc.sql("""
                SELECT EXISTS (
                  SELECT 1
                  FROM users u
                  JOIN tenants t ON t.id=u.tenant_id
                  WHERE u.tenant_id=:tenantId AND u.id=:userId
                    AND u.status='ACTIVE' AND t.status='ACTIVE'
                    AND u.token_version=:tokenVersion
                )
                """)
            .param("tenantId", tenantId).param("userId", userId)
            .param("tokenVersion", tokenVersion)
            .query(Boolean.class).single();
    }
}
