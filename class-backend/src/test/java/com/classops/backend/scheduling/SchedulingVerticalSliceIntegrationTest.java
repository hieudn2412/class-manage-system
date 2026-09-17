package com.classops.backend.scheduling;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.classops.backend.teaching.SessionCompletionService;
import com.classops.backend.classlifecycle.ClassLifecycleAutomationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class SchedulingVerticalSliceIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("class_test")
            .withUsername("class_test")
            .withPassword("class_test");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    private static final UUID TENANT_A = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID TENANT_B = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID TENANT_LOCKED =
        UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final UUID ADMIN_A = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final UUID TEACHER_USER = UUID.fromString("a0000000-0000-0000-0000-000000000002");
    private static final UUID SUBSTITUTE_TEACHER_USER =
        UUID.fromString("a0000000-0000-0000-0000-000000000006");
    private static final UUID TEACHER = UUID.fromString("a2000000-0000-0000-0000-000000000001");
    private static final UUID SUBSTITUTE_TEACHER =
        UUID.fromString("a2000000-0000-0000-0000-000000000002");
    private static final UUID STUDENT_USER = UUID.fromString("a0000000-0000-0000-0000-000000000003");
    private static final UUID STUDENT = UUID.fromString("a3000000-0000-0000-0000-000000000001");
    private static final UUID ROOM = UUID.fromString("a4000000-0000-0000-0000-000000000001");
    private static final UUID FIRST_LOGIN =
        UUID.fromString("a0000000-0000-0000-0000-000000000004");
    private static final UUID LOCKED_USER =
        UUID.fromString("a0000000-0000-0000-0000-000000000005");

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper mapper;
    @Autowired SessionCompletionService completionService;
    @Autowired ClassLifecycleAutomationService lifecycleAutomation;

    @BeforeEach
    void seed() {
        if (jdbc.sql("SELECT count(*) FROM tenants").query(Long.class).single() > 0) {
            return;
        }
        jdbc.sql("""
                INSERT INTO tenants(id, slug, name, status) VALUES
                (:a, 'anh-duong', 'Ánh Dương', 'ACTIVE'),
                (:b, 'minh-tam', 'Minh Tâm', 'ACTIVE'),
                (:locked, 'khoa-son', 'Khoa Sơn', 'LOCKED')
                """).param("a", TENANT_A).param("b", TENANT_B)
            .param("locked", TENANT_LOCKED).update();
        user(ADMIN_A, "admin.anhduong", "Admin", "ADMIN");
        user(TEACHER_USER, "gv.lan", "Cô Lan", "TEACHER");
        user(SUBSTITUTE_TEACHER_USER, "gv.ha", "Cô Hà", "TEACHER");
        user(STUDENT_USER, "hs.minhanh", "Minh Anh", "STUDENT");
        user(FIRST_LOGIN, "first.login", "First Login", "ACADEMIC_MANAGER",
            "ACTIVE", "MUST_CHANGE");
        user(LOCKED_USER, "locked.user", "Locked User", "ACADEMIC_MANAGER",
            "LOCKED", "READY");
        jdbc.sql("""
                INSERT INTO teacher_profiles(id, tenant_id, user_id, code)
                VALUES (:id, :tenantId, :userId, 'GV001')
                """).param("id", TEACHER).param("tenantId", TENANT_A)
            .param("userId", TEACHER_USER).update();
        jdbc.sql("""
                INSERT INTO teacher_profiles(id, tenant_id, user_id, code)
                VALUES (:id, :tenantId, :userId, 'GV002')
                """).param("id", SUBSTITUTE_TEACHER).param("tenantId", TENANT_A)
            .param("userId", SUBSTITUTE_TEACHER_USER).update();
        jdbc.sql("""
                INSERT INTO student_profiles(id, tenant_id, user_id, code)
                VALUES (:id, :tenantId, :userId, 'HS001')
                """).param("id", STUDENT).param("tenantId", TENANT_A)
            .param("userId", STUDENT_USER).update();
        jdbc.sql("""
                INSERT INTO rooms(id, tenant_id, code, name, capacity, status)
                VALUES (:id, :tenantId, 'P101', 'Phòng 101', 20, 'ACTIVE')
                """).param("id", ROOM).param("tenantId", TENANT_A).update();
        jdbc.sql("""
                INSERT INTO tenant_holidays(id, tenant_id, name, start_date, end_date)
                VALUES (:id, :tenantId, 'Nghỉ hè', '2026-08-11', '2026-08-11')
                """).param("id", UUID.randomUUID()).param("tenantId", TENANT_A).update();
    }

    @Test
    void fullDraftPreviewPublishCalendarOverrideAndTenantIsolation() throws Exception {
        String adminToken = login("admin.anhduong");
        Map<String, Object> draftInput = Map.ofEntries(
            Map.entry("name", "Lớp vertical slice"),
            Map.entry("description", "Integration test"),
            Map.entry("primaryTeacherId", TEACHER),
            Map.entry("startDate", "2026-08-04"),
            Map.entry("totalSessions", 3),
            Map.entry("tuitionAmount", 1800000),
            Map.entry("hourlyRate", 200000),
            Map.entry("capacity", 15),
            Map.entry("defaultMode", "IN_PERSON"),
            Map.entry("studentIds", List.of(STUDENT)),
            Map.entry("patterns", List.of(Map.of(
                "id", "tue-morning", "weekday", 2, "startTime", "10:00",
                "endTime", "11:30", "mode", "IN_PERSON", "roomId", ROOM))),
            Map.entry("overrides", List.of())
        );

        JsonNode preview = json(mvc.perform(post("/api/v1/class-scheduling/previews")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(draftInput)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions.length()").value(3))
            .andExpect(jsonPath("$.skippedHolidays.length()").value(1))
            .andExpect(jsonPath("$.expectedEndDate").value("2026-08-25"))
            .andReturn().getResponse().getContentAsString());

        JsonNode draft = json(mvc.perform(post("/api/v1/classes")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(draftInput)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Draft"))
            .andReturn().getResponse().getContentAsString());
        UUID classId = UUID.fromString(draft.get("id").asText());

        mvc.perform(post("/api/v1/classes/{id}/publish", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "publish-integration-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "previewId", preview.get("previewId").asText(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Scheduled"));
        mvc.perform(post("/api/v1/classes/{id}/publish", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "publish-integration-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "previewId", preview.get("previewId").asText(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Scheduled"));

        assertThat(count("class_sessions", classId)).isEqualTo(3);
        assertThat(count("class_enrollments", classId)).isEqualTo(1);
        assertThat(count("tuition_charges", classId)).isEqualTo(1);
        assertThat(jdbc.sql("""
                SELECT count(*) FROM tuition_charges
                WHERE tenant_id=:tenant AND class_id=:classId AND status='UNPAID'
                """).param("tenant", TENANT_A).param("classId", classId)
            .query(Long.class).single()).isEqualTo(1);

        mvc.perform(get("/api/v1/classes")
                .header("Authorization", "Bearer " + adminToken)
                .param("page", "1")
                .param("pageSize", "10")
                .param("month", "2026-08")
                .param("search", "vertical"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].id").value(classId.toString()));

        mvc.perform(get("/api/v1/schedules/management")
                .header("Authorization", "Bearer " + adminToken)
                .param("weekStart", "2026-08-03"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions[?(@.classId == '" + classId + "')].scheduleState")
                .value(hasItem("MISSING_CHECK_IN")));
        String teacherToken = login("gv.lan");
        mvc.perform(get("/api/v1/schedules/me")
                .header("Authorization", "Bearer " + teacherToken)
                .param("weekStart", "2026-08-03"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions[?(@.classId == '" + classId + "')].scheduleState")
                .value(hasItem("MISSING_CHECK_IN")));

        UUID sessionId = jdbc.sql("""
                SELECT id FROM class_sessions WHERE tenant_id=:tenant AND class_id=:classId
                ORDER BY ordinal LIMIT 1
                """).param("tenant", TENANT_A).param("classId", classId)
            .query(UUID.class).single();
        jdbc.sql("""
                UPDATE class_sessions SET online_link='https://record.example/check-in-owned'
                WHERE tenant_id=:tenant AND id=:id
                """).param("tenant", TENANT_A).param("id", sessionId).update();
        long version = jdbc.sql("""
                SELECT version FROM class_sessions WHERE tenant_id=:tenant AND id=:id
                """).param("tenant", TENANT_A).param("id", sessionId).query(Long.class).single();
        Map<String, Object> overrideRequest = new LinkedHashMap<>();
        overrideRequest.put("mode", "ONLINE");
        overrideRequest.put("roomId", null);
        overrideRequest.put("version", version);
        JsonNode overridePreview = json(mvc.perform(post(
                "/api/v1/sessions/{id}/schedule-preview", sessionId)
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(overrideRequest)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        mvc.perform(patch("/api/v1/sessions/{id}/schedule", sessionId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "override-integration-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "mode", "ONLINE",
                    "version", version,
                    "previewId", overridePreview.get("previewId").asText(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk());
        assertThat(jdbc.sql("""
                SELECT online_link FROM class_sessions WHERE tenant_id=:tenant AND id=:id
                """).param("tenant", TENANT_A).param("id", sessionId)
            .query(String.class).single()).isEqualTo("https://record.example/check-in-owned");

        mvc.perform(get("/api/v1/classes/{id}", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("X-Tenant-Slug", "minh-tam"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(classId.toString()));
        mvc.perform(post("/api/v1/classes")
                .header("Authorization", "Bearer " + teacherToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(draftInput)))
            .andExpect(status().isForbidden());
    }

    @Test
    void sessionSubstitutionCancellationAndMakeupFlow() throws Exception {
        String adminToken = login("admin.anhduong");
        OffsetDateTime start = OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .plusDays(90).withHour(9).withMinute(0).withSecond(0).withNano(0);
        UUID classId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        insertTeacherClass(classId, sessionId, "IN_PERSON", ROOM,
            start, start.plusMinutes(90), "SCHEDULED");

        JsonNode substitutionPreview = json(mvc.perform(post(
                "/api/v1/sessions/{id}/substitution-previews", sessionId)
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "teacherId", SUBSTITUTE_TEACHER,
                    "note", "Cô Lan nghỉ phép",
                    "version", 0))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.conflicts.length()").value(0))
            .andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/v1/sessions/{id}/substitutions", sessionId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl07-substitution-" + sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "teacherId", SUBSTITUTE_TEACHER,
                    "note", "Cô Lan nghỉ phép",
                    "version", 0,
                    "previewId", substitutionPreview.get("previewId").asText(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.source.actualTeacherId").value(SUBSTITUTE_TEACHER.toString()))
            .andExpect(jsonPath("$.source.isSubstitution").value(true));
        assertThat(jdbc.sql("""
                SELECT actual_teacher_id FROM class_sessions
                WHERE tenant_id=:tenant AND id=:sessionId
                """).param("tenant", TENANT_A).param("sessionId", sessionId)
            .query(UUID.class).single()).isEqualTo(SUBSTITUTE_TEACHER);
        mvc.perform(get("/api/v1/schedules/management")
                .header("Authorization", "Bearer " + adminToken)
                .param("weekStart", start.toLocalDate()
                    .with(java.time.temporal.TemporalAdjusters.previousOrSame(
                        java.time.DayOfWeek.MONDAY)).toString())
                .param("teacherId", SUBSTITUTE_TEACHER.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions[?(@.id == '" + sessionId + "')].isSubstitution")
                .value(hasItem(true)));

        OffsetDateTime makeupStart = start.plusDays(1);
        Map<String, Object> makeup = new LinkedHashMap<>();
        makeup.put("date", makeupStart.toLocalDate().toString());
        makeup.put("startTime", "10:00");
        makeup.put("endTime", "11:30");
        makeup.put("teacherId", SUBSTITUTE_TEACHER);
        makeup.put("mode", "IN_PERSON");
        makeup.put("roomId", ROOM);
        JsonNode makeupPreview = json(mvc.perform(post(
                "/api/v1/sessions/{id}/makeup-previews", sessionId)
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of("makeup", makeup, "version", 1))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        JsonNode cancelled = json(mvc.perform(post("/api/v1/sessions/{id}/cancellations", sessionId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl07-cancel-makeup-" + sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "reason", "Mất điện",
                    "version", 1,
                    "makeup", makeup,
                    "previewId", makeupPreview.get("previewId").asText(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.source.status").value("CANCELLED"))
            .andExpect(jsonPath("$.makeup.ordinal").value(1))
            .andReturn().getResponse().getContentAsString());
        UUID makeupId = UUID.fromString(cancelled.at("/makeup/id").asText());
        assertThat(jdbc.sql("""
                SELECT replaces_session_id FROM class_sessions
                WHERE tenant_id=:tenant AND id=:makeupId
                """).param("tenant", TENANT_A).param("makeupId", makeupId)
            .query(UUID.class).single()).isEqualTo(sessionId);
        assertThat(jdbc.sql("""
                SELECT count(*) FROM notifications
                WHERE tenant_id=:tenant AND recipient_user_id=:studentUser
                  AND event_type IN (
                    'SESSION_TEACHER_SUBSTITUTED', 'SESSION_CANCELLED', 'SESSION_MAKEUP_CREATED'
                  )
                """).param("tenant", TENANT_A).param("studentUser", STUDENT_USER)
            .query(Long.class).single()).isZero();

        UUID laterClassId = UUID.randomUUID();
        UUID laterSessionId = UUID.randomUUID();
        OffsetDateTime laterStart = start.plusDays(3);
        insertTeacherClass(laterClassId, laterSessionId, "ONLINE", null,
            laterStart, laterStart.plusMinutes(90), "SCHEDULED");
        mvc.perform(post("/api/v1/sessions/{id}/cancellations", laterSessionId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl07-cancel-later-" + laterSessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "reason", "Giáo viên bận đột xuất",
                    "version", 0,
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.source.allowedActions", hasItem("CREATE_MAKEUP")));
        Map<String, Object> laterMakeup = Map.of(
            "date", laterStart.plusDays(1).toLocalDate().toString(),
            "startTime", "15:00",
            "endTime", "16:30",
            "teacherId", TEACHER,
            "mode", "ONLINE");
        JsonNode laterPreview = json(mvc.perform(post(
                "/api/v1/sessions/{id}/makeup-previews", laterSessionId)
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of("makeup", laterMakeup, "version", 1))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/v1/sessions/{id}/makeups", laterSessionId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl07-makeup-later-" + laterSessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "version", 1,
                    "previewId", laterPreview.get("previewId").asText(),
                    "makeup", laterMakeup,
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.makeup.replacesSessionId").value(laterSessionId.toString()))
            .andExpect(jsonPath("$.makeup.ordinal").value(1));
    }

    @Test
    void authenticationRecoveryPasswordChangeRateLimitAndDashboard() throws Exception {
        String knownResponse = mvc.perform(post("/api/v1/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "tenantSlug", "anh-duong", "username", "admin.anhduong"))))
            .andExpect(status().isAccepted())
            .andReturn().getResponse().getContentAsString();
        String unknownResponse = mvc.perform(post("/api/v1/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "tenantSlug", "anh-duong", "username", "unknown.user"))))
            .andExpect(status().isAccepted())
            .andReturn().getResponse().getContentAsString();
        assertThat(json(knownResponse).get("message").asText())
            .isEqualTo(json(unknownResponse).get("message").asText());
        assertThat(jdbc.sql("""
                SELECT count(*) FROM password_reset_requests WHERE tenant_id=:tenantId
                """).param("tenantId", TENANT_A).query(Long.class).single()).isEqualTo(2);
        assertThat(jdbc.sql("""
                SELECT count(*) FROM outbox_events
                WHERE tenant_id=:tenantId AND event_type='PASSWORD_RESET_REQUESTED'
                """).param("tenantId", TENANT_A).query(Long.class).single()).isEqualTo(1);

        String temporaryToken = login("first.login");
        mvc.perform(get("/api/v1/dashboard")
                .header("Authorization", "Bearer " + temporaryToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
        JsonNode changedSession = json(mvc.perform(post("/api/v1/auth/change-password")
                .header("Authorization", "Bearer " + temporaryToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of("newPassword", "NewDemo@123"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.passwordState").value("READY"))
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/dashboard")
                .header("Authorization", "Bearer " + temporaryToken))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/v1/dashboard")
                .header("Authorization", "Bearer " + changedSession.get("token").asText()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.greetingName").value("First Login"))
            .andExpect(jsonPath("$.classStates.length()").value(3));

        mvc.perform(get("/api/v1/tenants/khoa-son"))
            .andExpect(status().isLocked())
            .andExpect(jsonPath("$.code").value("TENANT_LOCKED"));
        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "tenantSlug", "anh-duong",
                    "username", "locked.user",
                    "password", "Demo@123"))))
            .andExpect(status().isLocked())
            .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));

        for (int attempt = 0; attempt < 5; attempt++) {
            mvc.perform(post("/api/v1/auth/login")
                    .with(request -> {
                        request.setRemoteAddr("10.0.0.25");
                        return request;
                    })
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(Map.of(
                        "tenantSlug", "anh-duong",
                        "username", "rate.limit.user",
                        "password", "wrong-password"))))
                .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/v1/auth/login")
                .with(request -> {
                    request.setRemoteAddr("10.0.0.25");
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "tenantSlug", "anh-duong",
                    "username", "rate.limit.user",
                    "password", "wrong-password"))))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
            .andExpect(jsonPath("$.retryAfterSeconds").isNumber());
    }

    @Test
    void teacherCheckInRecordsCompletionSalaryAndManagerVerificationAreIdempotent()
        throws Exception {
        String teacherToken = login("gv.lan");
        String adminToken = login("admin.anhduong");
        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .withNano(0);
        UUID classId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        insertTeacherClass(classId, sessionId, "ONLINE", null,
            now.plusMinutes(5), now.plusMinutes(65), "SCHEDULED");

        JsonNode detail = json(mvc.perform(get("/api/v1/sessions/{id}", sessionId)
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.checkInState").value("OPEN"))
            .andExpect(jsonPath("$.students.length()").value(1))
            .andReturn().getResponse().getContentAsString());

        Map<String, Object> checkIn = Map.of(
            "onlineLink", "https://meet.example/teacher-operations",
            "version", detail.get("version").asLong());
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post("/api/v1/sessions/{id}/check-ins", sessionId)
                    .header("Authorization", "Bearer " + teacherToken)
                    .header("Idempotency-Key", "teacher-check-in-1")
                    .header("User-Agent", "Integration test")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(checkIn)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        }
        assertThat(jdbc.sql("""
                SELECT count(*) FROM session_check_ins
                WHERE tenant_id=:tenant AND session_id=:sessionId
                """).param("tenant", TENANT_A).param("sessionId", sessionId)
            .query(Long.class).single()).isEqualTo(1);

        JsonNode checkedInDetail = json(mvc.perform(get("/api/v1/sessions/{id}", sessionId)
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        Map<String, Object> studentRecord = Map.of(
            "studentId", STUDENT,
            "attendanceStatus", "PRESENT",
            "attendanceNote", "",
            "attendanceVersion", 0,
            "sessionComment", "Tham gia tích cực",
            "commentVersion", 0);
        mvc.perform(patch("/api/v1/sessions/{id}/pedagogical-record", sessionId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-record-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "rosterRevision", checkedInDetail.get("rosterRevision").asText(),
                    "lessonReport", Map.of(
                        "lessonName", "Phân số",
                        "lessonContent", "Ôn tập và luyện tập",
                        "recordUrl", "https://youtube.com/watch?v=teacher-test",
                        "version", 0),
                    "students", List.of(studentRecord)))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.students[0].attendanceStatus").value("PRESENT"));

        mvc.perform(get("/api/v1/classes/{id}", classId)
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currentLesson").value("Phân số"))
            .andExpect(jsonPath("$.sessions[0].lessonName").value("Phân số"))
            .andExpect(jsonPath("$.sessions[0].attendanceRate").value(100.0))
            .andExpect(jsonPath("$.sessions[0].recordStatus").value("COMPLETE"))
            .andExpect(jsonPath("$.sessions[0].recordUrl")
                .value("https://youtube.com/watch?v=teacher-test"));

        JsonNode testDetail = json(mvc.perform(post(
                "/api/v1/sessions/{sessionId}/tests", sessionId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-session-test-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "testName", "Kiểm tra phân số",
                    "maxScore", 10,
                    "testDate", LocalDate.now().toString(),
                    "comment", "Đánh giá mức độ nắm bài"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.sessionTest.testName").value("Kiểm tra phân số"))
            .andExpect(jsonPath("$.students[0].testResult.score").doesNotExist())
            .andReturn().getResponse().getContentAsString());

        mvc.perform(post("/api/v1/sessions/{sessionId}/tests", sessionId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-session-test-duplicate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "testName", "Bài kiểm tra thứ hai",
                    "maxScore", 10,
                    "testDate", LocalDate.now().toString(),
                    "comment", "Không được tạo"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("SESSION_TEST_ALREADY_EXISTS"));

        mvc.perform(patch("/api/v1/sessions/{sessionId}/tests/{testId}",
                sessionId, testDetail.get("sessionTest").get("id").asText())
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-session-test-score-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "testName", "Kiểm tra phân số",
                    "maxScore", 10,
                    "testDate", LocalDate.now().toString(),
                    "comment", "Đánh giá mức độ nắm bài",
                    "version", testDetail.get("sessionTest").get("version").asLong(),
                    "rosterRevision", testDetail.get("rosterRevision").asText(),
                    "results", List.of(Map.of(
                        "studentId", STUDENT,
                        "score", 8.5,
                        "comment", "Nắm bài tốt",
                        "version", testDetail.get("students").get(0)
                            .get("testResult").get("version").asLong()))))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.students[0].testResult.score").value(8.5));

        jdbc.sql("""
                UPDATE class_sessions
                SET start_at=:startAt, end_at=:endAt
                WHERE tenant_id=:tenant AND id=:sessionId
                """)
            .param("startAt", now.minusMinutes(61)).param("endAt", now.minusMinutes(1))
            .param("tenant", TENANT_A).param("sessionId", sessionId).update();
        completionService.autoCompleteCheckedIn(TENANT_A, sessionId, now);
        completionService.autoCompleteCheckedIn(TENANT_A, sessionId, now);

        mvc.perform(get("/api/v1/sessions/{id}", sessionId)
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.rosterFrozen").value(true))
            .andExpect(jsonPath("$.missingDocumentation").value(false))
            .andExpect(jsonPath("$.sessionTest.testName").value("Kiểm tra phân số"))
            .andExpect(jsonPath("$.students[0].testResult.score").value(8.5));
        String studentToken = login("hs.minhanh");
        mvc.perform(get("/api/v1/students/me/classes/{classId}/sessions", classId)
                .header("Authorization", "Bearer " + studentToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].testResult.score").value(8.5))
            .andExpect(jsonPath("$.items[0].testResult.comment").value("Nắm bài tốt"));
        assertThat(jdbc.sql("""
                SELECT amount FROM salary_accruals
                WHERE tenant_id=:tenant AND session_id=:sessionId
                """).param("tenant", TENANT_A).param("sessionId", sessionId)
            .query(java.math.BigDecimal.class).single())
            .isEqualByComparingTo("200000");

        jdbc.sql("""
                UPDATE class_enrollments SET effective_to=:yesterday, status='LEFT'
                WHERE tenant_id=:tenant AND class_id=:classId AND student_id=:studentId
                """)
            .param("yesterday", LocalDate.now().minusDays(1))
            .param("tenant", TENANT_A).param("classId", classId)
            .param("studentId", STUDENT).update();
        mvc.perform(get("/api/v1/sessions/{id}", sessionId)
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.students.length()").value(1));

        UUID pendingClass = UUID.randomUUID();
        UUID pendingSession = UUID.randomUUID();
        insertTeacherClass(pendingClass, pendingSession, "IN_PERSON", ROOM,
            now.minusMinutes(90), now.minusMinutes(1), "PENDING_CONFIRMATION");
        long pendingVersion = jdbc.sql("""
                SELECT version FROM class_sessions
                WHERE tenant_id=:tenant AND id=:sessionId
                """).param("tenant", TENANT_A).param("sessionId", pendingSession)
            .query(Long.class).single();
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post(
                    "/api/v1/sessions/{id}/verification-decisions", pendingSession)
                    .header("Authorization", "Bearer " + adminToken)
                    .header("Idempotency-Key", "manager-confirm-1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(Map.of(
                        "decision", "CONFIRM_TAUGHT",
                        "reason", "Đã đối chiếu với camera lớp học",
                        "version", pendingVersion))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
        }
        assertThat(jdbc.sql("""
                SELECT count(*) FROM salary_accruals
                WHERE tenant_id=:tenant AND session_id=:sessionId
                """).param("tenant", TENANT_A).param("sessionId", pendingSession)
            .query(Long.class).single()).isEqualTo(1);
    }

    @Test
    void teacherClassSessionsFilterStatusBeforePaginationAndRejectInvalidValue()
        throws Exception {
        String teacherToken = login("gv.lan");
        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .withNano(0);
        UUID classId = UUID.randomUUID();
        UUID scheduledSession = UUID.randomUUID();
        UUID completedSession = UUID.randomUUID();
        insertTeacherClass(classId, scheduledSession, "ONLINE", null,
            now.plusDays(1), now.plusDays(1).plusMinutes(60), "SCHEDULED");
        jdbc.sql("UPDATE classes SET total_sessions=2 WHERE tenant_id=:tenant AND id=:classId")
            .param("tenant", TENANT_A).param("classId", classId).update();
        jdbc.sql("""
                INSERT INTO class_sessions (
                  id, tenant_id, class_id, ordinal, pattern_key, session_key,
                  start_at, end_at, planned_teacher_id, actual_teacher_id,
                  mode, status
                ) VALUES (
                  :id, :tenant, :classId, 2, 'filter-test', :sessionKey,
                  :startAt, :endAt, :teacher, :teacher, 'ONLINE', 'COMPLETED'
                )
                """)
            .param("id", completedSession).param("tenant", TENANT_A)
            .param("classId", classId).param("sessionKey", "filter@" + completedSession)
            .param("startAt", now.minusDays(1)).param("endAt", now.minusDays(1).plusMinutes(60))
            .param("teacher", TEACHER).update();

        mvc.perform(get("/api/v1/teachers/me/classes/{classId}/sessions", classId)
                .param("page", "1").param("pageSize", "1")
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions.totalItems").value(2))
            .andExpect(jsonPath("$.sessions.totalPages").value(2));

        mvc.perform(get("/api/v1/teachers/me/classes/{classId}/sessions", classId)
                .param("status", "completed")
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions.totalItems").value(1))
            .andExpect(jsonPath("$.sessions.items[0].id").value(completedSession.toString()))
            .andExpect(jsonPath("$.sessions.items[0].status").value("COMPLETED"));

        mvc.perform(get("/api/v1/teachers/me/classes/{classId}/sessions", classId)
                .param("status", "UNKNOWN")
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_SESSION_STATUS"));
    }

    @Test
    void teacherCreatesHomeworkOnlyForManageableOwnedSessions() throws Exception {
        String teacherToken = login("gv.lan");
        String substituteToken = login("gv.ha");
        String adminToken = login("admin.anhduong");
        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .withNano(0);
        UUID classId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        insertTeacherClass(classId, sessionId, "ONLINE", null,
            now.plusDays(7), now.plusDays(7).plusMinutes(90), "SCHEDULED");

        mvc.perform(get("/api/v1/teachers/me/classes/{classId}/sessions", classId)
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions.items[0].canCreateHomework").value(true));

        JsonNode teacherHomework = json(mvc.perform(post("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-homework-session-" + sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", sessionId,
                    "title", "BTVN theo buổi",
                    "audienceType", "SELECTED",
                    "studentIds", List.of(STUDENT)))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PUBLISHED"))
            .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
            .andExpect(jsonPath("$.recipients[0].studentId").value(STUDENT.toString()))
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + teacherToken)
                .param("sessionId", sessionId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].id").value(teacherHomework.get("id").asText()));
        mvc.perform(get("/api/v1/teachers/me/classes/{classId}/sessions", classId)
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions.items[0].canCreateHomework").value(false))
            .andExpect(jsonPath("$.sessions.items[0].homework.id").value(teacherHomework.get("id").asText()))
            .andExpect(jsonPath("$.sessions.items[0].homework.title").value("BTVN theo buổi"));
        mvc.perform(get("/api/v1/sessions/{sessionId}", sessionId)
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.canCreateHomework").value(false))
            .andExpect(jsonPath("$.homework.id").value(teacherHomework.get("id").asText()));
        mvc.perform(post("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-homework-session-duplicate-" + sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", sessionId,
                    "title", "Không được tạo bài thứ hai",
                    "audienceType", "CLASS"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("HOMEWORK_ALREADY_EXISTS_FOR_SESSION"))
            .andExpect(jsonPath("$.details.homeworkId").value(teacherHomework.get("id").asText()));

        mvc.perform(post("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-homework-class-" + classId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "title", "Teacher không được tạo cấp lớp",
                    "audienceType", "CLASS"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("HOMEWORK_SESSION_REQUIRED"));
        mvc.perform(post("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + substituteToken)
                .header("Idempotency-Key", "other-teacher-homework-" + sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", sessionId,
                    "title", "Sai giáo viên",
                    "audienceType", "CLASS"))))
            .andExpect(status().isForbidden());

        JsonNode adminHomework = json(mvc.perform(post("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "admin-homework-class-" + classId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "title", "Admin tạo cấp lớp",
                    "audienceType", "CLASS"))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + adminToken)
                .param("sessionId", sessionId.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].id").value(teacherHomework.get("id").asText()));
        assertThat(adminHomework.get("id").asText()).isNotEqualTo(teacherHomework.get("id").asText());

        UUID otherClassId = UUID.randomUUID();
        UUID otherSessionId = UUID.randomUUID();
        insertTeacherClass(otherClassId, otherSessionId, "ONLINE", null,
            now.plusDays(8), now.plusDays(8).plusMinutes(90), "SCHEDULED");
        mvc.perform(post("/api/v1/classes/{classId}/homeworks", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "homework-session-mismatch-" + otherSessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", otherSessionId,
                    "title", "Sai quan hệ lớp buổi",
                    "audienceType", "CLASS"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("HOMEWORK_SESSION_CLASS_MISMATCH"));

        UUID cancelledClassId = UUID.randomUUID();
        UUID cancelledSessionId = UUID.randomUUID();
        insertTeacherClass(cancelledClassId, cancelledSessionId, "ONLINE", null,
            now.plusDays(9), now.plusDays(9).plusMinutes(90), "SCHEDULED");
        jdbc.sql("""
                UPDATE class_sessions
                SET status='CANCELLED', cancelled_at=now(), cancellation_reason='Hủy trong test'
                WHERE tenant_id=:tenant AND id=:sessionId
                """)
            .param("tenant", TENANT_A).param("sessionId", cancelledSessionId).update();
        mvc.perform(post("/api/v1/classes/{classId}/homeworks", cancelledClassId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "homework-cancelled-session-" + cancelledSessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", cancelledSessionId,
                    "title", "Buổi hủy",
                    "audienceType", "CLASS"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("HOMEWORK_SESSION_CANCELLED"));

        UUID closedClassId = UUID.randomUUID();
        UUID closedSessionId = UUID.randomUUID();
        insertTeacherClass(closedClassId, closedSessionId, "ONLINE", null,
            now.plusDays(10), now.plusDays(10).plusMinutes(90), "SCHEDULED");
        jdbc.sql("UPDATE classes SET status='CLOSED' WHERE tenant_id=:tenant AND id=:classId")
            .param("tenant", TENANT_A).param("classId", closedClassId).update();
        mvc.perform(post("/api/v1/classes/{classId}/homeworks", closedClassId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "homework-closed-class-" + closedClassId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", closedSessionId,
                    "title", "Lớp đóng",
                    "audienceType", "CLASS"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("HOMEWORK_SESSION_NOT_MANAGEABLE"));

        UUID completedClassId = UUID.randomUUID();
        UUID completedSessionId = UUID.randomUUID();
        insertTeacherClass(completedClassId, completedSessionId, "ONLINE", null,
            now.minusDays(1), now.minusDays(1).plusMinutes(90), "COMPLETED");
        jdbc.sql("""
                UPDATE class_sessions SET actual_teacher_id=:actualTeacher
                WHERE tenant_id=:tenant AND id=:sessionId
                """)
            .param("actualTeacher", SUBSTITUTE_TEACHER).param("tenant", TENANT_A)
            .param("sessionId", completedSessionId).update();
        mvc.perform(post("/api/v1/classes/{classId}/homeworks", completedClassId)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "planned-teacher-after-completed-" + completedSessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", completedSessionId,
                    "title", "Giáo viên dự kiến sau hoàn tất",
                    "audienceType", "CLASS"))))
            .andExpect(status().isForbidden());
        JsonNode substituteHomework = json(mvc.perform(post("/api/v1/classes/{classId}/homeworks", completedClassId)
                .header("Authorization", "Bearer " + substituteToken)
                .header("Idempotency-Key", "actual-teacher-after-completed-" + completedSessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "sessionId", completedSessionId,
                    "title", "Giáo viên thực tế sau hoàn tất",
                    "audienceType", "CLASS"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessionId").value(completedSessionId.toString()))
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/classes/{classId}/homeworks", completedClassId)
                .header("Authorization", "Bearer " + substituteToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].id").value(substituteHomework.get("id").asText()));
    }

    @Test
    void enrollmentHistoryLifecycleAndStudentAccessAreAtomicAndIdempotent() throws Exception {
        UUID learnerUser = UUID.randomUUID();
        UUID learner = UUID.randomUUID();
        UUID rollbackUser = UUID.randomUUID();
        UUID rollbackStudent = UUID.randomUUID();
        user(learnerUser, "hs.fl06", "Học sinh FL06", "STUDENT");
        user(rollbackUser, "hs.rollback", "Học sinh Rollback", "STUDENT");
        jdbc.sql("""
                INSERT INTO student_profiles(id, tenant_id, user_id, code) VALUES
                  (:learner, :tenant, :learnerUser, 'HS-FL06'),
                  (:rollbackStudent, :tenant, :rollbackUser, 'HS-ROLLBACK')
                """)
            .param("learner", learner).param("learnerUser", learnerUser)
            .param("rollbackStudent", rollbackStudent).param("rollbackUser", rollbackUser)
            .param("tenant", TENANT_A).update();
        UUID classId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        OffsetDateTime tomorrow = OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .plusDays(1).withNano(0);
        insertTeacherClass(classId, sessionId, "ONLINE", null,
            tomorrow, tomorrow.plusHours(1), "SCHEDULED");
        String adminToken = login("admin.anhduong");

        mvc.perform(post("/api/v1/classes/{classId}/enrollments", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-invalid-batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "studentIds", List.of(rollbackStudent, UUID.randomUUID()),
                    "classVersion", 0, "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("ENROLLMENT_BATCH_INVALID"));
        assertThat(jdbc.sql("""
                SELECT count(*) FROM class_enrollments WHERE tenant_id=:tenant
                  AND class_id=:classId AND student_id=:studentId
                """).param("tenant", TENANT_A).param("classId", classId)
            .param("studentId", rollbackStudent).query(Long.class).single()).isZero();

        jdbc.sql("UPDATE classes SET capacity=1 WHERE tenant_id=:tenant AND id=:classId")
            .param("tenant", TENANT_A).param("classId", classId).update();
        JsonNode warning = json(mvc.perform(post(
                "/api/v1/classes/{classId}/enrollments", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-add")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "studentIds", List.of(learner), "classVersion", 0,
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("WARNINGS_NOT_ACKNOWLEDGED"))
            .andReturn().getResponse().getContentAsString());
        String warningId = warning.at("/details/warnings/0/id").asText();
        Map<String, Object> acknowledged = Map.of(
            "studentIds", List.of(learner), "classVersion", 0,
            "acknowledgedWarningIds", List.of(warningId));
        JsonNode added = json(mvc.perform(post(
                "/api/v1/classes/{classId}/enrollments", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-add")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(acknowledged)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/v1/classes/{classId}/enrollments", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-add")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(acknowledged)))
            .andExpect(status().isCreated());
        UUID enrollmentId = UUID.fromString(added.at("/enrollments/0/id").asText());

        JsonNode ended = json(mvc.perform(patch(
                "/api/v1/classes/{classId}/enrollments/{enrollmentId}", classId, enrollmentId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-end")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "targetStatus", "Left", "reason", "Đổi lịch học",
                    "classVersion", added.get("classVersion").asLong(),
                    "enrollmentVersion", 0))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enrollment.status").value("Left"))
            .andReturn().getResponse().getContentAsString());
        assertThat(jdbc.sql("SELECT effective_to FROM class_enrollments WHERE id=:id")
            .param("id", enrollmentId).query(LocalDate.class).single())
            .isEqualTo(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")));

        jdbc.sql("UPDATE classes SET capacity=20 WHERE tenant_id=:tenant AND id=:classId")
            .param("tenant", TENANT_A).param("classId", classId).update();
        JsonNode reentered = json(mvc.perform(post(
                "/api/v1/classes/{classId}/enrollments", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-reenter")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "studentIds", List.of(learner),
                    "classVersion", ended.get("classVersion").asLong(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString());
        assertThat(jdbc.sql("""
                SELECT count(*) FROM class_enrollments WHERE tenant_id=:tenant
                  AND class_id=:classId AND student_id=:studentId
                """).param("tenant", TENANT_A).param("classId", classId)
            .param("studentId", learner).query(Long.class).single()).isEqualTo(2);
        assertThat(jdbc.sql("""
                SELECT count(*) FROM tuition_charges WHERE tenant_id=:tenant
                  AND class_id=:classId AND student_id=:studentId
                """).param("tenant", TENANT_A).param("classId", classId)
            .param("studentId", learner).query(Long.class).single()).isEqualTo(2);

        UUID testId = UUID.randomUUID();
        UUID learnerResultId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO session_tests(
                  id, tenant_id, session_id, test_name, max_score, test_date, comment_text
                ) VALUES (
                  :id, :tenant, :sessionId, 'Kiểm tra phân số', 10, :testDate,
                  'Ôn lại phần quy đồng mẫu số'
                )
                """).param("id", testId).param("tenant", TENANT_A)
            .param("sessionId", sessionId).param("testDate", tomorrow.toLocalDate()).update();
        jdbc.sql("""
                INSERT INTO session_test_results(
                  id, tenant_id, session_id, student_id, session_test_id,
                  test_name, score, max_score, test_date, comment_text
                ) VALUES
                  (:learnerResult, :tenant, :sessionId, :learner, :testId,
                   'Kiểm tra phân số', 8.5, 10, :testDate, 'Nắm bài tốt'),
                  (:otherResult, :tenant, :sessionId, :otherStudent, :testId,
                   'Kiểm tra phân số', 3, 10, :testDate, 'Cần cố gắng thêm')
                """).param("learnerResult", learnerResultId).param("tenant", TENANT_A)
            .param("sessionId", sessionId).param("learner", learner).param("testId", testId)
            .param("otherResult", UUID.randomUUID()).param("otherStudent", rollbackStudent)
            .param("testDate", tomorrow.toLocalDate()).update();

        String learnerToken = login("hs.fl06");
        mvc.perform(get("/api/v1/students/me/classes")
                .header("Authorization", "Bearer " + learnerToken)
                .param("access", "Accessible"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", hasItem(classId.toString())))
            .andExpect(jsonPath("$.items[*].access", hasItem("Accessible")));
        mvc.perform(get("/api/v1/students/me/classes/{classId}", classId)
                .header("Authorization", "Bearer " + learnerToken))
            .andExpect(status().isOk());
        mvc.perform(get("/api/v1/students/me/classes/{classId}/sessions", classId)
                .header("Authorization", "Bearer " + learnerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].testResult.id").value(learnerResultId.toString()))
            .andExpect(jsonPath("$.items[0].testResult.testName").value("Kiểm tra phân số"))
            .andExpect(jsonPath("$.items[0].testResult.score").value(8.5))
            .andExpect(jsonPath("$.items[0].testResult.maxScore").value(10))
            .andExpect(jsonPath("$.items[0].testResult.comment").value("Nắm bài tốt"))
            .andExpect(jsonPath("$.items[0].testResult.testComment")
                .value("Ôn lại phần quy đồng mẫu số"));
        jdbc.sql("UPDATE classes SET status='AWAITING_CLOSE' WHERE tenant_id=:tenant AND id=:id")
            .param("tenant", TENANT_A).param("id", classId).update();
        JsonNode closed = json(mvc.perform(patch("/api/v1/classes/{classId}/status", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-close")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "targetStatus", "Closed", "reason", "",
                    "version", reentered.get("classVersion").asLong(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/students/me/classes/{classId}", classId)
                .header("Authorization", "Bearer " + learnerToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STUDENT_CLASS_ACCESS_REVOKED"));
        mvc.perform(get("/api/v1/students/me/classes")
                .header("Authorization", "Bearer " + learnerToken)
                .param("access", "Locked"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].id", hasItem(classId.toString())))
            .andExpect(jsonPath("$.items[*].access", hasItem("Locked")));
        JsonNode reopened = json(mvc.perform(patch("/api/v1/classes/{classId}/status", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-reopen")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "targetStatus", "AwaitingClose", "reason", "Bổ sung hồ sơ",
                    "version", closed.get("version").asLong(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/v1/students/me/classes/{classId}", classId)
                .header("Authorization", "Bearer " + learnerToken))
            .andExpect(status().isOk());
        mvc.perform(patch("/api/v1/classes/{classId}/status", classId)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "targetStatus", "Cancelled", "reason", "Không thể tiếp tục",
                    "version", reopened.get("version").asLong(),
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.cancelledFutureSessions").value(1));
        assertThat(jdbc.sql("""
                SELECT count(*) FROM notifications
                WHERE tenant_id=:tenant AND recipient_user_id=:userId
                """).param("tenant", TENANT_A).param("userId", learnerUser)
            .query(Long.class).single()).isZero();
    }

    @Test
    void scheduledClassActivationAndCloseWarningsAreIdempotent() throws Exception {
        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).withNano(0);
        UUID activationClass = UUID.randomUUID();
        UUID activationSession = UUID.randomUUID();
        OffsetDateTime scheduledAt = now.plusDays(2);
        insertTeacherClass(activationClass, activationSession, "ONLINE", null,
            scheduledAt, scheduledAt.plusMinutes(60), "SCHEDULED");
        jdbc.sql("UPDATE classes SET status='SCHEDULED' WHERE tenant_id=:tenant AND id=:id")
            .param("tenant", TENANT_A).param("id", activationClass).update();
        assertThat(lifecycleAutomation.activate(
            TENANT_A, activationClass, scheduledAt.plusMinutes(1))).isTrue();
        assertThat(lifecycleAutomation.activate(
            TENANT_A, activationClass, scheduledAt.plusMinutes(1))).isFalse();
        assertThat(jdbc.sql("""
                SELECT count(*) FROM audit_events WHERE tenant_id=:tenant
                  AND entity_id=:id AND action='CLASS_ACTIVATED'
                """).param("tenant", TENANT_A).param("id", activationClass)
            .query(Long.class).single()).isEqualTo(1);

        UUID closingClass = UUID.randomUUID();
        UUID pendingSession = UUID.randomUUID();
        insertTeacherClass(closingClass, pendingSession, "ONLINE", null,
            now.minusHours(2), now.minusHours(1), "PENDING_CONFIRMATION");
        jdbc.sql("UPDATE classes SET status='AWAITING_CLOSE' WHERE tenant_id=:tenant AND id=:id")
            .param("tenant", TENANT_A).param("id", closingClass).update();
        String adminToken = login("admin.anhduong");
        JsonNode warning = json(mvc.perform(patch("/api/v1/classes/{classId}/status", closingClass)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-close-warning")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "targetStatus", "Closed", "reason", "", "version", 0,
                    "acknowledgedWarningIds", List.of()))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("WARNINGS_NOT_ACKNOWLEDGED"))
            .andExpect(jsonPath("$.details.warnings.length()").value(2))
            .andReturn().getResponse().getContentAsString());
        List<String> warningIds = new java.util.ArrayList<>();
        warning.at("/details/warnings").forEach(item -> warningIds.add(item.get("id").asText()));
        mvc.perform(patch("/api/v1/classes/{classId}/status", closingClass)
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl06-close-warning")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "targetStatus", "Closed", "reason", "", "version", 0,
                    "acknowledgedWarningIds", warningIds))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Closed"));
    }

    private JsonNode json(String value) throws Exception {
        return mapper.readTree(value);
    }

    @Test
    void salaryPayrollReconcilesCorrectionsPaymentsAndOwnAccess() throws Exception {
        UUID salaryUser = UUID.randomUUID();
        UUID salaryTeacher = UUID.randomUUID();
        String salaryUsername = "salary." + salaryUser.toString().substring(0, 8);
        user(salaryUser, salaryUsername, "Giáo viên FL12", "TEACHER");
        jdbc.sql("""
                INSERT INTO teacher_profiles(id, tenant_id, user_id, code)
                VALUES (:id, :tenantId, :userId, :code)
                """)
            .param("id", salaryTeacher).param("tenantId", TENANT_A)
            .param("userId", salaryUser).param("code", "FL12-" + salaryUser.toString().substring(0, 6))
            .update();

        OffsetDateTime endAt = OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .minusMinutes(5).withNano(0);
        OffsetDateTime startAt = endAt.minusMinutes(120);
        YearMonth salaryMonth = YearMonth.from(startAt);
        UUID classId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        insertTeacherClass(classId, sessionId, "ONLINE", null, startAt, endAt, "IN_PROGRESS");
        jdbc.sql("""
                UPDATE classes SET primary_teacher_id=:teacher WHERE tenant_id=:tenant AND id=:classId;
                UPDATE class_sessions SET planned_teacher_id=:teacher, actual_teacher_id=:teacher
                WHERE tenant_id=:tenant AND id=:sessionId;
                UPDATE class_teacher_assignments SET teacher_id=:teacher
                WHERE tenant_id=:tenant AND class_id=:classId
                """)
            .param("teacher", salaryTeacher).param("tenant", TENANT_A)
            .param("classId", classId).param("sessionId", sessionId).update();
        jdbc.sql("""
                INSERT INTO session_check_ins (
                  id, tenant_id, session_id, teacher_id, checked_in_at,
                  ip_address, device_info, idempotency_key
                ) VALUES (
                  :id, :tenant, :sessionId, :teacher, :checkedAt,
                  '127.0.0.1', 'FL-12 integration test', 'fl12-check-in'
                )
                """).param("id", UUID.randomUUID()).param("tenant", TENANT_A)
            .param("sessionId", sessionId).param("teacher", salaryTeacher)
            .param("checkedAt", startAt).update();

        completionService.autoCompleteCheckedIn(TENANT_A, sessionId, endAt.plusMinutes(1));
        completionService.autoCompleteCheckedIn(TENANT_A, sessionId, endAt.plusMinutes(1));
        Map<String, Object> initial = jdbc.sql("""
                SELECT amount, revision FROM salary_accruals
                WHERE tenant_id=:tenant AND session_id=:sessionId
                """).param("tenant", TENANT_A).param("sessionId", sessionId)
            .query().singleRow();
        assertThat(initial.get("amount")).isEqualTo(new java.math.BigDecimal("400000.00"));
        assertThat(initial.get("revision")).isEqualTo(0L);

        String adminToken = login("admin.anhduong");
        long version = jdbc.sql("SELECT version FROM class_sessions WHERE id=:id")
            .param("id", sessionId).query(Long.class).single();
        mvc.perform(patch("/api/v1/sessions/{id}/completion-correction", sessionId)
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "startAt", startAt,
                    "endAt", startAt.plusMinutes(90),
                    "actualTeacherId", salaryTeacher,
                    "reason", "Đối soát lại thời lượng thực tế",
                    "version", version))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.salaryAmount").value(300000))
            .andExpect(jsonPath("$.salaryRevision").value(1));

        LocalDate paidAt = salaryMonth.plusMonths(1).atDay(2);
        Map<String, Object> overpayment = new LinkedHashMap<>();
        overpayment.put("teacherId", salaryTeacher);
        overpayment.put("salaryMonth", salaryMonth.toString());
        overpayment.put("paidAt", paidAt);
        overpayment.put("amount", 400000);
        overpayment.put("method", "BANK_TRANSFER");
        overpayment.put("reference", "FL12-PAY-001");
        overpayment.put("confirmOverpayment", false);
        mvc.perform(post("/api/v1/salary/payments")
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl12-overpayment")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(overpayment)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OVERPAYMENT_CONFIRMATION_REQUIRED"));

        overpayment.put("confirmOverpayment", true);
        overpayment.put("overpaymentReason", "Tạm ứng đã được quản lý xác nhận");
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post("/api/v1/salary/payments")
                    .header("Authorization", "Bearer " + adminToken)
                    .header("Idempotency-Key", "fl12-overpayment-confirmed")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsBytes(overpayment)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount").value(400000));
        }
        assertThat(jdbc.sql("""
                SELECT count(*) FROM salary_payments
                WHERE tenant_id=:tenant AND teacher_id=:teacher AND salary_month=:month
                """).param("tenant", TENANT_A).param("teacher", salaryTeacher)
            .param("month", salaryMonth.atDay(1)).query(Long.class).single()).isEqualTo(1);

        mvc.perform(get("/api/v1/salary/payroll/{teacherId}", salaryTeacher)
                .param("month", salaryMonth.toString())
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.metrics.accrued").value(300000))
            .andExpect(jsonPath("$.metrics.outstanding").value(-100000))
            .andExpect(jsonPath("$.metrics.status").value("OVERPAID"));

        mvc.perform(get("/api/v1/finance/salary-summary")
                .param("year", String.valueOf(paidAt.getYear()))
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.months[" + (paidAt.getMonthValue() - 1)
                + "].paidCashFlow").value(400000));

        String adjustmentResponse = mvc.perform(post("/api/v1/salary/adjustments")
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl12-adjustment-negative")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "teacherId", salaryTeacher,
                    "salaryMonth", salaryMonth.toString(),
                    "amount", -10000,
                    "reason", "Khấu trừ hồ sơ thiếu"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.amount").value(-10000))
            .andReturn().getResponse().getContentAsString();
        JsonNode adjustment = json(adjustmentResponse);
        mvc.perform(patch("/api/v1/salary/adjustments/{id}", adjustment.get("id").asText())
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "teacherId", salaryTeacher,
                    "salaryMonth", salaryMonth.toString(),
                    "amount", 20000,
                    "reason", "Thưởng bổ sung hồ sơ",
                    "editReason", "Đối chiếu lại chứng từ",
                    "version", adjustment.get("version").asLong()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.amount").value(20000))
            .andExpect(jsonPath("$.version").value(1));

        Map<String, Object> paymentRow = jdbc.sql("""
                SELECT id, version FROM salary_payments
                WHERE tenant_id=:tenant AND teacher_id=:teacher AND salary_month=:month
                """).param("tenant", TENANT_A).param("teacher", salaryTeacher)
            .param("month", salaryMonth.atDay(1)).query().singleRow();
        Map<String, Object> paymentUpdate = new LinkedHashMap<>();
        paymentUpdate.put("teacherId", salaryTeacher);
        paymentUpdate.put("salaryMonth", salaryMonth.toString());
        paymentUpdate.put("paidAt", paidAt.plusDays(1));
        paymentUpdate.put("amount", 350000);
        paymentUpdate.put("method", "CASH");
        paymentUpdate.put("reference", "");
        paymentUpdate.put("confirmOverpayment", true);
        paymentUpdate.put("overpaymentReason", "Giữ nguyên xác nhận tạm ứng");
        paymentUpdate.put("editReason", "Sửa theo phiếu chi tiền mặt");
        paymentUpdate.put("version", paymentRow.get("version"));
        mvc.perform(patch("/api/v1/salary/payments/{id}", paymentRow.get("id"))
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(paymentUpdate)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.method").value("CASH"))
            .andExpect(jsonPath("$.amount").value(350000))
            .andExpect(jsonPath("$.version").value(1));

        mvc.perform(post("/api/v1/salary/payments")
                .header("Authorization", "Bearer " + adminToken)
                .header("Idempotency-Key", "fl12-second-payment")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "teacherId", salaryTeacher,
                    "salaryMonth", salaryMonth.toString(),
                    "paidAt", paidAt.plusDays(2),
                    "amount", 10000,
                    "method", "CASH",
                    "confirmOverpayment", true,
                    "overpaymentReason", "Chi bổ sung đã duyệt"))))
            .andExpect(status().isCreated());
        mvc.perform(get("/api/v1/salary/payroll/{teacherId}", salaryTeacher)
                .param("month", salaryMonth.toString())
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.metrics.adjustments").value(20000))
            .andExpect(jsonPath("$.metrics.paid").value(360000))
            .andExpect(jsonPath("$.metrics.outstanding").value(-40000));

        byte[] workbook = mvc.perform(get("/api/v1/salary/payroll/export")
                .param("month", salaryMonth.toString())
                .param("search", "Giáo viên FL12")
                .header("Authorization", "Bearer " + adminToken))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray();
        assertThat(workbook.length).isGreaterThan(1000);

        String teacherToken = login(salaryUsername);
        mvc.perform(get("/api/v1/teachers/me/salary")
                .param("month", salaryMonth.toString())
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.teacherId").value(salaryTeacher.toString()));
        mvc.perform(get("/api/v1/salary/payroll/{teacherId}", TEACHER)
                .param("month", salaryMonth.toString())
                .header("Authorization", "Bearer " + teacherToken))
            .andExpect(status().isForbidden());
    }

    private long count(String table, UUID classId) {
        String sql = "SELECT count(*) FROM " + table
            + " WHERE tenant_id=:tenant AND class_id=:classId";
        return jdbc.sql(sql).param("tenant", TENANT_A).param("classId", classId)
            .query(Long.class).single();
    }

    private String login(String username) throws Exception {
        String response = mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "tenantSlug", "anh-duong",
                    "username", username,
                    "password", "Demo@123"))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return json(response).get("token").asText();
    }

    private void insertTeacherClass(UUID classId, UUID sessionId, String mode, UUID roomId,
                                    OffsetDateTime startAt, OffsetDateTime endAt,
                                    String sessionStatus) {
        LocalDate sessionDate = startAt.atZoneSameInstant(
            ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        jdbc.sql("""
                INSERT INTO classes (
                  id, tenant_id, code, name, primary_teacher_id, start_date,
                  total_sessions, tuition_amount, capacity, default_mode, status,
                  expected_end_date, published_at, created_by, updated_by
                ) VALUES (
                  :id, :tenant, :code, 'Lớp vận hành giáo viên', :teacher, :date,
                  1, 1000000, 20, :mode, 'ACTIVE', :date, now(), :admin, :admin
                )
                """)
            .param("id", classId).param("tenant", TENANT_A)
            .param("code", "OPS-" + classId.toString().substring(0, 8))
            .param("teacher", TEACHER).param("date", sessionDate)
            .param("mode", mode).param("admin", ADMIN_A).update();
        jdbc.sql("""
                INSERT INTO class_hourly_rates (
                  id, tenant_id, class_id, effective_date, hourly_rate, created_by, updated_by
                ) VALUES (:id, :tenant, :classId, :date, 200000, :admin, :admin)
                """)
            .param("id", UUID.randomUUID()).param("tenant", TENANT_A)
            .param("classId", classId).param("date", sessionDate.minusDays(30))
            .param("admin", ADMIN_A).update();
        jdbc.sql("""
                INSERT INTO class_teacher_assignments (
                  id, tenant_id, class_id, teacher_id, effective_from
                ) VALUES (:id, :tenant, :classId, :teacher, :date)
                """)
            .param("id", UUID.randomUUID()).param("tenant", TENANT_A)
            .param("classId", classId).param("teacher", TEACHER)
            .param("date", sessionDate.minusDays(30)).update();
        jdbc.sql("""
                INSERT INTO class_enrollments (
                  id, tenant_id, class_id, student_id, status, effective_from, created_by
                ) VALUES (:id, :tenant, :classId, :student, 'ACTIVE', :date, :createdBy)
                """)
            .param("id", UUID.randomUUID()).param("tenant", TENANT_A)
            .param("classId", classId).param("student", STUDENT)
            .param("date", sessionDate.minusDays(30)).param("createdBy", ADMIN_A).update();
        jdbc.sql("""
                INSERT INTO class_sessions (
                  id, tenant_id, class_id, ordinal, pattern_key, session_key,
                  start_at, end_at, planned_teacher_id, actual_teacher_id,
                  mode, room_id, status
                ) VALUES (
                  :id, :tenant, :classId, 1, 'test-pattern', :sessionKey,
                  :startAt, :endAt, :teacher, :teacher, :mode,
                  CASE WHEN :roomId='' THEN NULL ELSE CAST(:roomId AS uuid) END,
                  :status
                )
                """)
            .param("id", sessionId).param("tenant", TENANT_A).param("classId", classId)
            .param("sessionKey", "test@" + sessionId)
            .param("startAt", startAt).param("endAt", endAt).param("teacher", TEACHER)
            .param("mode", mode).param("roomId", roomId == null ? "" : roomId.toString())
            .param("status", sessionStatus).update();
    }

    private void user(UUID id, String username, String name, String role) {
        user(id, username, name, role, "ACTIVE", "READY");
    }

    private void user(UUID id, String username, String name, String role,
                      String status, String passwordState) {
        jdbc.sql("""
                INSERT INTO users (
                  id, tenant_id, username, display_name, email, password_hash,
                  status, password_state
                ) VALUES (
                  :id, :tenantId, :username, :name, :email, :password, :status, :passwordState
                )
                """).param("id", id).param("tenantId", TENANT_A).param("username", username)
            .param("name", name).param("email", username + "@classops.local")
            .param("password", passwords.encode("Demo@123"))
            .param("status", status).param("passwordState", passwordState).update();
        jdbc.sql("""
                INSERT INTO user_roles(tenant_id, user_id, role_code)
                VALUES (:tenantId, :userId, :role)
                """).param("tenantId", TENANT_A).param("userId", id).param("role", role).update();
    }
}
