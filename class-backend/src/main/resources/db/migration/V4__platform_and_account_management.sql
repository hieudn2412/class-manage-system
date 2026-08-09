CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE platform_users
    ADD COLUMN singleton_slot SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN last_login_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_platform_user_singleton CHECK (singleton_slot = 1),
    ADD CONSTRAINT uq_platform_user_singleton UNIQUE (singleton_slot);

ALTER TABLE users
    ADD COLUMN last_login_at TIMESTAMPTZ,
    ADD COLUMN profile_type VARCHAR(20);

UPDATE users u
SET profile_type = CASE
    WHEN EXISTS (SELECT 1 FROM student_profiles s WHERE s.tenant_id=u.tenant_id AND s.user_id=u.id) THEN 'STUDENT'
    WHEN EXISTS (SELECT 1 FROM teacher_profiles t WHERE t.tenant_id=u.tenant_id AND t.user_id=u.id) THEN 'TEACHER'
    ELSE 'STAFF'
END;

ALTER TABLE users
    ALTER COLUMN profile_type SET NOT NULL,
    ALTER COLUMN profile_type SET DEFAULT 'STAFF',
    ADD CONSTRAINT chk_user_profile_type CHECK (profile_type IN ('STAFF', 'TEACHER', 'STUDENT'));

ALTER TABLE tenants
    ADD COLUMN initial_admin_user_id UUID,
    ADD CONSTRAINT fk_tenant_initial_admin
        FOREIGN KEY (id, initial_admin_user_id) REFERENCES users(tenant_id, id);

ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_code_check;
ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_role_code_check CHECK (role_code IN
        ('ADMIN', 'ACADEMIC_MANAGER', 'ACCOUNTANT', 'TEACHER', 'STUDENT'));

ALTER TABLE audit_events DROP CONSTRAINT chk_audit_actor_type;
ALTER TABLE audit_events
    ADD COLUMN platform_actor_user_id UUID,
    ADD CONSTRAINT fk_audit_platform_actor
        FOREIGN KEY (platform_actor_user_id) REFERENCES platform_users(id),
    ADD CONSTRAINT chk_audit_actor_type CHECK (actor_type IN ('USER', 'PLATFORM', 'SYSTEM')),
    ADD CONSTRAINT chk_audit_actor_reference CHECK (
        (actor_type = 'USER' AND actor_user_id IS NOT NULL AND platform_actor_user_id IS NULL)
        OR (actor_type = 'PLATFORM' AND actor_user_id IS NULL AND platform_actor_user_id IS NOT NULL)
        OR (actor_type = 'SYSTEM' AND actor_user_id IS NULL AND platform_actor_user_id IS NULL)
    );

CREATE TABLE platform_login_attempts (
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('ACCOUNT', 'IP')),
    subject_hash VARCHAR(64) NOT NULL,
    failed_count INTEGER NOT NULL CHECK (failed_count > 0),
    last_failed_at TIMESTAMPTZ NOT NULL,
    blocked_until TIMESTAMPTZ,
    PRIMARY KEY (scope, subject_hash)
);

CREATE INDEX idx_platform_login_attempts_blocked
    ON platform_login_attempts (blocked_until)
    WHERE blocked_until IS NOT NULL;

CREATE TABLE tenant_profile_counters (
    tenant_id UUID NOT NULL,
    profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('TEACHER', 'STUDENT')),
    next_value INTEGER NOT NULL CHECK (next_value > 0),
    PRIMARY KEY (tenant_id, profile_type),
    CONSTRAINT fk_profile_counter_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_tenants_status_created ON tenants (status, created_at DESC);
CREATE INDEX idx_users_tenant_created ON users (tenant_id, created_at DESC);
CREATE INDEX idx_user_roles_tenant_role ON user_roles (tenant_id, role_code, user_id);
