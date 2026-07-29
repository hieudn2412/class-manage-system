package com.classops.backend.scheduling;

import com.classops.backend.scheduling.SchedulingDtos.ClassDraftInput;
import com.classops.backend.scheduling.SchedulingDtos.DeliveryMode;
import com.classops.backend.scheduling.SchedulingDtos.ExistingSessionSummary;
import com.classops.backend.scheduling.SchedulingDtos.WeeklyPattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SchedulingEngineTest {
    private static final UUID TEACHER = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID ROOM = UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final UUID STUDENT = UUID.fromString("30000000-0000-0000-0000-000000000001");
    private SchedulingEngine engine;

    @BeforeEach
    void setUp() {
        engine = new SchedulingEngine(new SchedulingProperties(
            ZoneId.of("Asia/Ho_Chi_Minh"), Duration.ofMinutes(15), 3660));
    }

    @Test
    void generatesMultipleWeeklyPatternsInStableOrderUntilTotalReached() {
        ClassDraftInput input = input(5, List.of(
            pattern("wed", 3, "19:00", "20:30", ROOM),
            pattern("mon", 1, "18:00", "19:30", ROOM)));

        SchedulingEngine.GenerationResult result = engine.generate(
            input, "Cô Lan", Map.of(ROOM, "P101"), List.of(), List.of());

        assertThat(result.sessions()).hasSize(5);
        assertThat(result.sessions()).extracting(item -> item.startAt().toLocalDate())
            .containsExactly(
                LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 5),
                LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 12),
                LocalDate.of(2026, 8, 17));
        assertThat(result.sessions()).extracting(SchedulingDtos.PreviewSession::ordinal)
            .containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void skipsHolidayWithoutConsumingOrdinalAndExtendsEndDate() {
        ClassDraftInput input = input(3, List.of(pattern("mon", 1, "18:00", "19:30", ROOM)));
        SchedulingEngine.Holiday holiday = new SchedulingEngine.Holiday(
            UUID.randomUUID(), "Nghỉ trung tâm",
            LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 10));

        SchedulingEngine.GenerationResult result = engine.generate(
            input, "Cô Lan", Map.of(ROOM, "P101"), List.of(holiday), List.of());

        assertThat(result.skippedHolidays()).hasSize(1);
        assertThat(result.sessions()).extracting(item -> item.startAt().toLocalDate())
            .containsExactly(LocalDate.of(2026, 8, 3),
                LocalDate.of(2026, 8, 17), LocalDate.of(2026, 8, 24));
        assertThat(result.expectedEndDate()).isEqualTo(LocalDate.of(2026, 8, 24));
    }

    @Test
    void detectsTeacherRoomBlockersAndStudentWarning() {
        ClassDraftInput input = input(1, List.of(pattern("mon", 1, "18:00", "19:30", ROOM)));
        OffsetDateTime start = OffsetDateTime.parse("2026-08-03T18:30:00+07:00");
        OffsetDateTime end = OffsetDateTime.parse("2026-08-03T20:00:00+07:00");
        ExistingSessionSummary summary = new ExistingSessionSummary(
            UUID.randomUUID(), "CLS-OLD", "Lớp đang chạy", start, end, "Cô Lan", "P101");
        SchedulingEngine.OccupiedSession occupied = new SchedulingEngine.OccupiedSession(
            TEACHER, ROOM, DeliveryMode.IN_PERSON, start, end, summary,
            Map.of(STUDENT, "Lê Minh Anh"));

        SchedulingEngine.GenerationResult result = engine.generate(
            input, "Cô Lan", Map.of(ROOM, "P101"), List.of(), List.of(occupied));

        assertThat(result.conflicts()).extracting(SchedulingDtos.ScheduleConflict::code)
            .containsExactlyInAnyOrder("TEACHER_OVERLAP", "ROOM_OVERLAP", "STUDENT_OVERLAP");
        assertThat(result.conflicts().stream()
            .filter(item -> item.code().equals("STUDENT_OVERLAP")).findFirst().orElseThrow()
            .studentNames()).containsExactly("Lê Minh Anh");
    }

    @Test
    void adjacentHalfOpenIntervalsDoNotConflictAndOnlineDoesNotUseRoom() {
        ClassDraftInput input = new ClassDraftInput(
            "Lớp", "", TEACHER, LocalDate.of(2026, 8, 3), 1,
            new BigDecimal("1000000"), new BigDecimal("200000"), null,
            DeliveryMode.ONLINE, List.of(STUDENT),
            List.of(new WeeklyPattern("mon", 1, LocalTime.of(18, 0), LocalTime.of(19, 0),
                DeliveryMode.ONLINE, null)), List.of());
        OffsetDateTime start = OffsetDateTime.parse("2026-08-03T19:00:00+07:00");
        OffsetDateTime end = OffsetDateTime.parse("2026-08-03T20:00:00+07:00");
        ExistingSessionSummary summary = new ExistingSessionSummary(
            UUID.randomUUID(), "CLS-OLD", "Lớp khác", start, end, "Cô Lan", null);
        SchedulingEngine.OccupiedSession occupied = new SchedulingEngine.OccupiedSession(
            TEACHER, null, DeliveryMode.ONLINE, start, end, summary, Map.of(STUDENT, "Minh Anh"));

        SchedulingEngine.GenerationResult result = engine.generate(
            input, "Cô Lan", Map.of(), List.of(), List.of(occupied));

        assertThat(result.conflicts()).isEmpty();
    }

    private ClassDraftInput input(int total, List<WeeklyPattern> patterns) {
        return new ClassDraftInput(
            "Lớp thử nghiệm", "", TEACHER, LocalDate.of(2026, 8, 3), total,
            new BigDecimal("1000000"), new BigDecimal("200000"), 20,
            DeliveryMode.IN_PERSON, List.of(STUDENT), patterns, List.of());
    }

    private WeeklyPattern pattern(String id, int weekday, String start, String end, UUID room) {
        return new WeeklyPattern(id, weekday, LocalTime.parse(start), LocalTime.parse(end),
            DeliveryMode.IN_PERSON, room);
    }
}
