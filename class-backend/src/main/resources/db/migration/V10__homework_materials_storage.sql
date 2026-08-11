ALTER TABLE outbox_events
    ADD COLUMN event_key VARCHAR(180);

CREATE UNIQUE INDEX uq_outbox_event_key
    ON outbox_events (tenant_id, event_key)
    WHERE event_key IS NOT NULL;

CREATE TABLE tenant_storage_quotas (
    tenant_id UUID PRIMARY KEY,
    quota_bytes BIGINT NOT NULL CHECK (quota_bytes > 0),
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_storage_quota_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_storage_quota_updater FOREIGN KEY (updated_by) REFERENCES platform_users(id)
);

CREATE TABLE stored_files (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('STAGING', 'ACTIVE', 'DELETED')),
    purpose VARCHAR(40) NOT NULL CHECK (purpose IN
        ('HOMEWORK_ATTACHMENT', 'SUBMISSION_IMAGE', 'REVIEW_ATTACHMENT', 'MATERIAL')),
    original_filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    storage_key VARCHAR(700) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    token VARCHAR(120),
    expires_at TIMESTAMPTZ,
    promoted_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_reason TEXT,
    preview_file_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, storage_key),
    UNIQUE (tenant_id, token),
    CONSTRAINT fk_stored_files_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_stored_files_owner FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_stored_files_preview FOREIGN KEY (tenant_id, preview_file_id) REFERENCES stored_files(tenant_id, id),
    CHECK ((status = 'STAGING' AND token IS NOT NULL AND expires_at IS NOT NULL)
        OR (status <> 'STAGING' AND token IS NULL))
);

CREATE INDEX idx_stored_files_usage ON stored_files (tenant_id, status, purpose);
CREATE INDEX idx_stored_files_staging_expiry ON stored_files (tenant_id, expires_at) WHERE status = 'STAGING';

CREATE TABLE file_access_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    file_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('VIEW', 'DOWNLOAD', 'PREVIEW')),
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    ip_address VARCHAR(80),
    user_agent TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_file_access_file FOREIGN KEY (tenant_id, file_id) REFERENCES stored_files(tenant_id, id),
    CONSTRAINT fk_file_access_actor FOREIGN KEY (tenant_id, actor_user_id) REFERENCES users(tenant_id, id)
);

CREATE TABLE homeworks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    session_id UUID,
    title VARCHAR(250) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    deadline_at TIMESTAMPTZ,
    audience_type VARCHAR(20) NOT NULL CHECK (audience_type IN ('CLASS', 'SELECTED')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    reopened_at TIMESTAMPTZ,
    reopen_reason TEXT,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_homeworks_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_homeworks_session FOREIGN KEY (tenant_id, session_id) REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_homeworks_creator FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_homeworks_updater FOREIGN KEY (tenant_id, updated_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE homework_recipients (
    tenant_id UUID NOT NULL,
    homework_id UUID NOT NULL,
    student_id UUID NOT NULL,
    added_by UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at TIMESTAMPTZ,
    removed_by UUID,
    PRIMARY KEY (tenant_id, homework_id, student_id),
    CONSTRAINT fk_homework_recipient_homework FOREIGN KEY (tenant_id, homework_id) REFERENCES homeworks(tenant_id, id),
    CONSTRAINT fk_homework_recipient_student FOREIGN KEY (tenant_id, student_id) REFERENCES student_profiles(tenant_id, id),
    CONSTRAINT fk_homework_recipient_adder FOREIGN KEY (tenant_id, added_by) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_homework_recipient_remover FOREIGN KEY (tenant_id, removed_by) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_homework_recipients_student ON homework_recipients (tenant_id, student_id, removed_at);

CREATE TABLE homework_resources (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    homework_id UUID NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('FILE', 'LINK')),
    file_id UUID,
    url TEXT,
    label VARCHAR(250),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_homework_resource_homework FOREIGN KEY (tenant_id, homework_id) REFERENCES homeworks(tenant_id, id),
    CONSTRAINT fk_homework_resource_file FOREIGN KEY (tenant_id, file_id) REFERENCES stored_files(tenant_id, id),
    CHECK ((kind = 'FILE' AND file_id IS NOT NULL AND url IS NULL)
        OR (kind = 'LINK' AND url IS NOT NULL AND file_id IS NULL))
);

CREATE TABLE homework_submissions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    homework_id UUID NOT NULL,
    student_id UUID NOT NULL,
    attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
    note TEXT NOT NULL DEFAULT '',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_snapshot TIMESTAMPTZ,
    late BOOLEAN NOT NULL DEFAULT false,
    current_attempt BOOLEAN NOT NULL DEFAULT true,
    review_status VARCHAR(30) NOT NULL DEFAULT 'WAITING_REVIEW'
        CHECK (review_status IN ('WAITING_REVIEW', 'REVIEWED', 'REVISION_REQUESTED')),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, homework_id, student_id, attempt_no),
    CONSTRAINT fk_homework_submission_homework FOREIGN KEY (tenant_id, homework_id) REFERENCES homeworks(tenant_id, id),
    CONSTRAINT fk_homework_submission_student FOREIGN KEY (tenant_id, student_id) REFERENCES student_profiles(tenant_id, id)
);

