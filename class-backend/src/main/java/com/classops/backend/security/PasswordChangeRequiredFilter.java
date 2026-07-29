package com.classops.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {
    private static final String CHANGE_PASSWORD_PATH = "/api/v1/auth/change-password";

    private final ObjectMapper mapper;

    public PasswordChangeRequiredFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain)
        throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token
            && "MUST_CHANGE".equals(token.getToken().getClaimAsString("passwordState"))
            && request.getRequestURI().startsWith("/api/v1/")
            && !CHANGE_PASSWORD_PATH.equals(request.getRequestURI())) {
            writeProblem(request, response);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private void writeProblem(HttpServletRequest request, HttpServletResponse response)
        throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "https://classops.vn/problems/password-change-required");
        body.put("title", "Forbidden");
        body.put("status", HttpServletResponse.SC_FORBIDDEN);
        body.put("detail", "Bạn phải đổi mật khẩu tạm trước khi truy cập dữ liệu nghiệp vụ.");
        body.put("instance", request.getRequestURI());
        body.put("code", "PASSWORD_CHANGE_REQUIRED");
        body.put("message", "Bạn phải đổi mật khẩu tạm trước khi truy cập dữ liệu nghiệp vụ.");
        body.put("fieldErrors", Map.of());
        body.put("details", Map.of());
        body.put("timestamp", Instant.now().toString());
        body.put("traceId", MDC.get("traceId"));
        mapper.writeValue(response.getOutputStream(), body);
    }
}
