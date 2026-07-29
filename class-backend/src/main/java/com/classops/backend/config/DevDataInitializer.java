package com.classops.backend.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Component
@Profile("dev")
public class DevDataInitializer implements ApplicationRunner {
    public static final UUID TENANT_A = UUID.fromString("11111111-1111-1111-1111-111111111111");
    public static final UUID TENANT_B = UUID.fromString("22222222-2222-2222-2222-222222222222");
    public static final UUID TENANT_LOCKED =
        UUID.fromString("33333333-3333-3333-3333-333333333333");
    public static final UUID ADMIN_A = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    public static final UUID ACADEMIC_A = UUID.fromString("a0000000-0000-0000-0000-000000000002");
    public static final UUID ACCOUNTANT_A = UUID.fromString("a0000000-0000-0000-0000-000000000003");
    public static final UUID TEACHER_USER_A = UUID.fromString("a0000000-0000-0000-0000-000000000004");
    public static final UUID TEACHER_USER_A2 = UUID.fromString("a0000000-0000-0000-0000-000000000005");
    public static final UUID STUDENT_USER_A = UUID.fromString("a0000000-0000-0000-0000-000000000006");
    public static final UUID STUDENT_USER_A2 = UUID.fromString("a0000000-0000-0000-0000-000000000007");
    public static final UUID MULTI_ROLE_A =
        UUID.fromString("a0000000-0000-0000-0000-000000000008");
    public static final UUID FIRST_LOGIN_A =
        UUID.fromString("a0000000-0000-0000-0000-000000000009");
    public static final UUID LOCKED_USER_A =
        UUID.fromString("a0000000-0000-0000-0000-000000000010");
    public static final UUID TEACHER_A = UUID.fromString("a2000000-0000-0000-0000-000000000001");
    public static final UUID TEACHER_A2 = UUID.fromString("a2000000-0000-0000-0000-000000000002");
    public static final UUID STUDENT_A = UUID.fromString("a3000000-0000-0000-0000-000000000001");
    public static final UUID STUDENT_A2 = UUID.fromString("a3000000-0000-0000-0000-000000000002");
    public static final UUID ROOM_A = UUID.fromString("a4000000-0000-0000-0000-000000000001");
    public static final UUID ROOM_A2 = UUID.fromString("a4000000-0000-0000-0000-000000000002");

    private final JdbcClient jdbc;
    private final PasswordEncoder passwords;

