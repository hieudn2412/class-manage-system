package com.classops.backend.dashboard;

import java.time.LocalDate;
import java.util.List;

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
}
