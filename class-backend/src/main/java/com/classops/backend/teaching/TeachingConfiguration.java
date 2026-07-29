package com.classops.backend.teaching;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class TeachingConfiguration {
    @Bean
    Clock businessClock() {
        return Clock.systemUTC();
    }
}
