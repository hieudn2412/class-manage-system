package com.classops.backend.scheduling;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.classops.backend.teaching.SessionCompletionService;
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
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
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
    private static final UUID TEACHER = UUID.fromString("a2000000-0000-0000-0000-000000000001");
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
            .andExpect(jsonPath("$.sessions.length()").value(1));
        String teacherToken = login("gv.lan");
        mvc.perform(get("/api/v1/schedules/me")
                .header("Authorization", "Bearer " + teacherToken)
                .param("weekStart", "2026-08-03"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions[0].classId").value(classId.toString()));

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

        mvc.perform(post(
                "/api/v1/sessions/{sessionId}/students/{studentId}/test-results",
                sessionId, STUDENT)
                .header("Authorization", "Bearer " + teacherToken)
                .header("Idempotency-Key", "teacher-test-result-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(Map.of(
                    "testName", "Kiểm tra phân số",
                    "score", 8.5,
                    "maxScore", 10,
                    "testDate", LocalDate.now().toString(),
                    "comment", "Nắm bài tốt",
                    "version", 0))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.score").value(8.5));

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
            .andExpect(jsonPath("$.students[0].testResults[0].score").value(8.5));
        assertThat(jdbc.sql("""
                SELECT amount FROM salary_accruals
                WHERE tenant_id=:tenant AND session_id=:sessionId
                """).param("tenant", TENANT_A).param("sessionId", sessionId)
            .query(java.math.BigDecimal.class).single())
            .isEqualByComparingTo("200000");

        jdbc.sql("""
                UPDATE class_enrollments SET effective_to=:yesterday, status='REMOVED'
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

    private JsonNode json(String value) throws Exception {
        return mapper.readTree(value);
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
                  id, tenant_id, class_id, effective_date, hourly_rate
                ) VALUES (:id, :tenant, :classId, :date, 200000)
                """)
            .param("id", UUID.randomUUID()).param("tenant", TENANT_A)
            .param("classId", classId).param("date", sessionDate.minusDays(30)).update();
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
                  id, tenant_id, class_id, student_id, status, effective_from
                ) VALUES (:id, :tenant, :classId, :student, 'ACTIVE', :date)
                """)
            .param("id", UUID.randomUUID()).param("tenant", TENANT_A)
            .param("classId", classId).param("student", STUDENT)
            .param("date", sessionDate.minusDays(30)).update();
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
