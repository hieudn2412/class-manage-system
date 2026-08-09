package com.classops.backend.platform;

import com.classops.backend.config.PlatformAdminBootstrap;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "dev"})
@Testcontainers(disabledWithoutDocker = true)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PlatformAccountIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
        .withDatabaseName("platform_test").withUsername("platform_test").withPassword("platform_test");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcClient jdbc;
    @Autowired PlatformAdminBootstrap bootstrap;

    @Test
    @Order(1)
    void bootstrapIsSingletonAndRestartDoesNotOverwritePassword() {
        assertThat(jdbc.sql("SELECT count(*) FROM platform_users").query(Long.class).single()).isEqualTo(1);
        assertThat(jdbc.sql("SELECT count(*) FROM tenants").query(Long.class).single()).isZero();
        assertThat(jdbc.sql("SELECT count(*) FROM users").query(Long.class).single()).isZero();
        String hash = jdbc.sql("SELECT password_hash FROM platform_users").query(String.class).single();
        bootstrap.run(null);
        assertThat(jdbc.sql("SELECT count(*) FROM platform_users").query(Long.class).single()).isEqualTo(1);
        assertThat(jdbc.sql("SELECT password_hash FROM platform_users").query(String.class).single()).isEqualTo(hash);
    }

    @Test
    @Order(2)
    void platformCreatesTenantAndTenantPermissionsAreIsolated() throws Exception {
        String platformToken = login("/api/v1/platform/auth/login", """
            {"username":"superadmin","password":"123456"}
            """);
        String createTenant = """
            {"name":"Trung tâm Test","slug":"trung-tam-test","initialAdmin":
              {"username":"admin.test","displayName":"Admin Test","email":"admin@test.vn"}}
            """;
        JsonNode tenant = json.readTree(mvc.perform(post("/api/v1/platform/tenants")
                .header("Authorization", bearer(platformToken)).contentType(MediaType.APPLICATION_JSON)
                .content(createTenant)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.temporaryPassword").value("123456"))
            .andExpect(jsonPath("$.tenant.initialAdmin.username").value("admin.test"))
            .andReturn().getResponse().getContentAsString());
        assertThat(jdbc.sql("SELECT actor_type FROM audit_events WHERE action='TENANT_CREATED'")
            .query(String.class).single()).isEqualTo("PLATFORM");

        mvc.perform(get("/api/v1/accounts").header("Authorization", bearer(platformToken)))
            .andExpect(status().isForbidden());
        String adminToken = login("/api/v1/auth/login", """
            {"tenantSlug":"trung-tam-test","username":"admin.test","password":"123456"}
            """);
        JsonNode student = json.readTree(mvc.perform(post("/api/v1/accounts")
                .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"profileType":"STUDENT","username":"hs.test","displayName":"Học sinh Test",
                     "roles":["STUDENT"],"parentName":"Phụ huynh","parentPhone":"0900000000"}
                    """)).andExpect(status().isCreated()).andExpect(jsonPath("$.account.code").value("HS-0001"))
            .andReturn().getResponse().getContentAsString());
        JsonNode academic = json.readTree(mvc.perform(post("/api/v1/accounts")
                .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"profileType":"STAFF","username":"hocvu.test","displayName":"Học vụ Test",
                     "roles":["ACADEMIC_MANAGER"]}
                    """)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String academicToken = login("/api/v1/auth/login", """
            {"tenantSlug":"trung-tam-test","username":"hocvu.test","password":"123456"}
            """);
        mvc.perform(get("/api/v1/accounts").header("Authorization", bearer(academicToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].profileType").value("STUDENT"));
        mvc.perform(get("/api/v1/accounts/{id}", academic.at("/account/id").asText())
                .header("Authorization", bearer(academicToken)))
            .andExpect(status().isNotFound());

        JsonNode initialAdmin = tenant.at("/tenant/initialAdmin");
        mvc.perform(patch("/api/v1/accounts/{id}/status", initialAdmin.get("id").asText())
                .header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"LOCKED","reason":"self test","version":0}
                    """))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SELF_MANAGEMENT_FORBIDDEN"));
        assertThat(student.at("/account/passwordState").asText()).isEqualTo("READY");
    }

    private String login(String path, String body) throws Exception {
        String response = mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.scope").exists())
            .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }
    private String bearer(String token) { return "Bearer " + token; }
}
