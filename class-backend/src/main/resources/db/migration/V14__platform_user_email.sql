ALTER TABLE platform_users
    ADD COLUMN email VARCHAR(320);

CREATE UNIQUE INDEX uq_platform_users_email_ci
    ON platform_users (lower(email))
    WHERE email IS NOT NULL;
