CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (id, slug)
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    username VARCHAR(80) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED')),
    password_state VARCHAR(20) NOT NULL CHECK (password_state IN ('READY', 'MUST_CHANGE')),
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, username),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE platform_users (
    id UUID PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED')),
    password_state VARCHAR(20) NOT NULL CHECK (password_state IN ('READY', 'MUST_CHANGE')),
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE platform_user_roles (
    user_id UUID NOT NULL,
    role_code VARCHAR(40) NOT NULL CHECK (role_code = 'SUPER_ADMIN'),
    PRIMARY KEY (user_id, role_code),
    CONSTRAINT fk_platform_roles_user FOREIGN KEY (user_id) REFERENCES platform_users(id)
);

CREATE TABLE user_roles (
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role_code VARCHAR(40) NOT NULL CHECK (role_code IN
        ('SUPER_ADMIN', 'ADMIN', 'ACADEMIC_MANAGER', 'ACCOUNTANT', 'TEACHER', 'STUDENT')),
    PRIMARY KEY (tenant_id, user_id, role_code),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE TABLE teacher_profiles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    code VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, user_id),
    UNIQUE (tenant_id, code),
    CONSTRAINT fk_teacher_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE TABLE student_profiles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    code VARCHAR(40) NOT NULL,
    parent_name VARCHAR(200),
    parent_phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, user_id),
    UNIQUE (tenant_id, code),
    CONSTRAINT fk_student_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    CONSTRAINT fk_rooms_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE tenant_holidays (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CHECK (end_date >= start_date),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_holidays_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE classes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    primary_teacher_id UUID NOT NULL,
    start_date DATE NOT NULL,
    total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
    tuition_amount NUMERIC(19,2) NOT NULL CHECK (tuition_amount > 0),
    capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
    default_mode VARCHAR(20) NOT NULL CHECK (default_mode IN ('IN_PERSON', 'ONLINE')),
    status VARCHAR(30) NOT NULL CHECK (status IN
        ('DRAFT', 'SCHEDULED', 'ACTIVE', 'AWAITING_CLOSE', 'CLOSED', 'CANCELLED')),
    draft_student_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    draft_overrides JSONB NOT NULL DEFAULT '[]'::jsonb,
    expected_end_date DATE,
    published_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, code),
    CONSTRAINT fk_classes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_classes_teacher FOREIGN KEY (tenant_id, primary_teacher_id)
        REFERENCES teacher_profiles(tenant_id, id),
    CONSTRAINT fk_classes_creator FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_classes_updater FOREIGN KEY (tenant_id, updated_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE class_hourly_rates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    effective_date DATE NOT NULL,
    hourly_rate NUMERIC(19,2) NOT NULL CHECK (hourly_rate > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, class_id, effective_date),
    CONSTRAINT fk_rates_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id)
);

CREATE TABLE class_schedule_patterns (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    client_key VARCHAR(120) NOT NULL,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('IN_PERSON', 'ONLINE')),
    room_id UUID,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CHECK (end_time > start_time),
    CHECK ((mode = 'IN_PERSON' AND room_id IS NOT NULL) OR (mode = 'ONLINE' AND room_id IS NULL)),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, class_id, client_key),
    CONSTRAINT fk_patterns_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_patterns_room FOREIGN KEY (tenant_id, room_id) REFERENCES rooms(tenant_id, id)
);

CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    student_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'REMOVED')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, class_id, student_id),
    CONSTRAINT fk_enrollments_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_enrollments_student FOREIGN KEY (tenant_id, student_id)
        REFERENCES student_profiles(tenant_id, id)
);

CREATE TABLE class_sessions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal > 0),
    pattern_key VARCHAR(120) NOT NULL,
    session_key VARCHAR(160) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    planned_teacher_id UUID NOT NULL,
    actual_teacher_id UUID NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('IN_PERSON', 'ONLINE')),
    room_id UUID,
    online_link TEXT,
    status VARCHAR(30) NOT NULL CHECK (status IN
        ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENDING_CONFIRMATION')),
    is_substitution BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (end_at > start_at),
    CHECK ((mode = 'IN_PERSON' AND room_id IS NOT NULL) OR (mode = 'ONLINE' AND room_id IS NULL)),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, class_id, ordinal),
    UNIQUE (tenant_id, class_id, session_key),
    CONSTRAINT fk_sessions_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_sessions_planned_teacher FOREIGN KEY (tenant_id, planned_teacher_id)
        REFERENCES teacher_profiles(tenant_id, id),
    CONSTRAINT fk_sessions_actual_teacher FOREIGN KEY (tenant_id, actual_teacher_id)
        REFERENCES teacher_profiles(tenant_id, id),
    CONSTRAINT fk_sessions_room FOREIGN KEY (tenant_id, room_id) REFERENCES rooms(tenant_id, id)
);

CREATE TABLE tuition_charges (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    student_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    amount NUMERIC(19,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, class_id, student_id),
    CONSTRAINT fk_tuition_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_tuition_student FOREIGN KEY (tenant_id, student_id)
        REFERENCES student_profiles(tenant_id, id),
    CONSTRAINT fk_tuition_enrollment FOREIGN KEY (tenant_id, enrollment_id)
        REFERENCES class_enrollments(tenant_id, id)
);

CREATE TABLE schedule_previews (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    class_id UUID,
    session_id UUID,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('CLASS', 'SESSION')),
    input_hash VARCHAR(64) NOT NULL,
    input_version VARCHAR(100) NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_previews_owner FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_previews_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_previews_session FOREIGN KEY (tenant_id, session_id) REFERENCES class_sessions(tenant_id, id)
);

CREATE TABLE idempotency_records (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    operation VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(150) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INTEGER NOT NULL,
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, operation, idempotency_key),
    CONSTRAINT fk_idempotency_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    trace_id VARCHAR(80),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (tenant_id, actor_user_id) REFERENCES users(tenant_id, id)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    recipient_user_id UUID NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    title VARCHAR(250) NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_notification_user FOREIGN KEY (tenant_id, recipient_user_id)
        REFERENCES users(tenant_id, id)
);

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_outbox_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_users_tenant_status ON users (tenant_id, status);
CREATE INDEX idx_students_tenant_code ON student_profiles (tenant_id, code);
CREATE INDEX idx_classes_tenant_status ON classes (tenant_id, status);
CREATE INDEX idx_classes_tenant_teacher ON classes (tenant_id, primary_teacher_id);
CREATE INDEX idx_patterns_class ON class_schedule_patterns (tenant_id, class_id, sort_order);
CREATE INDEX idx_sessions_teacher_time ON class_sessions (tenant_id, actual_teacher_id, start_at, end_at)
    WHERE status <> 'CANCELLED';
CREATE INDEX idx_sessions_room_time ON class_sessions (tenant_id, room_id, start_at, end_at)
    WHERE status <> 'CANCELLED' AND room_id IS NOT NULL;
CREATE INDEX idx_sessions_class ON class_sessions (tenant_id, class_id, ordinal);
CREATE INDEX idx_enrollments_student ON class_enrollments (tenant_id, student_id, status);
CREATE INDEX idx_preview_expiry ON schedule_previews (tenant_id, expires_at);
CREATE INDEX idx_outbox_pending ON outbox_events (occurred_at) WHERE published_at IS NULL;
