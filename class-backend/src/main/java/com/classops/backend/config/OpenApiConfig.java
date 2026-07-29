package com.classops.backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI classApi() {
        return new OpenAPI()
            .info(new Info()
                .title("Class Operations API")
                .version("v1")
                .description("""
                    Multi-tenant API for class scheduling. Tenant scope is always derived from the
                    authenticated JWT; `X-Tenant-Slug` is accepted only during the legacy-compatible
                    login call. Scheduling APIs intentionally do not accept an online meeting URL:
                    teachers will set it in the future check-in workflow (DEC-046).
                    """)
                .license(new License().name("Proprietary")))
            .servers(List.of(new Server().url("/").description("Current host")))
            .components(new Components().addSecuritySchemes("bearerAuth",
                new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")));
    }
}
