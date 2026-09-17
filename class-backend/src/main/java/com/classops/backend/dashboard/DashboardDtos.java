package com.classops.backend.dashboard;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class DashboardDtos {
    private DashboardDtos() {
    }

    public record DashboardKpi(
        String id,
        String label,
        String value,
        String detail,
        String delta
    ) {
    }

    public record AttentionItem(
        String id,
        String title,
        String detail,
        String actionLabel,
        String severity,
        String targetSessionId
    ) {
    }

    public record ClassStateMetric(
        String status,
        String label,
        long count
    ) {
    }

    public record DashboardData(
        LocalDate date,
        String greetingName,
        List<DashboardKpi> kpis,
        List<AttentionItem> attentionItems,
        List<ClassStateMetric> classStates
    ) {
    }

    public record PendingConfirmationItem(
        UUID id,
        UUID classId,
        String classCode,
        String className,
        int ordinal,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        UUID teacherId,
        String teacherName,
        String mode,
        String roomName
    ) {
    }
}
