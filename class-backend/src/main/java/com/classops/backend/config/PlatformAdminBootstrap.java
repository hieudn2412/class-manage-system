package com.classops.backend.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Component
@Profile({"dev", "prod"})
public class PlatformAdminBootstrap implements ApplicationRunner {
    private static final UUID USER_ID =
        UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final JdbcClient jdbc;
    private final PasswordEncoder passwords;
    private final SeedProperties seed;

    public PlatformAdminBootstrap(JdbcClient jdbc, PasswordEncoder passwords, SeedProperties seed) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.seed = seed;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        jdbc.sql("""
                INSERT INTO platform_users (
                  id, username, display_name, password_hash, status, password_state,
                  singleton_slot
                ) VALUES (
                  :id, :username, 'Super Admin', :password, 'ACTIVE', 'READY', 1
                )
                ON CONFLICT (singleton_slot) DO NOTHING
                """)
            .param("id", USER_ID)
            .param("username", seed.admin().username())
            .param("password", passwords.encode(seed.admin().password()))
            .update();

        UUID platformUserId = jdbc.sql("SELECT id FROM platform_users WHERE singleton_slot=1")
            .query(UUID.class).single();
        jdbc.sql("""
                INSERT INTO platform_user_roles (user_id, role_code)
                VALUES (:userId, 'SUPER_ADMIN')
                ON CONFLICT (user_id, role_code) DO NOTHING
                """)
            .param("userId", platformUserId)
            .update();
    }
}
