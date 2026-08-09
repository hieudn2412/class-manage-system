ALTER TABLE class_hourly_rates
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN created_by UUID,
    ADD COLUMN updated_by UUID;

UPDATE class_hourly_rates rate
SET created_by = classes.created_by,
    updated_by = classes.updated_by
FROM classes
WHERE classes.tenant_id = rate.tenant_id
  AND classes.id = rate.class_id;

ALTER TABLE class_hourly_rates
    ALTER COLUMN created_by SET NOT NULL,
    ALTER COLUMN updated_by SET NOT NULL,
    ADD CONSTRAINT fk_hourly_rate_creator FOREIGN KEY (tenant_id, created_by)
        REFERENCES users(tenant_id, id),
    ADD CONSTRAINT fk_hourly_rate_updater FOREIGN KEY (tenant_id, updated_by)
        REFERENCES users(tenant_id, id);

ALTER TABLE salary_accruals
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD CONSTRAINT chk_salary_accrual_status CHECK (status IN ('ACTIVE', 'REVERSED'));

CREATE TABLE salary_adjustments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    salary_month DATE NOT NULL,
    amount NUMERIC(19,2) NOT NULL CHECK (amount <> 0),
    reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (salary_month = date_trunc('month', salary_month)::date),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_salary_adjustment_teacher FOREIGN KEY (tenant_id, teacher_id)
        REFERENCES teacher_profiles(tenant_id, id),
    CONSTRAINT fk_salary_adjustment_creator FOREIGN KEY (tenant_id, created_by)
        REFERENCES users(tenant_id, id),
    CONSTRAINT fk_salary_adjustment_updater FOREIGN KEY (tenant_id, updated_by)
        REFERENCES users(tenant_id, id)
);

CREATE TABLE salary_payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    salary_month DATE NOT NULL,
    paid_at DATE NOT NULL,
    amount NUMERIC(19,2) NOT NULL CHECK (amount > 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER')),
    reference VARCHAR(250),
    overpayment_reason TEXT,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    CHECK (salary_month = date_trunc('month', salary_month)::date),
    CHECK (method <> 'BANK_TRANSFER' OR length(trim(reference)) > 0),
    UNIQUE (tenant_id, id),
    CONSTRAINT fk_salary_payment_teacher FOREIGN KEY (tenant_id, teacher_id)
        REFERENCES teacher_profiles(tenant_id, id),
    CONSTRAINT fk_salary_payment_creator FOREIGN KEY (tenant_id, created_by)
        REFERENCES users(tenant_id, id),
    CONSTRAINT fk_salary_payment_updater FOREIGN KEY (tenant_id, updated_by)
        REFERENCES users(tenant_id, id)
);

CREATE INDEX idx_hourly_rates_effective
    ON class_hourly_rates (tenant_id, class_id, effective_date);
CREATE INDEX idx_salary_accrual_teacher_status
    ON salary_accruals (tenant_id, teacher_id, status);
CREATE INDEX idx_salary_adjustment_teacher_month
    ON salary_adjustments (tenant_id, teacher_id, salary_month);
CREATE INDEX idx_salary_payment_teacher_month
    ON salary_payments (tenant_id, teacher_id, salary_month);
CREATE INDEX idx_salary_payment_cash_date
    ON salary_payments (tenant_id, paid_at);