    public DevDataInitializer(JdbcClient jdbc, PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.passwords = passwords;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long count = jdbc.sql("SELECT count(*) FROM tenants").query(Long.class).single();
        if (count > 0) {
            seedTeacherOperationsDemo();
            return;
        }
        insertTenant(TENANT_A, "anh-duong", "Trung tâm Ánh Dương", "ACTIVE");
        insertTenant(TENANT_B, "minh-tam", "Trung tâm Minh Tâm", "ACTIVE");
        insertTenant(TENANT_LOCKED, "khoa-son", "Trung tâm Khoa Sơn", "LOCKED");

        insertUser(TENANT_A, ADMIN_A, "admin.anhduong", "Nguyễn Minh Admin", "ADMIN");
        insertUser(TENANT_A, ACADEMIC_A, "hocvu.anhduong", "Trần Thu Học vụ", "ACADEMIC_MANAGER");
        insertUser(TENANT_A, ACCOUNTANT_A, "ketoan.anhduong", "Phạm Mai Kế toán", "ACCOUNTANT");
        insertUser(TENANT_A, TEACHER_USER_A, "gv.lan", "Cô Nguyễn Ngọc Lan", "TEACHER");
        insertUser(TENANT_A, TEACHER_USER_A2, "gv.nam", "Thầy Trần Hoàng Nam", "TEACHER");
        insertUser(TENANT_A, STUDENT_USER_A, "hs.minhanh", "Lê Minh Anh", "STUDENT");
        insertUser(TENANT_A, STUDENT_USER_A2, "hs.giabao", "Nguyễn Gia Bảo", "STUDENT");
        insertUser(TENANT_A, MULTI_ROLE_A, "admin.ketoan", "Đỗ Khánh Linh", "ADMIN");
        insertRole(TENANT_A, MULTI_ROLE_A, "ACCOUNTANT");
        insertUser(TENANT_A, FIRST_LOGIN_A, "first.login", "Bùi Gia Hân",
            "ACADEMIC_MANAGER", "ACTIVE", "MUST_CHANGE");
        insertUser(TENANT_A, LOCKED_USER_A, "locked.user", "Tài khoản bị khóa",
            "ACADEMIC_MANAGER", "LOCKED", "READY");

        UUID adminB = UUID.fromString("b0000000-0000-0000-0000-000000000001");
        UUID teacherUserB = UUID.fromString("b0000000-0000-0000-0000-000000000002");
        insertUser(TENANT_B, adminB, "admin.minhtam", "Admin Minh Tâm", "ADMIN");
        insertUser(TENANT_B, teacherUserB, "gv.minhtam", "Giáo viên Minh Tâm", "TEACHER");
        insertUser(TENANT_LOCKED,
            UUID.fromString("c0000000-0000-0000-0000-000000000001"),
            "admin.khoason", "Admin Khoa Sơn", "ADMIN");

        insertTeacher(TENANT_A, TEACHER_A, TEACHER_USER_A, "GV001");
        insertTeacher(TENANT_A, TEACHER_A2, TEACHER_USER_A2, "GV002");
        insertTeacher(TENANT_B, UUID.fromString("b2000000-0000-0000-0000-000000000001"),
            teacherUserB, "GV001");
        insertStudent(TENANT_A, STUDENT_A, STUDENT_USER_A, "HS001");
        insertStudent(TENANT_A, STUDENT_A2, STUDENT_USER_A2, "HS002");

        insertRoom(TENANT_A, ROOM_A, "P101", "Phòng 101", 24, "ACTIVE");
        insertRoom(TENANT_A, ROOM_A2, "P102", "Phòng 102", 18, "ACTIVE");
        insertRoom(TENANT_A, UUID.fromString("a4000000-0000-0000-0000-000000000003"),
            "P-CU", "Phòng ngừng sử dụng", 10, "INACTIVE");
        insertRoom(TENANT_B, UUID.fromString("b4000000-0000-0000-0000-000000000001"),
            "P201", "Phòng 201", 20, "ACTIVE");

        jdbc.sql("""
                INSERT INTO tenant_holidays (id, tenant_id, name, start_date, end_date)
                VALUES (:id, :tenantId, 'Quốc khánh', '2026-09-02', '2026-09-03')
                """)
            .param("id", UUID.fromString("a5000000-0000-0000-0000-000000000001"))
            .param("tenantId", TENANT_A).update();
        seedPublishedClass();
        seedTeacherOperationsDemo();
    }

