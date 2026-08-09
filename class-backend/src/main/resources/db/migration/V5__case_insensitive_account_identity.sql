CREATE UNIQUE INDEX uq_platform_users_username_ci ON platform_users (lower(username));
CREATE UNIQUE INDEX uq_users_tenant_username_ci ON users (tenant_id, lower(username));
