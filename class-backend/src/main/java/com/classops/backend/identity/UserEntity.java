package com.classops.backend.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity {
    @Id
    private UUID id;
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;
    @Column(nullable = false)
    private String username;
    @Column(name = "display_name", nullable = false)
    private String displayName;
    @Column
    private String email;
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    @Column(nullable = false)
    private String status;
    @Column(name = "password_state", nullable = false)
    private String passwordState;
    @Column(name = "token_version", nullable = false)
    private int tokenVersion;
    @Version
    private long version;

    protected UserEntity() {
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getUsername() {
        return username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getStatus() {
        return status;
    }

    public String getPasswordState() {
        return passwordState;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }
}