    private void seedTeacherOperationsDemo() {
        UUID classId = UUID.fromString("a6000000-0000-0000-0000-000000000020");
        UUID openSessionId = UUID.fromString("a7000000-0000-0000-0000-000000000020");
        UUID pendingSessionId = UUID.fromString("a7000000-0000-0000-0000-000000000021");
        UUID completedSessionId = UUID.fromString("a7000000-0000-0000-0000-000000000022");
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        OffsetDateTime now = OffsetDateTime.now(zone).withSecond(0).withNano(0);
        LocalDate today = now.toLocalDate();
        jdbc.sql("""
                INSERT INTO classes (
                  id, tenant_id, code, name, description, primary_teacher_id, start_date,
                  total_sessions, tuition_amount, capacity, default_mode, status,
                  expected_end_date, published_at, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, 'CLS-TEACH-01', 'Toán tư duy 4A',
                  'Dữ liệu development cho luồng vận hành giáo viên',
                  :teacherId, :startDate, 12, 2400000, 20, 'IN_PERSON', 'ACTIVE',
                  :endDate, now(), :adminId, :adminId
                )
                ON CONFLICT (tenant_id, id) DO NOTHING
                """)
            .param("id", classId).param("tenantId", TENANT_A).param("teacherId", TEACHER_A)
            .param("startDate", today.minusDays(30)).param("endDate", today.plusDays(60))
            .param("adminId", ADMIN_A).update();
        jdbc.sql("""
                INSERT INTO class_hourly_rates (
                  id, tenant_id, class_id, effective_date, hourly_rate
                ) VALUES (
                  :id, :tenantId, :classId, :effectiveDate, 220000
                )
                ON CONFLICT (tenant_id, class_id, effective_date) DO NOTHING
                """)
            .param("id", UUID.fromString("a6100000-0000-0000-0000-000000000020"))
            .param("tenantId", TENANT_A).param("classId", classId)
            .param("effectiveDate", today.minusDays(30)).update();
        jdbc.sql("""
                INSERT INTO class_teacher_assignments (
                  id, tenant_id, class_id, teacher_id, effective_from
                ) VALUES (
                  :id, :tenantId, :classId, :teacherId, :effectiveFrom
                )
                ON CONFLICT (tenant_id, class_id, teacher_id, effective_from) DO NOTHING
                """)
            .param("id", UUID.fromString("a6200000-0000-0000-0000-000000000020"))
            .param("tenantId", TENANT_A).param("classId", classId)
            .param("teacherId", TEACHER_A).param("effectiveFrom", today.minusDays(30)).update();

        UUID enrollmentA = UUID.fromString("a6300000-0000-0000-0000-000000000020");
        UUID enrollmentB = UUID.fromString("a6300000-0000-0000-0000-000000000021");
        insertDemoEnrollment(enrollmentA, classId, STUDENT_A, today.minusDays(30));
        insertDemoEnrollment(enrollmentB, classId, STUDENT_A2, today.minusDays(30));

        OffsetDateTime openStart = now.plusMinutes(10);
        OffsetDateTime openEnd = now.plusMinutes(100);
        insertDemoSession(openSessionId, classId, 3, "dev-open",
            openStart, openEnd, "IN_PERSON", ROOM_A, "SCHEDULED", false);
        insertDemoSession(pendingSessionId, classId, 2, "dev-pending",
            now.minusMinutes(120), now.minusMinutes(30), "ONLINE", null,
            "PENDING_CONFIRMATION", false);
        OffsetDateTime completedStart = today.minusDays(1).atTime(19, 0)
            .atZone(zone).toOffsetDateTime();
        OffsetDateTime completedEnd = today.minusDays(1).atTime(20, 30)
            .atZone(zone).toOffsetDateTime();
        insertDemoSession(completedSessionId, classId, 1, "dev-completed",
            completedStart, completedEnd, "IN_PERSON", ROOM_A, "COMPLETED", true);

        OffsetDateTime frozenAt = completedEnd.plusMinutes(1);
        jdbc.sql("""
                INSERT INTO session_roster_members (
                  id, tenant_id, session_id, student_id, enrollment_id, frozen_at
                ) VALUES
                  (:idA, :tenantId, :sessionId, :studentA, :enrollmentA, :frozenAt),
                  (:idB, :tenantId, :sessionId, :studentB, :enrollmentB, :frozenAt)
                ON CONFLICT (tenant_id, session_id, student_id) DO NOTHING
                """)
            .param("idA", UUID.fromString("a6400000-0000-0000-0000-000000000020"))
            .param("idB", UUID.fromString("a6400000-0000-0000-0000-000000000021"))
            .param("tenantId", TENANT_A).param("sessionId", completedSessionId)
            .param("studentA", STUDENT_A).param("studentB", STUDENT_A2)
            .param("enrollmentA", enrollmentA).param("enrollmentB", enrollmentB)
            .param("frozenAt", frozenAt).update();
        jdbc.sql("""
                INSERT INTO session_attendances (
                  id, tenant_id, session_id, student_id, status, note
                ) VALUES
                  (:idA, :tenantId, :sessionId, :studentA, 'PRESENT', ''),
                  (:idB, :tenantId, :sessionId, :studentB, 'LATE', 'Đi muộn 10 phút')
                ON CONFLICT (tenant_id, session_id, student_id) DO NOTHING
                """)
            .param("idA", UUID.fromString("a6500000-0000-0000-0000-000000000020"))
            .param("idB", UUID.fromString("a6500000-0000-0000-0000-000000000021"))
            .param("tenantId", TENANT_A).param("sessionId", completedSessionId)
            .param("studentA", STUDENT_A).param("studentB", STUDENT_A2).update();
        jdbc.sql("""
                INSERT INTO session_lesson_reports (
                  id, tenant_id, session_id, lesson_name, lesson_content, record_url
                ) VALUES (
                  :id, :tenantId, :sessionId, 'Phân số nâng cao',
                  'Ôn quy đồng mẫu số và bài toán vận dụng.',
                  'https://www.youtube.com/watch?v=demo-record'
                )
                ON CONFLICT (tenant_id, session_id) DO NOTHING
                """)
            .param("id", UUID.fromString("a6600000-0000-0000-0000-000000000020"))
            .param("tenantId", TENANT_A).param("sessionId", completedSessionId).update();
        jdbc.sql("""
                INSERT INTO salary_accruals (
                  id, tenant_id, session_id, teacher_id, scheduled_minutes,
                  hourly_rate_snapshot, amount
                ) VALUES (
                  :id, :tenantId, :sessionId, :teacherId, 90, 220000, 330000
                )
                ON CONFLICT (tenant_id, session_id) DO NOTHING
                """)
            .param("id", UUID.fromString("a6700000-0000-0000-0000-000000000020"))
            .param("tenantId", TENANT_A).param("sessionId", completedSessionId)
            .param("teacherId", TEACHER_A).update();
    }

