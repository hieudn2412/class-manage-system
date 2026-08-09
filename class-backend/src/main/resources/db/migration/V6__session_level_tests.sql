CREATE TABLE session_tests (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    test_name VARCHAR(250) NOT NULL,
    max_score NUMERIC(10,2) NOT NULL,
    test_date DATE NOT NULL,
    comment_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (max_score > 0),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, session_id),
    CONSTRAINT fk_session_tests_session FOREIGN KEY (tenant_id, session_id)
        REFERENCES class_sessions(tenant_id, id)
);

-- Keep the latest legacy test definition for each session. Development data can
-- contain several per-student test names because tests previously lived on scores.
INSERT INTO session_tests (
    id, tenant_id, session_id, test_name, max_score, test_date, comment_text,
    created_at, updated_at
)
SELECT DISTINCT ON (tenant_id, session_id)
       gen_random_uuid(), tenant_id, session_id, test_name, max_score, test_date, '',
       created_at, updated_at
FROM session_test_results
ORDER BY tenant_id, session_id, created_at DESC, id DESC;

ALTER TABLE session_test_results
    ADD COLUMN session_test_id UUID;

UPDATE session_test_results result
SET session_test_id = test.id,
    test_name = test.test_name,
    max_score = test.max_score,
    test_date = test.test_date
FROM session_tests test
WHERE test.tenant_id = result.tenant_id
  AND test.session_id = result.session_id;

-- One score row per student remains when legacy data had more than one test.
DELETE FROM session_test_results duplicate
USING session_test_results keeper
WHERE duplicate.tenant_id = keeper.tenant_id
  AND duplicate.session_id = keeper.session_id
  AND duplicate.student_id = keeper.student_id
  AND (duplicate.updated_at, duplicate.id) < (keeper.updated_at, keeper.id);

ALTER TABLE session_test_results
    ALTER COLUMN session_test_id SET NOT NULL,
    ALTER COLUMN score DROP NOT NULL,
    ADD CONSTRAINT fk_test_result_test FOREIGN KEY (tenant_id, session_test_id)
        REFERENCES session_tests(tenant_id, id),
    ADD CONSTRAINT uq_test_result_student
        UNIQUE (tenant_id, session_test_id, student_id);

