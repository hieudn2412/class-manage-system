package com.classops.backend.scheduling;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers(disabledWithoutDocker = true)
class EnrollmentMigrationIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("migration_test")
            .withUsername("migration_test")
            .withPassword("migration_test");

    private static final UUID TENANT = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID ADMIN = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID TEACHER_USER = UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID STUDENT_USER = UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final UUID TEACHER = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID STUDENT = UUID.fromString("10000000-0000-0000-0000-000000000006");
    private static final UUID CLASS_ID = UUID.fromString("10000000-0000-0000-0000-000000000007");
    private static final UUID LEGACY_ENROLLMENT = UUID.fromString("10000000-0000-0000-0000-000000000008");

    @Test
    void convertsLegacyInclusiveEndDateAndEnablesReentryCharges() throws Exception {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(),
                POSTGRES.getPassword())
            .target(MigrationVersion.fromVersion("6")).load().migrate();
        try (Connection connection = connection()) {
            connection.createStatement().execute("""
                INSERT INTO tenants(id, slug, name, status)
                VALUES ('10000000-0000-0000-0000-000000000001', 'migration', 'Migration', 'ACTIVE');
                INSERT INTO users(id, tenant_id, username, display_name, password_hash, status, password_state)
                VALUES
                  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'admin', 'Admin', 'hash', 'ACTIVE', 'READY'),
                  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'teacher', 'Teacher', 'hash', 'ACTIVE', 'READY'),
                  ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'student', 'Student', 'hash', 'ACTIVE', 'READY');
                INSERT INTO teacher_profiles(id, tenant_id, user_id, code)
                VALUES ('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'GV-MIG');
                INSERT INTO student_profiles(id, tenant_id, user_id, code)
                VALUES ('10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'HS-MIG');
                INSERT INTO classes(
                  id, tenant_id, code, name, primary_teacher_id, start_date, total_sessions,
                  tuition_amount, capacity, default_mode, status, created_by, updated_by
                ) VALUES (
                  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001',
                  'CLS-MIG', 'Legacy class', '10000000-0000-0000-0000-000000000005', '2026-07-01',
                  10, 1000000, 20, 'ONLINE', 'ACTIVE',
                  '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'
                );
                INSERT INTO class_enrollments(
                  id, tenant_id, class_id, student_id, status, effective_from, effective_to
                ) VALUES (
                  '10000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001',
                  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000006',
                  'REMOVED', '2026-07-01', '2026-08-04'
                );
                INSERT INTO tuition_charges(
                  id, tenant_id, class_id, student_id, enrollment_id, amount, status
                ) VALUES (
                  '10000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001',
                  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000006',
                  '10000000-0000-0000-0000-000000000008', 1000000, 'UNPAID'
                );
                """);
        }

        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(),
            POSTGRES.getPassword()).load().migrate();
        try (Connection connection = connection()) {
            var migrated = connection.prepareStatement("""
                SELECT status, effective_to, created_by FROM class_enrollments WHERE id=?
                """);
            migrated.setObject(1, LEGACY_ENROLLMENT);
            var result = migrated.executeQuery();
            assertThat(result.next()).isTrue();
            assertThat(result.getString("status")).isEqualTo("LEFT");
            assertThat(result.getObject("effective_to", LocalDate.class))
                .isEqualTo(LocalDate.of(2026, 8, 5));
            assertThat(result.getObject("created_by", UUID.class)).isEqualTo(ADMIN);

            connection.createStatement().execute("""
                INSERT INTO class_enrollments(
                  id, tenant_id, class_id, student_id, status, effective_from, created_by
                ) VALUES (
                  '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001',
                  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000006',
                  'ACTIVE', '2026-08-10', '10000000-0000-0000-0000-000000000002'
                );
                INSERT INTO tuition_charges(
                  id, tenant_id, class_id, student_id, enrollment_id, amount, status
                ) VALUES (
                  '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001',
                  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000006',
                  '10000000-0000-0000-0000-000000000010', 1000000, 'UNPAID'
                );
                """);
            assertThatThrownBy(() -> connection.createStatement().execute("""
                INSERT INTO class_enrollments(
                  id, tenant_id, class_id, student_id, status, effective_from, created_by
                ) VALUES (
                  '10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001',
                  '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000006',
                  'ACTIVE', '2026-08-11', '10000000-0000-0000-0000-000000000002'
                )
                """)).isInstanceOf(SQLException.class)
                .extracting(error -> ((SQLException) error).getSQLState())
                .isEqualTo("23505");
        }
    }

    private Connection connection() throws SQLException {
        return DriverManager.getConnection(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }
}