    private void insertDemoEnrollment(UUID id, UUID classId, UUID studentId,
                                      LocalDate effectiveFrom) {
        jdbc.sql("""
                INSERT INTO class_enrollments (
                  id, tenant_id, class_id, student_id, status, effective_from
                ) VALUES (
                  :id, :tenantId, :classId, :studentId, 'ACTIVE', :effectiveFrom
                )
                ON CONFLICT (tenant_id, class_id, student_id) DO NOTHING
                """)
            .param("id", id).param("tenantId", TENANT_A).param("classId", classId)
            .param("studentId", studentId).param("effectiveFrom", effectiveFrom).update();
    }

    private void insertDemoSession(UUID id, UUID classId, int ordinal, String pattern,
                                   OffsetDateTime startAt, OffsetDateTime endAt,
                                   String mode, UUID roomId, String status, boolean completed) {
        jdbc.sql("""
                INSERT INTO class_sessions (
                  id, tenant_id, class_id, ordinal, pattern_key, session_key,
                  start_at, end_at, planned_teacher_id, actual_teacher_id,
                  mode, room_id, status, completed_at, completion_source,
                  roster_frozen_at, missing_documentation
                ) VALUES (
                  :id, :tenantId, :classId, :ordinal, :pattern, :sessionKey,
                  :startAt, :endAt, :teacherId, :teacherId,
                  :mode, :roomId, :status, :completedAt, :completionSource,
                  :rosterFrozenAt, false
                )
                ON CONFLICT (tenant_id, id) DO NOTHING
                """)
            .param("id", id).param("tenantId", TENANT_A).param("classId", classId)
            .param("ordinal", ordinal).param("pattern", pattern)
            .param("sessionKey", pattern + "@" + startAt.toLocalDate())
            .param("startAt", startAt).param("endAt", endAt).param("teacherId", TEACHER_A)
            .param("mode", mode).param("roomId", roomId).param("status", status)
            .param("completedAt", completed ? endAt.plusMinutes(1) : null)
            .param("completionSource", completed ? "AUTO_CHECK_IN" : null)
            .param("rosterFrozenAt", completed ? endAt.plusMinutes(1) : null).update();
    }

