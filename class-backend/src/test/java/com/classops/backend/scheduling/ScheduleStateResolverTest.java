package com.classops.backend.scheduling;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static com.classops.backend.scheduling.SchedulingDtos.ScheduleState.MISSING_CHECK_IN;
import static com.classops.backend.scheduling.SchedulingDtos.ScheduleState.TAUGHT;
import static com.classops.backend.scheduling.SchedulingDtos.ScheduleState.UPCOMING;
import static org.assertj.core.api.Assertions.assertThat;

class ScheduleStateResolverTest {
    private static final Instant NOW = Instant.parse("2026-08-04T12:00:00Z");
    private final ScheduleStateResolver resolver =
        new ScheduleStateResolver(Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void keepsFutureSessionUpcomingEvenWhenTeacherCheckedInEarly() {
        assertThat(resolver.resolve(
            OffsetDateTime.parse("2026-08-04T19:30:00+07:00"), "IN_PROGRESS", true))
            .isEqualTo(UPCOMING);
    }

    @Test
    void marksStartedCheckedInSessionAsTaught() {
        assertThat(resolver.resolve(
            OffsetDateTime.parse("2026-08-04T18:30:00+07:00"), "IN_PROGRESS", true))
            .isEqualTo(TAUGHT);
    }

    @Test
    void marksStartedSessionWithoutCheckInAsMissing() {
        assertThat(resolver.resolve(
            OffsetDateTime.parse("2026-08-04T18:30:00+07:00"), "PENDING_CONFIRMATION", false))
            .isEqualTo(MISSING_CHECK_IN);
    }

    @Test
    void marksManagerConfirmedSessionAsTaughtWithoutTeacherCheckIn() {
        assertThat(resolver.resolve(
            OffsetDateTime.parse("2026-08-04T18:30:00+07:00"), "COMPLETED", false))
            .isEqualTo(TAUGHT);
    }
}
