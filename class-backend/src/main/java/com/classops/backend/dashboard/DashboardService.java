package com.classops.backend.dashboard;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.dashboard.DashboardDtos.AttentionItem;
import com.classops.backend.dashboard.DashboardDtos.ClassStateMetric;
import com.classops.backend.dashboard.DashboardDtos.DashboardData;
import com.classops.backend.dashboard.DashboardDtos.DashboardKpi;
import com.classops.backend.dashboard.DashboardDtos.PendingConfirmationItem;
import com.classops.backend.security.CurrentActor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DashboardService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter SHORT_DATE_TIME =
        DateTimeFormatter.ofPattern("dd/MM · HH:mm");

    private final JdbcClient jdbc;
    private final CurrentActor actor;

    public DashboardService(JdbcClient jdbc, CurrentActor actor) {
        this.jdbc = jdbc;
        this.actor = actor;
    }

    @Transactional(readOnly = true)
    public DashboardData dashboard() {
        UUID tenantId = actor.tenantId();
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        OffsetDateTime start = today.atStartOfDay(BUSINESS_ZONE).toOffsetDateTime();
        OffsetDateTime end = today.plusDays(1).atStartOfDay(BUSINESS_ZONE).toOffsetDateTime();
        TodayStats todayStats = todayStats(tenantId, start, end);
        long pendingConfirmation = count(tenantId,
            "SELECT count(*) FROM class_sessions WHERE tenant_id=:tenantId "
                + "AND status='PENDING_CONFIRMATION'");
        long missingDocumentation = count(tenantId,
            "SELECT count(*) FROM class_sessions WHERE tenant_id=:tenantId "
                + "AND status='COMPLETED' AND missing_documentation=true");

        List<DashboardKpi> kpis = List.of(
            new DashboardKpi("today", "Lớp có buổi hôm nay",
                String.valueOf(todayStats.classCount()),
                todayStats.sessionCount() + " buổi / " + todayStats.roomCount() + " phòng", null),
            new DashboardKpi("verify", "Chờ xác nhận đã dạy",
                twoDigits(pendingConfirmation), "Chưa xác nhận buổi dạy",
                pendingConfirmation > 0 ? "!" : null),
            new DashboardKpi("missing", "Buổi thiếu hồ sơ", twoDigits(missingDocumentation),
                missingDocumentation + " buổi cần bổ sung điểm danh hoặc bản ghi buổi học",
                missingDocumentation > 0 ? "!" : null),
            new DashboardKpi("attendance", "Chuyên cần tháng", "—",
                "Chưa có dữ liệu điểm danh", null)
        );

        return new DashboardData(today, displayName(tenantId, actor.userId()), kpis,
            attentionItems(tenantId), classStates(tenantId));
    }

    @Transactional(readOnly = true)
    public PageResponse<PendingConfirmationItem> pendingConfirmations(
        String search,
        String mode,
        LocalDate from,
        LocalDate to,
        String sort,
        String direction,
        int page,
        int pageSize
    ) {
        validatePendingConfirmationFilters(mode, from, to, sort, direction, page, pageSize);
        UUID tenantId = actor.tenantId();
        String normalizedSearch = "%" + (search == null ? "" : search.trim().toLowerCase()) + "%";
        String normalizedMode = mode == null || mode.isBlank() ? null : mode.trim().toUpperCase();
        OffsetDateTime fromAt = from == null
            ? null
            : from.atStartOfDay(BUSINESS_ZONE).toOffsetDateTime();
        OffsetDateTime toAt = to == null
            ? null
            : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toOffsetDateTime();

        String filters = """
              FROM class_sessions s
              JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
              JOIN teacher_profiles t
                ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
              JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
              LEFT JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
              WHERE s.tenant_id=:tenantId AND s.status='PENDING_CONFIRMATION'
                AND (
                  lower(c.name) LIKE :search OR lower(c.code) LIKE :search
                  OR lower(u.display_name) LIKE :search
                )
                AND (CAST(:mode AS varchar) IS NULL OR s.mode=:mode)
                AND (CAST(:fromAt AS timestamptz) IS NULL OR s.start_at >= :fromAt)
                AND (CAST(:toAt AS timestamptz) IS NULL OR s.start_at < :toAt)
            """;
        long total = pendingConfirmationQuery("SELECT count(*) " + filters, tenantId,
            normalizedSearch, normalizedMode, fromAt, toAt)
            .query(Long.class)
            .single();

        String orderColumn = switch (sort == null ? "startAt" : sort) {
            case "className" -> "lower(c.name)";
            case "teacherName" -> "lower(u.display_name)";
            case "mode" -> "s.mode";
            default -> "s.start_at";
        };
        String orderDirection = "desc".equalsIgnoreCase(direction) ? "DESC" : "ASC";
        String sql = """
            SELECT s.id, s.class_id, c.code AS class_code, c.name AS class_name,
                   s.ordinal, s.start_at, s.end_at, t.id AS teacher_id,
                   u.display_name AS teacher_name, s.mode, r.name AS room_name
            """ + filters + " ORDER BY " + orderColumn + " " + orderDirection
            + ", s.id LIMIT :limit OFFSET :offset";
        List<PendingConfirmationItem> items = pendingConfirmationQuery(sql, tenantId,
            normalizedSearch, normalizedMode, fromAt, toAt)
            .param("limit", pageSize)
            .param("offset", (page - 1) * pageSize)
            .query((rs, row) -> new PendingConfirmationItem(
                rs.getObject("id", UUID.class),
                rs.getObject("class_id", UUID.class),
                rs.getString("class_code"),
                rs.getString("class_name"),
                rs.getInt("ordinal"),
                rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getObject("teacher_id", UUID.class),
                rs.getString("teacher_name"),
                rs.getString("mode"),
                rs.getString("room_name")))
            .list();
        return PageResponse.of(items, page, pageSize, total);
    }

    private JdbcClient.StatementSpec pendingConfirmationQuery(
        String sql,
        UUID tenantId,
        String search,
        String mode,
        OffsetDateTime fromAt,
        OffsetDateTime toAt
    ) {
        return jdbc.sql(sql)
            .param("tenantId", tenantId)
            .param("search", search)
            .param("mode", mode)
            .param("fromAt", fromAt)
            .param("toAt", toAt);
    }

    private void validatePendingConfirmationFilters(
        String mode,
        LocalDate from,
        LocalDate to,
        String sort,
        String direction,
        int page,
        int pageSize
    ) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                "Số trang hoặc số dòng mỗi trang chưa hợp lệ.");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE",
                "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
        }
        if (mode != null && !mode.isBlank()
            && !List.of("IN_PERSON", "ONLINE").contains(mode.trim().toUpperCase())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Hình thức học chưa hợp lệ.");
        }
        if (sort != null && !List.of("startAt", "className", "teacherName", "mode").contains(sort)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Cột sắp xếp chưa hợp lệ.");
        }
        if (direction != null && !List.of("asc", "desc").contains(direction.toLowerCase())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Chiều sắp xếp chưa hợp lệ.");
        }
    }

    private TodayStats todayStats(UUID tenantId, OffsetDateTime start, OffsetDateTime end) {
        return jdbc.sql("""
                SELECT count(*) AS session_count,
                       count(DISTINCT class_id) AS class_count,
                       count(DISTINCT room_id) FILTER (WHERE room_id IS NOT NULL) AS room_count
                FROM class_sessions
                WHERE tenant_id=:tenantId AND status <> 'CANCELLED'
                  AND start_at >= :startAt AND start_at < :endAt
                """)
            .param("tenantId", tenantId)
            .param("startAt", start)
            .param("endAt", end)
            .query((rs, row) -> new TodayStats(
                rs.getLong("session_count"),
                rs.getLong("class_count"),
                rs.getLong("room_count")))
            .single();
    }

    private List<AttentionItem> attentionItems(UUID tenantId) {
        List<AttentionItem> result = new ArrayList<>();
        jdbc.sql("""
                SELECT s.id, c.name, s.start_at, s.end_at, u.display_name
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN teacher_profiles t
                  ON t.tenant_id=s.tenant_id AND t.id=s.actual_teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE s.tenant_id=:tenantId AND s.status='PENDING_CONFIRMATION'
                ORDER BY s.start_at
                LIMIT 1
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new AttentionItem(
                "attention-checkin",
                "Buổi " + rs.getString("name") + " chưa được xác nhận đã dạy",
                format(rs.getObject("start_at", OffsetDateTime.class)) + "–"
                    + rs.getObject("end_at", OffsetDateTime.class)
                        .atZoneSameInstant(BUSINESS_ZONE)
                        .format(DateTimeFormatter.ofPattern("HH:mm"))
                    + " · " + rs.getString("display_name"),
                "Xác minh",
                "danger",
                rs.getObject("id", UUID.class).toString()))
            .optional()
            .ifPresent(result::add);

        OverdueTuition overdue = jdbc.sql("""
                SELECT count(*) AS student_count, count(DISTINCT class_id) AS class_count
                FROM tuition_charges
                WHERE tenant_id=:tenantId AND status='UNPAID'
                  AND created_at < now() - interval '7 days'
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new OverdueTuition(
                rs.getLong("student_count"), rs.getLong("class_count")))
            .single();
        if (overdue.studentCount() > 0) {
            result.add(new AttentionItem(
                "attention-tuition",
                overdue.studentCount() + " học sinh chưa nộp học phí",
                overdue.classCount() + " lớp có khoản phải thu quá 7 ngày",
                "Đối soát",
                "warning",
                null));
        }

        jdbc.sql("""
                SELECT c.name, s.start_at, r.name AS room_name, r.capacity,
                       count(e.id) AS student_count
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                JOIN rooms r ON r.tenant_id=s.tenant_id AND r.id=s.room_id
                LEFT JOIN class_enrollments e
                  ON e.tenant_id=s.tenant_id AND e.class_id=s.class_id AND e.status='ACTIVE'
                WHERE s.tenant_id=:tenantId AND s.status <> 'CANCELLED'
                  AND s.start_at >= now()
                GROUP BY c.name, s.start_at, r.name, r.capacity
                HAVING count(e.id) > r.capacity
                ORDER BY s.start_at
                LIMIT 1
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new AttentionItem(
                "attention-room",
                rs.getString("room_name") + " vượt sức chứa",
                format(rs.getObject("start_at", OffsetDateTime.class)) + " · "
                    + rs.getLong("student_count") + " học sinh / sức chứa "
                    + rs.getInt("capacity") + " · " + rs.getString("name"),
                "Đổi phòng",
                "info",
                null))
            .optional()
            .ifPresent(result::add);
        return List.copyOf(result);
    }

    private List<ClassStateMetric> classStates(UUID tenantId) {
        Map<String, Long> counts = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT status, count(*) AS total
                FROM classes
                WHERE tenant_id=:tenantId AND status IN ('ACTIVE', 'AWAITING_CLOSE', 'CLOSED')
                GROUP BY status
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> Map.entry(rs.getString("status"), rs.getLong("total")))
            .list()
            .forEach(entry -> counts.put(entry.getKey(), entry.getValue()));
        return List.of(
            new ClassStateMetric("Active", "Đang học", counts.getOrDefault("ACTIVE", 0L)),
            new ClassStateMetric("AwaitingClose", "Chờ kết thúc",
                counts.getOrDefault("AWAITING_CLOSE", 0L)),
            new ClassStateMetric("Closed", "Đã đóng", counts.getOrDefault("CLOSED", 0L))
        );
    }

    private String displayName(UUID tenantId, UUID userId) {
        return jdbc.sql("""
                SELECT display_name FROM users
                WHERE tenant_id=:tenantId AND id=:userId
                """)
            .param("tenantId", tenantId)
            .param("userId", userId)
            .query(String.class)
            .single();
    }

    private long count(UUID tenantId, String sql) {
        return jdbc.sql(sql).param("tenantId", tenantId).query(Long.class).single();
    }

    private String format(OffsetDateTime value) {
        return value.atZoneSameInstant(BUSINESS_ZONE).format(SHORT_DATE_TIME);
    }

    private String twoDigits(long value) {
        return value < 10 ? "0" + value : String.valueOf(value);
    }

    private record TodayStats(long sessionCount, long classCount, long roomCount) {
    }

    private record OverdueTuition(long studentCount, long classCount) {
    }
}
