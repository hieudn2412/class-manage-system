CREATE TABLE tenant_email_connections (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL UNIQUE,
    gmail_address VARCHAR(320),
    google_subject VARCHAR(255),
    status VARCHAR(30) NOT NULL CHECK (status IN ('CONNECTED', 'REAUTH_REQUIRED', 'DISCONNECTED')),
    refresh_token_ciphertext BYTEA,
    refresh_token_iv BYTEA,
    token_key_version INTEGER NOT NULL DEFAULT 1,
    scopes TEXT NOT NULL DEFAULT '',
    connected_by UUID,
    connected_at TIMESTAMPTZ,
    disconnected_by UUID,
    disconnected_at TIMESTAMPTZ,
    last_successful_send_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_code VARCHAR(80),
    last_error_message TEXT,
    last_test_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_tenant_email_connection_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_tenant_email_connection_connector FOREIGN KEY (tenant_id, connected_by) REFERENCES users(tenant_id, id),
    CONSTRAINT fk_tenant_email_connection_disconnector FOREIGN KEY (tenant_id, disconnected_by) REFERENCES users(tenant_id, id),
    CHECK (
        (status = 'DISCONNECTED' AND refresh_token_ciphertext IS NULL AND refresh_token_iv IS NULL)
        OR (status <> 'DISCONNECTED' AND refresh_token_ciphertext IS NOT NULL AND refresh_token_iv IS NOT NULL)
    )
);

CREATE INDEX idx_tenant_email_connections_status
    ON tenant_email_connections (status, updated_at);

CREATE TABLE tenant_gmail_oauth_states (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    state_hash VARCHAR(64) NOT NULL UNIQUE,
    pkce_verifier_ciphertext BYTEA NOT NULL,
    pkce_verifier_iv BYTEA NOT NULL,
    expected_connection_version BIGINT NOT NULL,
    initiated_by UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_tenant_gmail_state_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_tenant_gmail_state_user FOREIGN KEY (tenant_id, initiated_by) REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_tenant_gmail_oauth_states_expiry
    ON tenant_gmail_oauth_states (tenant_id, expires_at);

ALTER TABLE outbox_events
    ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN expires_at TIMESTAMPTZ,
    ADD COLUMN dead_lettered_at TIMESTAMPTZ,
    ADD COLUMN lease_owner UUID,
    ADD COLUMN lease_until TIMESTAMPTZ,
    ADD COLUMN error_code VARCHAR(80),
    ADD COLUMN gmail_message_id VARCHAR(200);

UPDATE outbox_events
SET expires_at = occurred_at + interval '72 hours'
WHERE event_type = 'EMAIL_NOTIFICATION'
  AND published_at IS NULL
  AND expires_at IS NULL;

UPDATE outbox_events
SET dead_lettered_at = now(),
    error_code = 'GMAIL_EXPIRED',
    last_error = 'Tenant email notification expired before Gmail connection delivery'
WHERE event_type = 'EMAIL_NOTIFICATION'
  AND published_at IS NULL
  AND dead_lettered_at IS NULL
  AND expires_at <= now();

CREATE INDEX idx_outbox_email_delivery
    ON outbox_events (tenant_id, next_attempt_at, occurred_at)
    WHERE event_type = 'EMAIL_NOTIFICATION'
      AND published_at IS NULL
      AND dead_lettered_at IS NULL;
