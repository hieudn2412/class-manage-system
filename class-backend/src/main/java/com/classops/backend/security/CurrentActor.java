package com.classops.backend.security;

import com.classops.backend.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class CurrentActor {
    private Jwt jwt() {
        if (SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken token) {
            return token.getToken();
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Chưa đăng nhập.");
    }

    public UUID userId() {
        return UUID.fromString(jwt().getSubject());
    }

    public UUID tenantId() {
        String claim = jwt().getClaimAsString("tenantId");
        if (claim == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_CONTEXT_REQUIRED",
                "Tài khoản không thuộc trung tâm nào.");
        }
        return UUID.fromString(claim);
    }

    public String tenantSlug() {
        return jwt().getClaimAsString("tenantSlug");
    }

    public List<String> roles() {
        List<String> result = jwt().getClaimAsStringList("roles");
        return result == null ? List.of() : result;
    }

    public boolean hasPermission(String permission) {
        return jwt().getClaimAsStringList("permissions").contains(permission);
    }
}
