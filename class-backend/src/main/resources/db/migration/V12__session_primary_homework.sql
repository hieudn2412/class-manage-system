ALTER TABLE homeworks
    ADD COLUMN is_session_primary BOOLEAN NOT NULL DEFAULT false;

WITH ranked AS (
    SELECT id,
           tenant_id,
           session_id,
           row_number() OVER (
               PARTITION BY tenant_id, session_id
               ORDER BY created_at DESC, updated_at DESC, id DESC
           ) AS rn
    FROM homeworks
    WHERE session_id IS NOT NULL
)
UPDATE homeworks h
SET is_session_primary = ranked.rn = 1,
    status = CASE WHEN ranked.rn = 1 THEN h.status ELSE 'CLOSED' END,
    closed_at = CASE
        WHEN ranked.rn = 1 THEN h.closed_at
        ELSE COALESCE(h.closed_at, now())
    END,
    updated_at = CASE WHEN ranked.rn = 1 THEN h.updated_at ELSE now() END,
    version = CASE WHEN ranked.rn = 1 THEN h.version ELSE h.version + 1 END
FROM ranked
WHERE h.tenant_id = ranked.tenant_id
  AND h.id = ranked.id;

CREATE UNIQUE INDEX uq_homeworks_session_primary
    ON homeworks (tenant_id, session_id)
    WHERE session_id IS NOT NULL AND is_session_primary;
