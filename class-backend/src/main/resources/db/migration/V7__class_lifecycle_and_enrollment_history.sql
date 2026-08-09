-- FL-06: enrollment periods use [effective_from, effective_to) semantics.
ALTER TABLE class_enrollments
    DROP CONSTRAINT class_enrollments_status_check;

UPDATE class_enrollments
SET status = CASE WHEN status = 'REMOVED' THEN 'LEFT' ELSE status END,
    effective_to = CASE WHEN effective_to IS NULL THEN NULL ELSE effective_to + 1 END;

ALTER TABLE class_enrollments
    ADD COLUMN end_reason TEXT,
    ADD COLUMN created_by UUID,
    ADD COLUMN ended_by UUID;

UPDATE class_enrollments enrollment
SET created_by = class_record.created_by
FROM classes class_record
WHERE class_record.tenant_id = enrollment.tenant_id
  AND class_record.id = enrollment.class_id;

ALTER TABLE class_enrollments
    ALTER COLUMN created_by SET NOT NULL,
    ADD CONSTRAINT chk_class_enrollment_status
        CHECK (status IN ('ACTIVE', 'LEFT', 'TRANSFERRED')),
    ADD CONSTRAINT chk_class_enrollment_period
        CHECK (effective_to IS NULL OR effective_to >= effective_from),
    ADD CONSTRAINT fk_class_enrollment_creator
        FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id),
    ADD CONSTRAINT fk_class_enrollment_ender
        FOREIGN KEY (tenant_id, ended_by) REFERENCES users(tenant_id, id);

ALTER TABLE class_enrollments
    DROP CONSTRAINT class_enrollments_tenant_id_class_id_student_id_key;

CREATE UNIQUE INDEX uq_class_enrollment_active_student
    ON class_enrollments (tenant_id, class_id, student_id)
    WHERE status = 'ACTIVE';

CREATE INDEX idx_class_enrollment_history
    ON class_enrollments (tenant_id, class_id, status, effective_from DESC);

ALTER TABLE tuition_charges
    DROP CONSTRAINT tuition_charges_tenant_id_class_id_student_id_key;

ALTER TABLE tuition_charges
    ADD CONSTRAINT uq_tuition_charge_enrollment UNIQUE (tenant_id, enrollment_id);