    private void seedPublishedClass() {
        UUID classId = UUID.fromString("a6000000-0000-0000-0000-000000000001");
        jdbc.sql("""
                INSERT INTO classes (
                  id, tenant_id, code, name, description, primary_teacher_id, start_date,
                  total_sessions, tuition_amount, capacity, default_mode, status,
                  expected_end_date, published_at, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, 'CLS-26001', 'Tiếng Anh nền tảng A1', 'Lớp dữ liệu mẫu',
                  :teacherId, '2026-08-03', 12, 2400000, 20, 'IN_PERSON', 'SCHEDULED',
                  '2026-10-19', now(), :adminId, :adminId
                )
                """)
            .param("id", classId).param("tenantId", TENANT_A).param("teacherId", TEACHER_A)
            .param("adminId", ADMIN_A).update();
        jdbc.sql("""
                INSERT INTO class_hourly_rates (id, tenant_id, class_id, effective_date, hourly_rate)
                VALUES (:id, :tenantId, :classId, '2026-08-03', 220000)
                """)
            .param("id", UUID.randomUUID()).param("tenantId", TENANT_A).param("classId", classId)
            .update();
        jdbc.sql("""
                INSERT INTO class_schedule_patterns (
                  id, tenant_id, class_id, client_key, weekday, start_time, end_time,
                  mode, room_id, sort_order
                ) VALUES (
                  :id, :tenantId, :classId, 'seed-mon', 1, '19:00', '20:30',
                  'IN_PERSON', :roomId, 0
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", TENANT_A).param("classId", classId)
            .param("roomId", ROOM_A).update();
        UUID sessionId = UUID.fromString("a7000000-0000-0000-0000-000000000001");
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        jdbc.sql("""
                INSERT INTO class_sessions (
                  id, tenant_id, class_id, ordinal, pattern_key, session_key,
                  start_at, end_at, planned_teacher_id, actual_teacher_id,
                  mode, room_id, status
                ) VALUES (
                  :id, :tenantId, :classId, 1, 'seed-mon', 'seed-mon@2026-08-03',
                  :startAt, :endAt, :teacherId, :teacherId, 'IN_PERSON', :roomId, 'SCHEDULED'
                )
                """)
            .param("id", sessionId).param("tenantId", TENANT_A).param("classId", classId)
            .param("startAt", LocalDate.of(2026, 8, 3).atTime(19, 0).atZone(zone).toOffsetDateTime())
            .param("endAt", LocalDate.of(2026, 8, 3).atTime(20, 30).atZone(zone).toOffsetDateTime())
            .param("teacherId", TEACHER_A).param("roomId", ROOM_A).update();
        UUID enrollmentId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO class_enrollments (
                  id, tenant_id, class_id, student_id, status, effective_from
                ) VALUES (
                  :id, :tenantId, :classId, :studentId, 'ACTIVE', '2026-08-03'
                )
                """)
            .param("id", enrollmentId).param("tenantId", TENANT_A).param("classId", classId)
            .param("studentId", STUDENT_A).update();
        jdbc.sql("""
                INSERT INTO tuition_charges (
                  id, tenant_id, class_id, student_id, enrollment_id, amount, status
                ) VALUES (
                  :id, :tenantId, :classId, :studentId, :enrollmentId, 2400000, 'UNPAID'
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", TENANT_A).param("classId", classId)
            .param("studentId", STUDENT_A).param("enrollmentId", enrollmentId).update();
    }

    private void insertTenant(UUID id, String slug, String name, String status) {
        jdbc.sql("INSERT INTO tenants (id, slug, name, status) VALUES (:id, :slug, :name, :status)")
            .param("id", id).param("slug", slug).param("name", name).param("status", status).update();
    }

    private void insertUser(UUID tenantId, UUID id, String username, String name, String role) {
        insertUser(tenantId, id, username, name, role, "ACTIVE", "READY");
    }

    private void insertUser(UUID tenantId, UUID id, String username, String name, String role,
                            String status, String passwordState) {
        jdbc.sql("""
                INSERT INTO users (
                  id, tenant_id, username, display_name, email, password_hash,
                  status, password_state
                ) VALUES (
                  :id, :tenantId, :username, :name, :email, :password, :status, :passwordState
                )
                """)
            .param("id", id).param("tenantId", tenantId).param("username", username)
            .param("name", name).param("email", username + "@classops.local")
            .param("password", passwords.encode("Demo@123"))
            .param("status", status).param("passwordState", passwordState).update();
        insertRole(tenantId, id, role);
    }

    private void insertRole(UUID tenantId, UUID userId, String role) {
        jdbc.sql("""
                INSERT INTO user_roles (tenant_id, user_id, role_code)
                VALUES (:tenantId, :userId, :role)
                """)
            .param("tenantId", tenantId).param("userId", userId).param("role", role).update();
    }

    private void insertTeacher(UUID tenantId, UUID id, UUID userId, String code) {
        jdbc.sql("""
                INSERT INTO teacher_profiles (id, tenant_id, user_id, code)
                VALUES (:id, :tenantId, :userId, :code)
                """)
            .param("id", id).param("tenantId", tenantId).param("userId", userId)
            .param("code", code).update();
    }

    private void insertStudent(UUID tenantId, UUID id, UUID userId, String code) {
        jdbc.sql("""
                INSERT INTO student_profiles (id, tenant_id, user_id, code)
                VALUES (:id, :tenantId, :userId, :code)
                """)
            .param("id", id).param("tenantId", tenantId).param("userId", userId)
            .param("code", code).update();
    }

    private void insertRoom(UUID tenantId, UUID id, String code, String name,
                            int capacity, String status) {
        jdbc.sql("""
                INSERT INTO rooms (id, tenant_id, code, name, capacity, status)
                VALUES (:id, :tenantId, :code, :name, :capacity, :status)
                """)
            .param("id", id).param("tenantId", tenantId).param("code", code)
            .param("name", name).param("capacity", capacity).param("status", status).update();
    }
}
