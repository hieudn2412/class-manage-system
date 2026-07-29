ALTER TABLE class_sessions
    ADD COLUMN completed_at TIMESTAMPTZ,
    ADD COLUMN completion_source VARCHAR(30),
    ADD COLUMN roster_frozen_at TIMESTAMPTZ,
    ADD COLUMN missing_documentation BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT chk_session_completion_source CHECK (
        completion_source IS NULL
        OR completion_source IN ('AUTO_CHECK_IN', 'MANAGER_CONFIRMED')
    );

ALTER TABLE idempotency_records
    ALTER COLUMN operation TYPE VARCHAR(200);

ALTER TABLE audit_events
    ALTER COLUMN actor_user_id DROP NOT NULL,
    ADD COLUMN actor_type VARCHAR(20) NOT NULL DEFAULT 'USER',
    ADD CONSTRAINT chk_audit_actor_type CHECK (actor_type IN ('USER', 'SYSTEM'));

CREATE TABLE class_teacher_assignments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, class_id, teacher_id, effective_from),
    CONSTRAINT fk_teacher_assignments_class FOREIGN KEY (tenant_id, class_id)
        REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_teacher_assignments_teacher FOREIGN KEY (tenant_id, teacher_id)
        REFERENCES teacher_profiles(tenant_id, id)
);

INSERT INTO class_teacher_assignments (
    id, tenant_id, class_id, teacher_id, effective_from
)
SELECT gen_random_uuid(), tenant_id, id, primary_teacher_id, start_date
FROM classes
WHERE status <> 'DRAFT';

CREATE TABLE session_check_ins (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    checked_in_at TIMESTAMPTZ NOT NULL,
    ip_address VARCHAR(80) NOT NULL,
    device_info TEXT NOT NULL,
    idempotency_key VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, session_id),
    UNIQUE (tenant_id, session_id, idempotency_key),
    CONSTRAINT fk_check_ins_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_check_ins_teacher FOREIGN KEY (tenant_id, teacher_id)
        REFERENCES teacher_profiles(tenant_id, id)
);

CREATE TABLE session_roster_members (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    frozen_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, session_id, student_id),
    CONSTRAINT fk_roster_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_roster_student FOREIGN KEY (tenant_id, student_id)
        REFERENCES student_profiles(tenant_id, id),
    CONSTRAINT fk_roster_enrollment FOREIGN KEY (tenant_id, enrollment_id)
        REFERENCES class_enrollments(tenant_id, id)
);

CREATE TABLE session_attendances (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'PRESENT', 'LATE', 'LEFT_EARLY', 'ABSENT_EXCUSED', 'ABSENT_UNEXCUSED'
    )),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, session_id, student_id),
    CONSTRAINT fk_attendance_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_attendance_student FOREIGN KEY (tenant_id, student_id)
        REFERENCES student_profiles(tenant_id, id)
);

CREATE TABLE session_student_comments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    comment_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, session_id, student_id),
    CONSTRAINT fk_session_comments_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_session_comments_student FOREIGN KEY (tenant_id, student_id)
        REFERENCES student_profiles(tenant_id, id)
);

CREATE TABLE session_lesson_reports (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    lesson_name VARCHAR(250) NOT NULL DEFAULT '',
    lesson_content TEXT NOT NULL DEFAULT '',
    record_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, session_id),
    CONSTRAINT fk_lesson_report_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id)
);

CREATE TABLE session_test_results (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    test_name VARCHAR(250) NOT NULL,
    score NUMERIC(10,2) NOT NULL,
    max_score NUMERIC(10,2) NOT NULL,
    test_date DATE NOT NULL,
    comment_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (max_score > 0),
    CHECK (score >= 0 AND score <= max_score),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_test_result_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_test_result_student FOREIGN KEY (tenant_id, student_id)
        REFERENCES student_profiles(tenant_id, id)
);

CREATE TABLE salary_accruals (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    scheduled_minutes INTEGER NOT NULL CHECK (scheduled_minutes > 0),
    hourly_rate_snapshot NUMERIC(19,2) NOT NULL CHECK (hourly_rate_snapshot > 0),
    amount NUMERIC(19,2) NOT NULL CHECK (amount >= 0),
    revision BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, session_id),
    CONSTRAINT fk_salary_accrual_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_salary_accrual_teacher FOREIGN KEY (tenant_id, teacher_id)
        REFERENCES teacher_profiles(tenant_id, id)
);

CREATE INDEX idx_teacher_assignments_scope
    ON class_teacher_assignments (tenant_id, teacher_id, effective_from, effective_to);
CREATE INDEX idx_check_ins_session
    ON session_check_ins (tenant_id, session_id);
CREATE INDEX idx_roster_session
    ON session_roster_members (tenant_id, session_id);
CREATE INDEX idx_attendance_session
    ON session_attendances (tenant_id, session_id);
CREATE INDEX idx_comments_session
    ON session_student_comments (tenant_id, session_id);
CREATE INDEX idx_test_results_session_student
    ON session_test_results (tenant_id, session_id, student_id);
CREATE INDEX idx_salary_teacher_month
    ON salary_accruals (tenant_id, teacher_id, created_at);
CREATE INDEX idx_session_completion_scan
    ON class_sessions (status, end_at)
    WHERE status IN ('SCHEDULED', 'IN_PROGRESS');
