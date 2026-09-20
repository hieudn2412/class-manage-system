package com.classops.backend.scheduling;

import com.classops.backend.scheduling.SchedulingDtos.ScheduleState;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Component
class ScheduleStateResolver {
    private final Clock clock;

    ScheduleStateResolver(Clock clock) {
        this.clock = clock;
    }

    ScheduleState resolve(OffsetDateTime startAt, String status, boolean checkedIn) {
        if ("CANCELLED".equals(status)) {
            return ScheduleState.CANCELLED;
        }
        if ("COMPLETED".equals(status)) {
            return ScheduleState.TAUGHT;
        }
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (now.isBefore(startAt)) {
            return ScheduleState.UPCOMING;
        }
        return checkedIn ? ScheduleState.TAUGHT : ScheduleState.MISSING_CHECK_IN;
    }
}
