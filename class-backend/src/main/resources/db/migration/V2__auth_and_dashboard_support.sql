ALTER TABLE users
    ADD COLUMN email VARCHAR(320);

CREATE UNIQUE INDEX uq_users_tenant_email
    ON users (tenant_id, lower(email))
    WHERE email IS NOT NULL;

CREATE TABLE login_attempts (
    tenant_id UUID NOT NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('ACCOUNT', 'IP')),
    subject_hash VARCHAR(64) NOT NULL,
    failed_count INTEGER NOT NULL CHECK (failed_count > 0),
    last_failed_at TIMESTAMPTZ NOT NULL,
    blocked_until TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, scope, subject_hash),
    CONSTRAINT fk_login_attempts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_login_attempts_blocked
    ON login_attempts (tenant_id, blocked_until)
    WHERE blocked_until IS NOT NULL;

CREATE TABLE password_reset_requests (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID,
    requested_username VARCHAR(80) NOT NULL,
    request_ip_hash VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('RECEIVED', 'QUEUED_FOR_EMAIL')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_password_reset_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (tenant_id, user_id)
        REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_password_reset_requests_tenant_time
    ON password_reset_requests (tenant_id, requested_at DESC);
