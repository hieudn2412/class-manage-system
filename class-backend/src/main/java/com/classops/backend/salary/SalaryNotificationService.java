package com.classops.backend.salary;

import com.classops.backend.common.ApiException;
import com.classops.backend.salary.SalaryDtos.SalaryNotificationQueued;
import com.classops.backend.salary.SalaryDtos.SalaryNotificationSkipped;
import com.classops.backend.salary.SalaryDtos.SendSalaryNotificationsInput;
import com.classops.backend.salary.SalaryDtos.SendSalaryNotificationsResult;
import com.classops.backend.salary.SalaryDtos.TeacherPayrollDetail;
import com.classops.backend.scheduling.SchedulingEngine;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.teaching.TeachingSupport;
import com.classops.backend.tenantemail.TenantEmailConnectionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SalaryNotificationService {
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Locale VIETNAMESE = Locale.forLanguageTag("vi-VN");

    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final TeachingSupport support;
    private final SalaryService salaryService;
    private final TenantEmailConnectionService emailConnections;
    private final Clock clock;
    private final Duration emailRetention;
    private final String appPublicUrl;

    public SalaryNotificationService(
        JdbcClient jdbc,
        CurrentActor actor,
        TeachingSupport support,
        SalaryService salaryService,
        TenantEmailConnectionService emailConnections,
        Clock clock,
        @Value("${app.gmail.outbox-retention:PT72H}") Duration emailRetention,
        @Value("${app.public-url:http://localhost:5173}") String appPublicUrl
    ) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.support = support;
        this.salaryService = salaryService;
        this.emailConnections = emailConnections;
        this.clock = clock;
        this.emailRetention = emailRetention;
        this.appPublicUrl = trimRight(appPublicUrl);
    }

    @Transactional
    public SendSalaryNotificationsResult send(SendSalaryNotificationsInput input,
                                               String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        List<UUID> teacherIds = List.copyOf(new LinkedHashSet<>(input.teacherIds()));
        String contactNote = clean(input.contactNote());
        NotificationRequest request = new NotificationRequest(input.month(), teacherIds,
            input.paymentDate(), contactNote, input.confirmResend());
        String requestHash = support.requestHash(request);
        SendSalaryNotificationsResult repeated = support.repeated(tenantId,
            "send-salary-notifications", idempotencyKey, requestHash,
            SendSalaryNotificationsResult.class);
        if (repeated != null) return repeated;

        List<Recipient> recipients = recipients(tenantId, teacherIds);
        if (recipients.size() != teacherIds.size()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TEACHER_NOT_FOUND",
                "Không tìm thấy một hoặc nhiều giáo viên trong trung tâm.");
        }
        Map<UUID, Recipient> recipientById = recipients.stream()
            .collect(Collectors.toMap(Recipient::teacherId, Function.identity()));
        recipients = teacherIds.stream().map(recipientById::get).toList();

        List<DuplicateNotification> duplicates = duplicates(tenantId, teacherIds,
            input.month().toString());
        if (!input.confirmResend() && !duplicates.isEmpty()) {
            List<Map<String, Object>> details = duplicates.stream().map(duplicate -> {
                Map<String, Object> value = new LinkedHashMap<>();
                value.put("teacherId", duplicate.teacherId());
                value.put("teacherName", recipientById.get(duplicate.teacherId()).teacherName());
                value.put("status", duplicate.status());
                value.put("sentAt", duplicate.sentAt());
                return value;
            }).toList();
            throw new ApiException(HttpStatus.CONFLICT, "SALARY_NOTIFICATION_ALREADY_SENT",
                "Một hoặc nhiều giáo viên đã có thông báo cho kỳ lương này.",
                Map.of("duplicates", details));
        }

        emailConnections.requireConnectedForSend(tenantId);
        String tenantName = jdbc.sql("SELECT name FROM tenants WHERE id=:tenantId")
            .param("tenantId", tenantId).query(String.class).single();
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        List<SalaryNotificationQueued> queued = new ArrayList<>();
        List<SalaryNotificationSkipped> skipped = new ArrayList<>();

        for (Recipient recipient : recipients) {
            if (!recipient.active() || clean(recipient.email()) == null) {
                skipped.add(new SalaryNotificationSkipped(recipient.teacherId(),
                    recipient.teacherName(), "MISSING_EMAIL"));
                continue;
            }
            TeacherPayrollDetail detail = salaryService.teacherPayroll(
                recipient.teacherId(), input.month());
            UUID notificationId = UUID.randomUUID();
            String deepLink = appPublicUrl + "/t/" + actor.tenantSlug()
                + "/app/my-salary?month=" + input.month();
            String subject = "[" + tenantName + "] Thông báo bảng lương tháng "
                + monthLabel(input.month().getMonthValue(), input.month().getYear());
            String textBody = textBody(tenantName, recipient.teacherName(), detail,
                input.paymentDate(), contactNote);
            String htmlBody = htmlBody(tenantName, recipient.teacherName(), detail,
                input.paymentDate(), contactNote, deepLink);
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("to", recipient.email().trim());
            payload.put("title", subject);
            payload.put("body", textBody);
            payload.put("textBody", textBody);
            payload.put("htmlBody", htmlBody);
            payload.put("deepLink", deepLink);
            payload.put("month", input.month().toString());
            payload.put("paymentDate", input.paymentDate().toString());
            payload.put("notificationType", "SALARY_PAYROLL");

            jdbc.sql("""
                    INSERT INTO outbox_events (
                      id, tenant_id, aggregate_type, aggregate_id, event_type,
                      event_key, payload, next_attempt_at, expires_at
                    ) VALUES (
                      :id, :tenantId, 'TEACHER_PAYROLL', :teacherId, 'EMAIL_NOTIFICATION',
                      :eventKey, CAST(:payload AS jsonb), :now, :expiresAt
                    )
                    """)
                .param("id", notificationId).param("tenantId", tenantId)
                .param("teacherId", recipient.teacherId())
                .param("eventKey", eventKey(recipient.teacherId(), input.month().toString(),
                    idempotencyKey))
                .param("payload", support.json(payload)).param("now", now)
                .param("expiresAt", now.plus(emailRetention)).update();
            support.audit(tenantId, actor.userId(), "USER", "SALARY_NOTIFICATION_QUEUED",
                "TEACHER_PAYROLL", recipient.teacherId(), null, Map.of(
                    "notificationId", notificationId,
                    "month", input.month().toString(),
                    "paymentDate", input.paymentDate().toString(),
                    "resend", !duplicates.isEmpty()));
            queued.add(new SalaryNotificationQueued(recipient.teacherId(),
                recipient.teacherName(), notificationId));
        }

        SendSalaryNotificationsResult response = new SendSalaryNotificationsResult(
            queued.size(), List.copyOf(queued), List.copyOf(skipped));
        support.remember(tenantId, "send-salary-notifications", idempotencyKey,
            requestHash, 202, response);
        return response;
    }

    private List<Recipient> recipients(UUID tenantId, List<UUID> teacherIds) {
        return jdbc.sql("""
                SELECT t.id AS teacher_id, u.display_name, u.email, u.status
                FROM teacher_profiles t
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE t.tenant_id=:tenantId AND t.id IN (:teacherIds)
                """)
            .param("tenantId", tenantId).param("teacherIds", teacherIds)
            .query((rs, row) -> new Recipient(
                rs.getObject("teacher_id", UUID.class), rs.getString("display_name"),
                rs.getString("email"), "ACTIVE".equals(rs.getString("status"))))
            .list();
    }

    private List<DuplicateNotification> duplicates(UUID tenantId, List<UUID> teacherIds,
                                                    String month) {
        return jdbc.sql("""
                SELECT DISTINCT ON (aggregate_id) aggregate_id,
                       CASE WHEN published_at IS NOT NULL THEN 'SENT' ELSE 'QUEUED' END AS status,
                       COALESCE(published_at, occurred_at) AS sent_at
                FROM outbox_events
                WHERE tenant_id=:tenantId AND aggregate_type='TEACHER_PAYROLL'
                  AND aggregate_id IN (:teacherIds) AND event_type='EMAIL_NOTIFICATION'
                  AND payload->>'month'=:month AND dead_lettered_at IS NULL
                ORDER BY aggregate_id, occurred_at DESC
                """)
            .param("tenantId", tenantId).param("teacherIds", teacherIds).param("month", month)
            .query((rs, row) -> new DuplicateNotification(
                rs.getObject("aggregate_id", UUID.class), rs.getString("status"),
                rs.getObject("sent_at", OffsetDateTime.class)))
            .list();
    }

    private String textBody(String tenantName, String teacherName, TeacherPayrollDetail detail,
                            java.time.LocalDate paymentDate, String contactNote) {
        var metrics = detail.metrics();
        StringBuilder text = new StringBuilder()
            .append("Kính gửi Thầy/Cô ").append(teacherName).append(",\n\n")
            .append(tenantName).append(" gửi Thầy/Cô thông tin bảng lương tháng ")
            .append(monthLabel(detail.month().getMonthValue(), detail.month().getYear()))
            .append(". Ngày dự kiến thanh toán: ").append(paymentDate.format(DATE_FORMAT))
            .append(".\n\n")
            .append("Số buổi: ").append(metrics.sessionCount()).append("\n")
            .append("Tổng giờ dạy: ").append(hours(metrics.totalMinutes())).append("\n")
            .append("Tiền dạy: ").append(money(metrics.accrued())).append("\n")
            .append("Cộng hoặc trừ: ").append(money(metrics.adjustments())).append("\n")
            .append("Tổng lương: ").append(money(metrics.due())).append("\n")
            .append("Đã thanh toán: ").append(money(metrics.paid())).append("\n")
            .append("Còn lại: ").append(money(metrics.outstanding())).append("\n");
        if (contactNote != null) text.append("\n").append(contactNote).append("\n");
        return text.append("\nĐây là email thông báo tự động. Vui lòng không trả lời email này. ")
            .append("Nếu cần hỗ trợ, vui lòng liên hệ trung tâm.").toString();
    }

    private String htmlBody(String tenantName, String teacherName, TeacherPayrollDetail detail,
                            java.time.LocalDate paymentDate, String contactNote, String deepLink) {
        var metrics = detail.metrics();
        String safeNote = contactNote == null ? ""
            : "<div style=\"margin-top:20px;padding:14px 16px;border-radius:10px;background:#eff6ff;color:#1e3a8a;line-height:1.6\">"
            + escape(contactNote).replace("\n", "<br>") + "</div>";
        return """
            <!doctype html><html lang="vi"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
            <table role="presentation" width="920" cellspacing="0" cellpadding="0" style="width:100%%;max-width:920px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ef">
            <tr><td style="padding:26px 28px;background:#2448d8;color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;opacity:.8">EDU OPS</div><h1 style="margin:8px 0 0;font-size:24px;line-height:1.3">Thông báo bảng lương</h1><div style="margin-top:6px;color:#dbeafe">%s</div></td></tr>
            <tr><td style="padding:28px"><p style="margin:0 0 14px;font-size:16px">Kính gửi Thầy/Cô <strong>%s</strong>,</p><p style="margin:0;color:#475569;line-height:1.65">Trung tâm gửi Thầy/Cô thông tin bảng lương tháng <strong>%s</strong>. Ngày dự kiến thanh toán: <strong>%s</strong>.</p>
            <table role="table" width="100%%" cellspacing="0" cellpadding="0" style="margin-top:22px;border:1px solid #dbe3ef;border-collapse:collapse">
            %s
            </table>%s
            <div style="margin-top:24px;text-align:center"><a href="%s" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#2448d8;color:#fff;text-decoration:none;font-weight:700">Xem bảng lương của tôi</a></div>
            <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6">Đây là email thông báo tự động. Vui lòng không trả lời email này. Nếu cần hỗ trợ, vui lòng liên hệ trung tâm.</p></td></tr>
            </table></td></tr></table></body></html>
            """.formatted(escape(tenantName), escape(teacherName),
            monthLabel(detail.month().getMonthValue(), detail.month().getYear()),
            paymentDate.format(DATE_FORMAT), summaryTable(metrics), safeNote, escape(deepLink));
    }

    private String summaryTable(SalaryDtos.TeacherPayrollMetrics metrics) {
        return "<thead><tr>"
            + headerCell("Số buổi", false)
            + headerCell("Tổng giờ dạy", false)
            + headerCell("Tiền dạy", false)
            + headerCell("Cộng hoặc trừ", false)
            + headerCell("Tổng lương", true)
            + headerCell("Đã thanh toán", false)
            + headerCell("Còn lại", true)
            + "</tr></thead><tbody><tr>"
            + valueCell(String.valueOf(metrics.sessionCount()), false)
            + valueCell(hours(metrics.totalMinutes()), false)
            + valueCell(money(metrics.accrued()), false)
            + valueCell(money(metrics.adjustments()), false)
            + valueCell(money(metrics.due()), true)
            + valueCell(money(metrics.paid()), false)
            + valueCell(money(metrics.outstanding()), true)
            + "</tr></tbody>";
    }

    private String headerCell(String label, boolean strong) {
        String background = strong ? "#dbeafe" : "#eff6ff";
        return "<th scope=\"col\" align=\"center\" style=\"padding:10px 8px;border:1px solid #dbe3ef;background:"
            + background + ";color:#334155;font-size:12px;line-height:1.35;white-space:nowrap\">"
            + escape(label) + "</th>";
    }

    private String valueCell(String value, boolean strong) {
        String weight = strong ? "700" : "500";
        String background = strong ? "#eff6ff" : "#ffffff";
        String color = strong ? "#1d4ed8" : "#0f172a";
        return "<td align=\"center\" style=\"padding:11px 8px;border:1px solid #dbe3ef;background:"
            + background + ";color:" + color + ";font-size:12px;font-weight:" + weight
            + ";white-space:nowrap\">" + escape(value) + "</td>";
    }

    private String money(BigDecimal value) {
        NumberFormat format = NumberFormat.getNumberInstance(VIETNAMESE);
        format.setMaximumFractionDigits(0);
        format.setMinimumFractionDigits(0);
        return format.format(value) + " ₫";
    }

    private String hours(long minutes) {
        return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 1, RoundingMode.HALF_UP)
            .stripTrailingZeros().toPlainString() + " giờ";
    }

    private String eventKey(UUID teacherId, String month, String key) {
        return "salary:" + teacherId + ":" + month + ":"
            + SchedulingEngine.sha256(key).substring(0, 24);
    }

    private String monthLabel(int month, int year) {
        return String.format(VIETNAMESE, "%02d/%d", month, year);
    }

    private String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value, "UTF-8");
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String trimRight(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    private record Recipient(UUID teacherId, String teacherName, String email, boolean active) {}
    private record DuplicateNotification(UUID teacherId, String status, OffsetDateTime sentAt) {}
    private record NotificationRequest(
        java.time.YearMonth month,
        List<UUID> teacherIds,
        java.time.LocalDate paymentDate,
        String contactNote,
        boolean confirmResend
    ) {}
}
