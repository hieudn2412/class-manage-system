package com.classops.backend.tenantemail;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class GmailApiClient {
    private final GmailProperties properties;
    private final RestClient rest;

    public GmailApiClient(GmailProperties properties, RestClient.Builder builder) {
        this.properties = properties;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.httpTimeout());
        requestFactory.setReadTimeout(properties.httpTimeout());
        this.rest = builder.requestFactory(requestFactory).build();
    }

    public AuthorizationGrant exchangeCode(String code, String verifier) {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("code", code);
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("redirect_uri", properties.redirectUri());
        form.add("grant_type", "authorization_code");
        form.add("code_verifier", verifier);
        TokenResponse token = tokenRequest(form);
        UserInfoResponse user = userInfo(token.accessToken());
        return new AuthorizationGrant(
            token.refreshToken(),
            token.accessToken(),
            token.scope() == null ? "" : token.scope(),
            user.sub(),
            user.email(),
            Boolean.TRUE.equals(user.emailVerified())
        );
    }

    public String sendMessage(String refreshToken, String tenantName, String fromEmail,
                              String to, String title, String body, String deepLink) {
        String accessToken = refreshAccessToken(refreshToken);
        String raw = mimeRaw(tenantName, fromEmail, to, title, body, deepLink);
        try {
            SendResponse response = rest.post()
                .uri(properties.sendUri())
                .contentType(MediaType.APPLICATION_JSON)
                .headers(headers -> headers.setBearerAuth(accessToken))
                .body(Map.of("raw", raw))
                .retrieve()
                .body(SendResponse.class);
            return response == null ? null : response.id();
        } catch (RestClientResponseException ex) {
            throw sendFailure(ex);
        } catch (ResourceAccessException ex) {
            throw new GmailSendException("GMAIL_SEND_TIMEOUT", "Gmail API timeout.",
                true, false, properties.httpTimeout());
        }
    }

    public boolean hasSendScope(String scopes) {
        Set<String> granted = Arrays.stream(scopes == null ? new String[0] : scopes.split("\\s+"))
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .collect(Collectors.toSet());
        return granted.contains(GmailProperties.GMAIL_SEND_SCOPE)
            || granted.contains("gmail.send");
    }

    private String refreshAccessToken(String refreshToken) {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");
        return tokenRequest(form).accessToken();
    }

    private TokenResponse tokenRequest(LinkedMultiValueMap<String, String> form) {
        try {
            TokenResponse token = rest.post()
                .uri(properties.tokenUri())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(TokenResponse.class);
            if (token == null || token.accessToken() == null || token.accessToken().isBlank()) {
                throw new GmailSendException("GMAIL_SEND_FAILED", "Google did not return an access token.",
                    false, false, null);
            }
            return token;
        } catch (RestClientResponseException ex) {
            if (ex.getResponseBodyAsString().toLowerCase(Locale.ROOT).contains("invalid_grant")) {
                throw new GmailSendException("GMAIL_REAUTH_REQUIRED",
                    "Quyền Gmail đã bị thu hồi hoặc refresh token không còn hợp lệ.",
                    false, true, null);
            }
            throw sendFailure(ex);
        } catch (ResourceAccessException ex) {
            throw new GmailSendException("GMAIL_SEND_TIMEOUT", "Không thể kết nối Google OAuth.",
                true, false, properties.httpTimeout());
        }
    }

    private UserInfoResponse userInfo(String accessToken) {
        try {
            UserInfoResponse response = rest.get()
                .uri(properties.userInfoUri())
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .body(UserInfoResponse.class);
            if (response == null) {
                throw new GmailSendException("GMAIL_SEND_FAILED", "Google không trả hồ sơ email.",
                    false, false, null);
            }
            return response;
        } catch (RestClientResponseException ex) {
            throw sendFailure(ex);
        }
    }

    private GmailSendException sendFailure(RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        Duration retryAfter = retryAfter(ex);
        if (status == 401 || status == 403) {
            return new GmailSendException("GMAIL_REAUTH_REQUIRED",
                "Quyền Gmail cần được xác thực lại.", false, true, null);
        }
        if (status == 429 || status >= 500) {
            return new GmailSendException(status == 429 ? "GMAIL_RATE_LIMITED" : "GMAIL_SEND_FAILED",
                "Google tạm thời chưa nhận email.", true, false, retryAfter);
        }
        return new GmailSendException("GMAIL_SEND_FAILED",
            "Google từ chối email hoặc nội dung MIME.", false, false, null);
    }

    private Duration retryAfter(RestClientResponseException ex) {
        List<String> values = ex.getResponseHeaders() == null
            ? List.of()
            : ex.getResponseHeaders().getOrEmpty("Retry-After");
        if (values.isEmpty()) return null;
        try {
            return Duration.ofSeconds(Math.max(1, Long.parseLong(values.get(0))));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String mimeRaw(String tenantName, String fromEmail, String to, String title,
                           String body, String deepLink) {
        try {
            MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
            message.setFrom(new InternetAddress(fromEmail, tenantName, StandardCharsets.UTF_8.name()));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to, false));
            message.setSubject(title, StandardCharsets.UTF_8.name());
            String text = deepLink == null || deepLink.isBlank()
                ? body
                : body + "\n\nMở trong hệ thống: " + deepLink;
            message.setText(text, StandardCharsets.UTF_8.name());
            message.saveChanges();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            message.writeTo(output);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(output.toByteArray());
        } catch (MessagingException | IOException ex) {
            throw new GmailSendException("GMAIL_SEND_FAILED",
                "Không thể dựng MIME email hợp lệ.", false, false, null);
        }
    }

    public record AuthorizationGrant(
        String refreshToken,
        String accessToken,
        String scopes,
        String googleSubject,
        String email,
        boolean emailVerified
    ) {
    }

    private record TokenResponse(
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("refresh_token") String refreshToken,
        String scope,
        @JsonProperty("expires_in") Integer expiresIn,
        @JsonProperty("token_type") String tokenType
    ) {
    }

    private record UserInfoResponse(
        String sub,
        String email,
        @JsonProperty("email_verified") Boolean emailVerified
    ) {
    }

    private record SendResponse(String id) {
    }
}
