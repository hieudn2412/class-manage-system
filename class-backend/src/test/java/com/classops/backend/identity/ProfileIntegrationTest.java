package com.classops.backend.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "dev"})
@Testcontainers(disabledWithoutDocker = true)
class ProfileIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
        .withDatabaseName("profile_test").withUsername("profile_test").withPassword("profile_test");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcClient jdbc;

    @Test
    void everyRoleCanViewItsProfileAndChangePasswordSafely() throws Exception {
        String platformToken = login("/api/v1/platform/auth/login", "superadmin", "123456", null);
        mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(platformToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scope").value("PLATFORM"))
            .andExpect(jsonPath("$.roles[0]").value("SUPER_ADMIN"))
            .andExpect(jsonPath("$.tenant").doesNotExist());

        JsonNode tenant = json.readTree(mvc.perform(post("/api/v1/platform/tenants")
                .header("Authorization", bearer(platformToken)).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Trung tâm Hồ sơ","slug":"ho-so","initialAdmin":
                      {"username":"admin.profile","displayName":"Admin Hồ sơ","email":"admin@profile.vn"}}
                    """))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String adminToken = login("/api/v1/auth/login", "admin.profile", "123456", "ho-so");

        createAccount(adminToken, "STAFF", "academic.profile", "Quản lý Học vụ",
            List.of("ACADEMIC_MANAGER"), null, null);
        createAccount(adminToken, "STAFF", "accountant.profile", "Kế toán Hồ sơ",
            List.of("ACCOUNTANT"), null, null);
        createAccount(adminToken, "TEACHER", "teacher.profile", "Giáo viên Hồ sơ",
            List.of("TEACHER"), null, null);
        createAccount(adminToken, "STUDENT", "student.profile", "Học sinh Hồ sơ",
            List.of("STUDENT"), "Phụ huynh Hồ sơ", "0909000000");

        for (String username : List.of("admin.profile", "academic.profile", "accountant.profile")) {
            String token = "admin.profile".equals(username)
                ? adminToken : login("/api/v1/auth/login", username, "123456", "ho-so");
            mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope").value("TENANT"))
                .andExpect(jsonPath("$.profileType").value("STAFF"))
                .andExpect(jsonPath("$.tenant.name").value("Trung tâm Hồ sơ"));
        }

        String teacherToken = login("/api/v1/auth/login", "teacher.profile", "123456", "ho-so");
        mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(teacherToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profileType").value("TEACHER"))
            .andExpect(jsonPath("$.code").value("GV-0001"));

        String studentToken = login("/api/v1/auth/login", "student.profile", "123456", "ho-so");
        mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(studentToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profileType").value("STUDENT"))
            .andExpect(jsonPath("$.code").value("HS-0001"))
            .andExpect(jsonPath("$.parentName").value("Phụ huynh Hồ sơ"))
            .andExpect(jsonPath("$.parentPhone").value("0909000000"));

        mvc.perform(put("/api/v1/profile/me/password")
                .header("Authorization", bearer(teacherToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"sai-mat-khau\",\"newPassword\":\"Teacher@2026\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INVALID"))
            .andExpect(jsonPath("$.fieldErrors.currentPassword").exists());

        JsonNode changedTeacher = json.readTree(mvc.perform(put("/api/v1/profile/me/password")
                .header("Authorization", bearer(teacherToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"123456\",\"newPassword\":\"Teacher@2026\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.passwordState").value("READY"))
            .andReturn().getResponse().getContentAsString());
        String freshTeacherToken = changedTeacher.get("token").asText();
        mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(teacherToken)))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(freshTeacherToken)))
            .andExpect(status().isOk());
        mvc.perform(put("/api/v1/profile/me/password")
                .header("Authorization", bearer(freshTeacherToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"Teacher@2026\",\"newPassword\":\"Teacher@2026\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("PASSWORD_REUSE_NOT_ALLOWED"))
            .andExpect(jsonPath("$.fieldErrors.newPassword").exists());

        jdbc.sql("""
                UPDATE users SET password_state='MUST_CHANGE', token_version=token_version+1
                WHERE username='teacher.profile'
                """).update();
        String temporaryTeacherToken = login(
            "/api/v1/auth/login", "teacher.profile", "Teacher@2026", "ho-so");
        JsonNode readyTeacher = json.readTree(mvc.perform(post("/api/v1/auth/change-password")
                .header("Authorization", bearer(temporaryTeacherToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"newPassword\":\"TeacherFinal@2026\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.passwordState").value("READY"))
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/profile/me")
                .header("Authorization", bearer(readyTeacher.get("token").asText())))
            .andExpect(status().isOk());

        JsonNode changedPlatform = json.readTree(mvc.perform(put("/api/v1/profile/me/password")
                .header("Authorization", bearer(platformToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"123456\",\"newPassword\":\"Platform@2026\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.scope").value("PLATFORM"))
            .andReturn().getResponse().getContentAsString());
        String freshPlatformToken = changedPlatform.get("token").asText();
        mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(platformToken)))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/profile/me").header("Authorization", bearer(freshPlatformToken)))
            .andExpect(status().isOk());

        jdbc.sql("""
                UPDATE platform_users SET password_state='MUST_CHANGE', token_version=token_version+1
                WHERE username='superadmin'
                """).update();
        String temporaryPlatformToken = login(
            "/api/v1/platform/auth/login", "superadmin", "Platform@2026", null);
        JsonNode readyPlatform = json.readTree(mvc.perform(post("/api/v1/auth/change-password")
                .header("Authorization", bearer(temporaryPlatformToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"newPassword\":\"PlatformFinal@2026\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scope").value("PLATFORM"))
            .andExpect(jsonPath("$.user.passwordState").value("READY"))
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/profile/me")
                .header("Authorization", bearer(readyPlatform.get("token").asText())))
            .andExpect(status().isOk());

        assertThat(jdbc.sql("""
                SELECT count(*) FROM audit_events
                WHERE action='SELF_PASSWORD_CHANGED' AND old_value IS NULL
                  AND new_value = '{"sessionsRevoked": true}'::jsonb
                """).query(Long.class).single()).isEqualTo(2);
        assertThat(jdbc.sql("""
                SELECT count(*) FROM audit_events
                WHERE action='SELF_PASSWORD_CHANGED'
                  AND (coalesce(old_value::text,'') ILIKE '%password%'
                    OR coalesce(new_value::text,'') ILIKE '%hash%')
                """).query(Long.class).single()).isZero();
        assertThat(tenant.at("/tenant/id").asText()).isNotBlank();
    }

    private void createAccount(String token, String profileType, String username, String displayName,
                               List<String> roles, String parentName, String parentPhone) throws Exception {
        String body = json.writeValueAsString(new AccountInput(profileType, username, displayName,
            username + "@example.vn", roles, parentName, parentPhone));
        mvc.perform(post("/api/v1/accounts").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());
    }

    private String login(String path, String username, String password, String tenantSlug) throws Exception {
        String body = tenantSlug == null
            ? json.writeValueAsString(new PlatformLogin(username, password))
            : json.writeValueAsString(new TenantLogin(tenantSlug, username, password));
        String response = mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private record PlatformLogin(String username, String password) {}
    private record TenantLogin(String tenantSlug, String username, String password) {}
    private record AccountInput(String profileType, String username, String displayName, String email,
                                List<String> roles, String parentName, String parentPhone) {}
}
