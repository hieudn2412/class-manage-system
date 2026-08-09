ALTER TABLE class_sessions
    ADD COLUMN makeup_root_session_id UUID,
    ADD COLUMN replaces_session_id UUID,
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancelled_by UUID,
    ADD COLUMN cancellation_reason TEXT,
    ADD COLUMN substitution_note TEXT,
    ADD CONSTRAINT fk_sessions_makeup_root FOREIGN KEY (tenant_id, makeup_root_session_id)
        REFERENCES class_sessions(tenant_id, id),
    ADD CONSTRAINT fk_sessions_replaces FOREIGN KEY (tenant_id, replaces_session_id)
        REFERENCES class_sessions(tenant_id, id),
    ADD CONSTRAINT fk_sessions_cancelled_by FOREIGN KEY (tenant_id, cancelled_by)
        REFERENCES users(tenant_id, id),
    ADD CONSTRAINT chk_session_makeup_root_not_self CHECK (
        makeup_root_session_id IS NULL OR makeup_root_session_id <> id
    ),
    ADD CONSTRAINT chk_session_replaces_not_self CHECK (
        replaces_session_id IS NULL OR replaces_session_id <> id
    );

UPDATE class_sessions
SET cancelled_at = COALESCE(cancelled_at, updated_at),
    cancellation_reason = COALESCE(cancellation_reason, 'Đã hủy trước FL-07')
WHERE status = 'CANCELLED';

ALTER TABLE class_sessions
    ADD CONSTRAINT chk_session_cancellation_metadata CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
        OR (status <> 'CANCELLED' AND cancelled_at IS NULL AND cancellation_reason IS NULL)
    );

ALTER TABLE class_sessions
    DROP CONSTRAINT class_sessions_tenant_id_class_id_ordinal_key;

CREATE UNIQUE INDEX uq_class_sessions_base_ordinal
    ON class_sessions (tenant_id, class_id, ordinal)
    WHERE replaces_session_id IS NULL;

CREATE UNIQUE INDEX uq_class_sessions_replacement
    ON class_sessions (tenant_id, replaces_session_id)
    WHERE replaces_session_id IS NOT NULL;

CREATE INDEX idx_sessions_makeup_root
    ON class_sessions (tenant_id, makeup_root_session_id);