CREATE UNIQUE INDEX uq_homework_current_submission
    ON homework_submissions (tenant_id, homework_id, student_id)
    WHERE current_attempt;

CREATE TABLE homework_submission_files (
    tenant_id UUID NOT NULL,
    submission_id UUID NOT NULL,
    file_id UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, submission_id, file_id),
    CONSTRAINT fk_submission_file_submission FOREIGN KEY (tenant_id, submission_id) REFERENCES homework_submissions(tenant_id, id),
    CONSTRAINT fk_submission_file_file FOREIGN KEY (tenant_id, file_id) REFERENCES stored_files(tenant_id, id)
);

CREATE TABLE homework_reviews (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    homework_id UUID NOT NULL,
    submission_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('REVIEWED', 'REVISION_REQUESTED')),
    comment_text TEXT NOT NULL DEFAULT '',
    reviewed_by UUID NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_homework_review_homework FOREIGN KEY (tenant_id, homework_id) REFERENCES homeworks(tenant_id, id),
    CONSTRAINT fk_homework_review_submission FOREIGN KEY (tenant_id, submission_id) REFERENCES homework_submissions(tenant_id, id),
    CONSTRAINT fk_homework_review_reviewer FOREIGN KEY (tenant_id, reviewed_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE homework_review_files (
    tenant_id UUID NOT NULL,
    review_id UUID NOT NULL,
    file_id UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, review_id, file_id),
    CONSTRAINT fk_review_file_review FOREIGN KEY (tenant_id, review_id) REFERENCES homework_reviews(tenant_id, id),
    CONSTRAINT fk_review_file_file FOREIGN KEY (tenant_id, file_id) REFERENCES stored_files(tenant_id, id)
);

CREATE TABLE materials (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    session_id UUID,
    title VARCHAR(250) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    file_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'REMOVED')),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    removed_by UUID,
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_material_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
    CONSTRAINT fk_material_session FOREIGN KEY (tenant_id, session_id) REFERENCES class_sessions(tenant_id, id),
    CONSTRAINT fk_material_file FOREIGN KEY (tenant_id, file_id) REFERENCES stored_files(tenant_id, id),
    CONSTRAINT fk_material_creator FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_material_updater FOREIGN KEY (tenant_id, updated_by) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_material_remover FOREIGN KEY (tenant_id, removed_by) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_homeworks_class_status ON homeworks (tenant_id, class_id, status, updated_at DESC);
CREATE INDEX idx_homeworks_session ON homeworks (tenant_id, session_id);
CREATE INDEX idx_homework_submissions_current ON homework_submissions (tenant_id, homework_id, current_attempt);
CREATE INDEX idx_materials_class_status ON materials (tenant_id, class_id, status, updated_at DESC);
