package com.classops.backend.salary;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.salary.SalaryAccrualService.AccrualResult;
import com.classops.backend.salary.SalaryDtos.BalanceStatus;
import com.classops.backend.salary.SalaryDtos.CompletionCorrectionInput;
import com.classops.backend.salary.SalaryDtos.CompletionCorrectionView;
import com.classops.backend.salary.SalaryDtos.CreateAdjustmentInput;
import com.classops.backend.salary.SalaryDtos.CreateHourlyRateInput;
import com.classops.backend.salary.SalaryDtos.CreatePaymentInput;
import com.classops.backend.salary.SalaryDtos.HourlyRateView;
import com.classops.backend.salary.SalaryDtos.PaymentMethod;
import com.classops.backend.salary.SalaryDtos.PayrollMetrics;
import com.classops.backend.salary.SalaryDtos.PayrollPage;
import com.classops.backend.salary.SalaryDtos.PayrollTeacherRow;
import com.classops.backend.salary.SalaryDtos.SalaryAccrualLine;
import com.classops.backend.salary.SalaryDtos.SalaryAdjustmentView;
import com.classops.backend.salary.SalaryDtos.SalaryMonthSummary;
import com.classops.backend.salary.SalaryDtos.SalaryPaymentView;
import com.classops.backend.salary.SalaryDtos.SalaryYearSummary;
import com.classops.backend.salary.SalaryDtos.TeacherPayrollDetail;
import com.classops.backend.salary.SalaryDtos.TeacherPayrollMetrics;
import com.classops.backend.salary.SalaryDtos.UpdateAdjustmentInput;
import com.classops.backend.salary.SalaryDtos.UpdateHourlyRateInput;
import com.classops.backend.salary.SalaryDtos.UpdatePaymentInput;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.teaching.TeachingSupport;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class SalaryService {
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2);

    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final TeachingSupport support;
    private final SalaryAccrualService accruals;
    private final Clock clock;

    public SalaryService(JdbcClient jdbc, CurrentActor actor, TeachingSupport support,
                         SalaryAccrualService accruals, Clock clock) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.support = support;
        this.accruals = accruals;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<HourlyRateView> hourlyRates(UUID classId) {
        UUID tenantId = actor.tenantId();
        requireClass(tenantId, classId);
        return jdbc.sql("""
                SELECT id, class_id, effective_date,
                       (lead(effective_date) OVER (ORDER BY effective_date) - 1) AS effective_to,
                       hourly_rate, version, created_at, updated_at
                FROM class_hourly_rates
                WHERE tenant_id=:tenantId AND class_id=:classId
                ORDER BY effective_date DESC
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .query((rs, row) -> new HourlyRateView(
                rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
                rs.getObject("effective_date", LocalDate.class),
                rs.getObject("effective_to", LocalDate.class), rs.getBigDecimal("hourly_rate"),
                rs.getLong("version"), rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)))
            .list();
    }

    @Transactional
    public HourlyRateView createHourlyRate(UUID classId, CreateHourlyRateInput input,
                                           String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        requireClass(tenantId, classId);
        String operation = "CREATE_HOURLY_RATE:" + classId;
        String hash = support.requestHash(input);
        HourlyRateView repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, HourlyRateView.class);
        if (repeated != null) {
            return repeated;
        }
        boolean duplicate = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM class_hourly_rates
                  WHERE tenant_id=:tenantId AND class_id=:classId AND effective_date=:effectiveDate)
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("effectiveDate", input.effectiveDate()).query(Boolean.class).single();
        if (duplicate) {
            throw new ApiException(HttpStatus.CONFLICT, "HOURLY_RATE_DATE_CONFLICT",
                "Lớp đã có đơn giá bắt đầu từ ngày này.");
        }
        UUID rateId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO class_hourly_rates (
                  id, tenant_id, class_id, effective_date, hourly_rate, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, :classId, :effectiveDate, :hourlyRate, :actorId, :actorId
                )
                """)
            .param("id", rateId).param("tenantId", tenantId).param("classId", classId)
            .param("effectiveDate", input.effectiveDate())
            .param("hourlyRate", input.hourlyRate()).param("actorId", actor.userId()).update();
        HourlyRateView result = hourlyRate(tenantId, rateId);
        support.audit(tenantId, actor.userId(), "USER", "CLASS_HOURLY_RATE_CREATED",
            "CLASS_HOURLY_RATE", rateId, null, new RateAudit(result, input.reason()));
        reconcileClass(tenantId, classId, input.reason());
        result = hourlyRate(tenantId, rateId);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, result);
        return result;
    }

    @Transactional
    public HourlyRateView updateHourlyRate(UUID classId, UUID rateId,
                                           UpdateHourlyRateInput input) {
        UUID tenantId = actor.tenantId();
        requireClass(tenantId, classId);
        HourlyRateView oldValue = hourlyRate(tenantId, rateId);
        if (!oldValue.classId().equals(classId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "HOURLY_RATE_NOT_FOUND",
                "Không tìm thấy đơn giá của lớp.");
        }
        boolean duplicate = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM class_hourly_rates
                  WHERE tenant_id=:tenantId AND class_id=:classId
                    AND effective_date=:effectiveDate AND id<>:rateId)
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("effectiveDate", input.effectiveDate()).param("rateId", rateId)
            .query(Boolean.class).single();
        if (duplicate) {
            throw new ApiException(HttpStatus.CONFLICT, "HOURLY_RATE_DATE_CONFLICT",
                "Lớp đã có đơn giá bắt đầu từ ngày này.");
        }
        int updated = jdbc.sql("""
                UPDATE class_hourly_rates
                SET effective_date=:effectiveDate, hourly_rate=:hourlyRate,
                    updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:rateId AND class_id=:classId AND version=:version
                """)
            .param("effectiveDate", input.effectiveDate())
            .param("hourlyRate", input.hourlyRate()).param("actorId", actor.userId())
            .param("tenantId", tenantId).param("rateId", rateId).param("classId", classId)
            .param("version", input.version()).update();
        if (updated == 0) {
            throw stale("Đơn giá");
        }
        HourlyRateView result = hourlyRate(tenantId, rateId);
        support.audit(tenantId, actor.userId(), "USER", "CLASS_HOURLY_RATE_UPDATED",
            "CLASS_HOURLY_RATE", rateId, new RateAudit(oldValue, input.reason()),
            new RateAudit(result, input.reason()));
        reconcileClass(tenantId, classId, input.reason());
        return hourlyRate(tenantId, rateId);
    }

    @Transactional
    public CompletionCorrectionView correctCompletion(UUID sessionId,
                                                       CompletionCorrectionInput input) {
        UUID tenantId = actor.tenantId();
        CompletionRow oldValue = completionRow(tenantId, sessionId, true);
        if (!"COMPLETED".equals(oldValue.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT",
                "Chỉ buổi đã hoàn tất mới được sửa căn cứ tính lương.");
        }
        if (!input.endAt().isAfter(input.startAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIME_RANGE",
                "Giờ kết thúc phải sau giờ bắt đầu.");
        }
        if (input.endAt().toInstant().isAfter(clock.instant())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "COMPLETED_SESSION_IN_FUTURE",
                "Buổi đã hoàn tất không thể có giờ kết thúc trong tương lai.");
        }
        requireTeacher(tenantId, input.actualTeacherId());
        int updated = jdbc.sql("""
                UPDATE class_sessions
                SET start_at=:startAt, end_at=:endAt, actual_teacher_id=:teacherId,
                    is_substitution=(:teacherId<>planned_teacher_id),
                    updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:sessionId AND version=:version
                """)
            .param("startAt", input.startAt()).param("endAt", input.endAt())
            .param("teacherId", input.actualTeacherId()).param("tenantId", tenantId)
            .param("sessionId", sessionId).param("version", input.version()).update();
        if (updated == 0) {
            throw stale("Buổi học");
        }
        CompletionRow next = completionRow(tenantId, sessionId, false);
        support.audit(tenantId, actor.userId(), "USER", "COMPLETED_SESSION_CORRECTED",
            "SESSION", sessionId, new CompletionAudit(oldValue, input.reason()),
            new CompletionAudit(next, input.reason()));
        AccrualResult salary = accruals.reconcile(tenantId, sessionId, actor.userId(), input.reason());
        return new CompletionCorrectionView(sessionId, next.startAt(), next.endAt(),
            next.teacherId(), next.version(), salary.amount(), salary.revision());
    }

    @Transactional(readOnly = true)
    public PayrollPage payroll(YearMonth month, String search, String status,
                               int page, int pageSize, String sort) {
        validatePage(page, pageSize);
        UUID tenantId = actor.tenantId();
        List<PayrollTeacherRow> rows = new ArrayList<>(teacherRows(tenantId, month));
        String normalized = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        rows.removeIf(row -> !normalized.isEmpty()
            && !row.teacherName().toLowerCase(Locale.ROOT).contains(normalized));
        String statusFilter = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (!statusFilter.isEmpty()) {
            rows.removeIf(row -> !row.status().name().equals(statusFilter));
        }
        rows.sort(comparator(sort));
        PayrollMetrics metrics = metrics(rows);
        int from = Math.min((page - 1) * pageSize, rows.size());
        int to = Math.min(from + pageSize, rows.size());
        return new PayrollPage(month, metrics,
            PageResponse.of(rows.subList(from, to), page, pageSize, rows.size()));
    }

    @Transactional(readOnly = true)
    public TeacherPayrollDetail teacherPayroll(UUID teacherId, YearMonth month) {
        UUID tenantId = actor.tenantId();
        String teacherName = requireTeacher(tenantId, teacherId);
        return detail(tenantId, teacherId, teacherName, month);
    }

    @Transactional(readOnly = true)
    public TeacherPayrollDetail ownPayroll(YearMonth month) {
        UUID tenantId = actor.tenantId();
        TeacherIdentity teacher = jdbc.sql("""
                SELECT t.id, u.display_name
                FROM teacher_profiles t
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE t.tenant_id=:tenantId AND t.user_id=:userId
                """)
            .param("tenantId", tenantId).param("userId", actor.userId())
            .query((rs, row) -> new TeacherIdentity(
                rs.getObject("id", UUID.class), rs.getString("display_name")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN,
                "TEACHER_PROFILE_REQUIRED", "Tài khoản không có hồ sơ giáo viên."));
        return detail(tenantId, teacher.id(), teacher.name(), month);
    }

    @Transactional
    public SalaryAdjustmentView createAdjustment(CreateAdjustmentInput input,
                                                   String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        validateNonZero(input.amount());
        UUID tenantId = actor.tenantId();
        requireTeacher(tenantId, input.teacherId());
        String operation = "CREATE_SALARY_ADJUSTMENT";
        String hash = support.requestHash(input);
        SalaryAdjustmentView repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SalaryAdjustmentView.class);
        if (repeated != null) return repeated;
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO salary_adjustments (
                  id, tenant_id, teacher_id, salary_month, amount, reason, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, :teacherId, :month, :amount, :reason, :actorId, :actorId
                )
                """)
            .param("id", id).param("tenantId", tenantId).param("teacherId", input.teacherId())
            .param("month", input.salaryMonth().atDay(1)).param("amount", input.amount())
            .param("reason", input.reason().trim()).param("actorId", actor.userId()).update();
        SalaryAdjustmentView result = adjustment(tenantId, id);
        support.audit(tenantId, actor.userId(), "USER", "SALARY_ADJUSTMENT_CREATED",
            "SALARY_ADJUSTMENT", id, null, result);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, result);
        return result;
    }

    @Transactional
    public SalaryAdjustmentView updateAdjustment(UUID adjustmentId, UpdateAdjustmentInput input) {
        validateNonZero(input.amount());
        UUID tenantId = actor.tenantId();
        requireTeacher(tenantId, input.teacherId());
        SalaryAdjustmentView oldValue = adjustment(tenantId, adjustmentId);
        int updated = jdbc.sql("""
                UPDATE salary_adjustments
                SET teacher_id=:teacherId, salary_month=:month, amount=:amount, reason=:reason,
                    updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id AND version=:version
                """)
            .param("teacherId", input.teacherId()).param("month", input.salaryMonth().atDay(1))
            .param("amount", input.amount()).param("reason", input.reason().trim())
            .param("actorId", actor.userId()).param("tenantId", tenantId)
            .param("id", adjustmentId).param("version", input.version()).update();
        if (updated == 0) throw stale("Điều chỉnh lương");
        SalaryAdjustmentView result = adjustment(tenantId, adjustmentId);
        support.audit(tenantId, actor.userId(), "USER", "SALARY_ADJUSTMENT_UPDATED",
            "SALARY_ADJUSTMENT", adjustmentId,
            new TransactionAudit(oldValue, input.editReason()),
            new TransactionAudit(result, input.editReason()));
        return result;
    }

    @Transactional
    public SalaryPaymentView createPayment(CreatePaymentInput input, String idempotencyKey) {
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "CREATE_SALARY_PAYMENT";
        String hash = support.requestHash(input);
        SalaryPaymentView repeated = support.repeated(
            tenantId, operation, idempotencyKey, hash, SalaryPaymentView.class);
        if (repeated != null) return repeated;
        requireTeacher(tenantId, input.teacherId());
        validatePayment(input.method(), input.reference());
        requireOverpaymentConfirmation(tenantId, input.teacherId(), input.salaryMonth(),
            input.amount(), ZERO, input.confirmOverpayment(), input.overpaymentReason());
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO salary_payments (
                  id, tenant_id, teacher_id, salary_month, paid_at, amount, method,
                  reference, overpayment_reason, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, :teacherId, :month, :paidAt, :amount, :method,
                  :reference, :overpaymentReason, :actorId, :actorId
                )
                """)
            .param("id", id).param("tenantId", tenantId).param("teacherId", input.teacherId())
            .param("month", input.salaryMonth().atDay(1)).param("paidAt", input.paidAt())
            .param("amount", input.amount()).param("method", input.method().name())
            .param("reference", blankToNull(input.reference()))
            .param("overpaymentReason", blankToNull(input.overpaymentReason()))
            .param("actorId", actor.userId()).update();
        SalaryPaymentView result = payment(tenantId, id);
        support.audit(tenantId, actor.userId(), "USER", "SALARY_PAYMENT_CREATED",
            "SALARY_PAYMENT", id, null, result);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, result);
        return result;
    }

    @Transactional
    public SalaryPaymentView updatePayment(UUID paymentId, UpdatePaymentInput input) {
        UUID tenantId = actor.tenantId();
        requireTeacher(tenantId, input.teacherId());
        validatePayment(input.method(), input.reference());
        SalaryPaymentView oldValue = payment(tenantId, paymentId);
        BigDecimal restore = oldValue.teacherId().equals(input.teacherId())
            && oldValue.salaryMonth().equals(input.salaryMonth()) ? oldValue.amount() : ZERO;
        requireOverpaymentConfirmation(tenantId, input.teacherId(), input.salaryMonth(),
            input.amount(), restore, input.confirmOverpayment(), input.overpaymentReason());
        int updated = jdbc.sql("""
                UPDATE salary_payments
                SET teacher_id=:teacherId, salary_month=:month, paid_at=:paidAt, amount=:amount,
                    method=:method, reference=:reference, overpayment_reason=:overpaymentReason,
                    updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id AND version=:version
                """)
            .param("teacherId", input.teacherId()).param("month", input.salaryMonth().atDay(1))
            .param("paidAt", input.paidAt()).param("amount", input.amount())
            .param("method", input.method().name()).param("reference", blankToNull(input.reference()))
            .param("overpaymentReason", blankToNull(input.overpaymentReason()))
            .param("actorId", actor.userId()).param("tenantId", tenantId)
            .param("id", paymentId).param("version", input.version()).update();
        if (updated == 0) throw stale("Thanh toán lương");
        SalaryPaymentView result = payment(tenantId, paymentId);
        support.audit(tenantId, actor.userId(), "USER", "SALARY_PAYMENT_UPDATED",
            "SALARY_PAYMENT", paymentId, new TransactionAudit(oldValue, input.editReason()),
            new TransactionAudit(result, input.editReason()));
        return result;
    }

    @Transactional(readOnly = true)
    public SalaryYearSummary salarySummary(int year) {
        if (year < 2000 || year > 2200) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_YEAR", "Năm báo cáo không hợp lệ.");
        }
        UUID tenantId = actor.tenantId();
        List<SalaryMonthSummary> result = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            YearMonth period = YearMonth.of(year, month);
            List<PayrollTeacherRow> rows = teacherRows(tenantId, period);
            BigDecimal accrued = sum(rows, PayrollTeacherRow::accrued);
            BigDecimal adjustments = sum(rows, PayrollTeacherRow::adjustments);
            BigDecimal due = sum(rows, PayrollTeacherRow::due);
            BigDecimal paidByPeriod = sum(rows, PayrollTeacherRow::paid);
            BigDecimal outstanding = sum(rows, PayrollTeacherRow::outstanding);
            BigDecimal cash = jdbc.sql("""
                    SELECT COALESCE(sum(amount), 0) FROM salary_payments
                    WHERE tenant_id=:tenantId AND paid_at>=:from AND paid_at<:to
                    """)
                .param("tenantId", tenantId).param("from", period.atDay(1))
                .param("to", period.plusMonths(1).atDay(1)).query(BigDecimal.class).single();
            result.add(new SalaryMonthSummary(period, accrued, adjustments, due,
                paidByPeriod, cash, outstanding));
        }
        return new SalaryYearSummary(year, List.copyOf(result));
    }

    private TeacherPayrollDetail detail(UUID tenantId, UUID teacherId, String teacherName,
                                        YearMonth month) {
        List<SalaryAccrualLine> lines = accrualLines(tenantId, teacherId, month);
        List<SalaryAdjustmentView> adjustments = adjustments(tenantId, teacherId, month);
        List<SalaryPaymentView> payments = payments(tenantId, teacherId, month);
        long sessionCount = lines.stream().filter(line -> line.status() == SalaryDtos.AccrualStatus.ACTIVE).count();
        long minutes = lines.stream().filter(line -> line.status() == SalaryDtos.AccrualStatus.ACTIVE)
            .mapToLong(SalaryAccrualLine::scheduledMinutes).sum();
        BigDecimal accrued = lines.stream().filter(line -> line.status() == SalaryDtos.AccrualStatus.ACTIVE)
            .map(SalaryAccrualLine::amount).reduce(ZERO, BigDecimal::add);
        BigDecimal adjustmentTotal = adjustments.stream().map(SalaryAdjustmentView::amount)
            .reduce(ZERO, BigDecimal::add);
        BigDecimal due = accrued.add(adjustmentTotal);
        BigDecimal paid = payments.stream().map(SalaryPaymentView::amount)
            .reduce(ZERO, BigDecimal::add);
        BigDecimal outstanding = due.subtract(paid);
        return new TeacherPayrollDetail(month, teacherId, teacherName,
            new TeacherPayrollMetrics(sessionCount, minutes, accrued, adjustmentTotal, due,
                paid, outstanding, balanceStatus(outstanding)),
            List.copyOf(lines), List.copyOf(adjustments), List.copyOf(payments));
    }

    private List<PayrollTeacherRow> teacherRows(UUID tenantId, YearMonth month) {
        return jdbc.sql("""
                WITH accrual AS (
                  SELECT sa.teacher_id, count(*) AS session_count,
                         sum(sa.scheduled_minutes) AS minutes, sum(sa.amount) AS amount
                  FROM salary_accruals sa
                  JOIN class_sessions s ON s.tenant_id=sa.tenant_id AND s.id=sa.session_id
                  WHERE sa.tenant_id=:tenantId AND sa.status='ACTIVE'
                    AND (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date>=:from
                    AND (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date<:to
                  GROUP BY sa.teacher_id
                ), adjustment AS (
                  SELECT teacher_id, sum(amount) AS amount FROM salary_adjustments
                  WHERE tenant_id=:tenantId AND salary_month=:from GROUP BY teacher_id
                ), payment AS (
                  SELECT teacher_id, sum(amount) AS amount FROM salary_payments
                  WHERE tenant_id=:tenantId AND salary_month=:from GROUP BY teacher_id
                )
                SELECT t.id AS teacher_id, u.display_name,
                       COALESCE(a.session_count,0) AS session_count,
                       COALESCE(a.minutes,0) AS minutes,
                       COALESCE(a.amount,0) AS accrued,
                       COALESCE(ad.amount,0) AS adjustments,
                       COALESCE(p.amount,0) AS paid
                FROM teacher_profiles t
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                LEFT JOIN accrual a ON a.teacher_id=t.id
                LEFT JOIN adjustment ad ON ad.teacher_id=t.id
                LEFT JOIN payment p ON p.teacher_id=t.id
                WHERE t.tenant_id=:tenantId
                """)
            .param("tenantId", tenantId).param("from", month.atDay(1))
            .param("to", month.plusMonths(1).atDay(1))
            .query((rs, row) -> {
                BigDecimal accrued = rs.getBigDecimal("accrued");
                BigDecimal adjustments = rs.getBigDecimal("adjustments");
                BigDecimal due = accrued.add(adjustments);
                BigDecimal paid = rs.getBigDecimal("paid");
                BigDecimal outstanding = due.subtract(paid);
                return new PayrollTeacherRow(
                    rs.getObject("teacher_id", UUID.class), rs.getString("display_name"),
                    rs.getLong("session_count"), rs.getLong("minutes"), accrued, adjustments,
                    due, paid, outstanding, balanceStatus(outstanding));
            }).list();
    }

    private List<SalaryAccrualLine> accrualLines(UUID tenantId, UUID teacherId, YearMonth month) {
        return jdbc.sql("""
                SELECT sa.id, sa.session_id, c.code, c.name, s.ordinal,
                       (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS session_date,
                       sa.scheduled_minutes, sa.hourly_rate_snapshot, sa.amount,
                       sa.revision, sa.status, s.is_substitution
                FROM salary_accruals sa
                JOIN class_sessions s ON s.tenant_id=sa.tenant_id AND s.id=sa.session_id
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                WHERE sa.tenant_id=:tenantId AND sa.teacher_id=:teacherId
                  AND (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date>=:from
                  AND (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date<:to
                ORDER BY s.start_at DESC, c.name
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .param("from", month.atDay(1)).param("to", month.plusMonths(1).atDay(1))
            .query((rs, row) -> new SalaryAccrualLine(
                rs.getObject("id", UUID.class), rs.getObject("session_id", UUID.class),
                rs.getString("code"), rs.getString("name"), rs.getInt("ordinal"),
                rs.getObject("session_date", LocalDate.class), rs.getInt("scheduled_minutes"),
                rs.getBigDecimal("hourly_rate_snapshot"), rs.getBigDecimal("amount"),
                rs.getLong("revision"), SalaryDtos.AccrualStatus.valueOf(rs.getString("status")),
                rs.getBoolean("is_substitution"))).list();
    }

    private List<SalaryAdjustmentView> adjustments(UUID tenantId, UUID teacherId, YearMonth month) {
        return jdbc.sql("""
                SELECT a.id, a.teacher_id, u.display_name, a.salary_month, a.amount, a.reason,
                       a.version, a.created_at, a.updated_at
                FROM salary_adjustments a
                JOIN teacher_profiles t ON t.tenant_id=a.tenant_id AND t.id=a.teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE a.tenant_id=:tenantId AND a.teacher_id=:teacherId AND a.salary_month=:month
                ORDER BY a.created_at DESC
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .param("month", month.atDay(1)).query(this::mapAdjustment).list();
    }

    private List<SalaryPaymentView> payments(UUID tenantId, UUID teacherId, YearMonth month) {
        return jdbc.sql("""
                SELECT p.id, p.teacher_id, u.display_name, p.salary_month, p.paid_at, p.amount,
                       p.method, p.reference, p.overpayment_reason, p.version,
                       p.created_at, p.updated_at
                FROM salary_payments p
                JOIN teacher_profiles t ON t.tenant_id=p.tenant_id AND t.id=p.teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE p.tenant_id=:tenantId AND p.teacher_id=:teacherId AND p.salary_month=:month
                ORDER BY p.paid_at DESC, p.created_at DESC
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .param("month", month.atDay(1)).query(this::mapPayment).list();
    }

    private SalaryAdjustmentView adjustment(UUID tenantId, UUID id) {
        return jdbc.sql("""
                SELECT a.id, a.teacher_id, u.display_name, a.salary_month, a.amount, a.reason,
                       a.version, a.created_at, a.updated_at
                FROM salary_adjustments a
                JOIN teacher_profiles t ON t.tenant_id=a.tenant_id AND t.id=a.teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE a.tenant_id=:tenantId AND a.id=:id
                """)
            .param("tenantId", tenantId).param("id", id).query(this::mapAdjustment)
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "SALARY_ADJUSTMENT_NOT_FOUND", "Không tìm thấy điều chỉnh lương."));
    }

    private SalaryPaymentView payment(UUID tenantId, UUID id) {
        return jdbc.sql("""
                SELECT p.id, p.teacher_id, u.display_name, p.salary_month, p.paid_at, p.amount,
                       p.method, p.reference, p.overpayment_reason, p.version,
                       p.created_at, p.updated_at
                FROM salary_payments p
                JOIN teacher_profiles t ON t.tenant_id=p.tenant_id AND t.id=p.teacher_id
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE p.tenant_id=:tenantId AND p.id=:id
                """)
            .param("tenantId", tenantId).param("id", id).query(this::mapPayment)
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "SALARY_PAYMENT_NOT_FOUND", "Không tìm thấy thanh toán lương."));
    }

    private SalaryAdjustmentView mapAdjustment(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new SalaryAdjustmentView(
            rs.getObject("id", UUID.class), rs.getObject("teacher_id", UUID.class),
            rs.getString("display_name"), YearMonth.from(rs.getObject("salary_month", LocalDate.class)),
            rs.getBigDecimal("amount"), rs.getString("reason"), rs.getLong("version"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class));
    }

    private SalaryPaymentView mapPayment(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new SalaryPaymentView(
            rs.getObject("id", UUID.class), rs.getObject("teacher_id", UUID.class),
            rs.getString("display_name"), YearMonth.from(rs.getObject("salary_month", LocalDate.class)),
            rs.getObject("paid_at", LocalDate.class), rs.getBigDecimal("amount"),
            PaymentMethod.valueOf(rs.getString("method")), rs.getString("reference"),
            rs.getString("overpayment_reason"), rs.getLong("version"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class));
    }

    private HourlyRateView hourlyRate(UUID tenantId, UUID id) {
        return jdbc.sql("""
                SELECT x.id, x.class_id, x.effective_date, x.effective_to, x.hourly_rate,
                       x.version, x.created_at, x.updated_at
                FROM (
                  SELECT id, class_id, effective_date,
                         (lead(effective_date) OVER (PARTITION BY class_id ORDER BY effective_date) - 1) AS effective_to,
                         hourly_rate, version, created_at, updated_at
                  FROM class_hourly_rates WHERE tenant_id=:tenantId
                ) x WHERE x.id=:id
                """)
            .param("tenantId", tenantId).param("id", id)
            .query((rs, row) -> new HourlyRateView(
                rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
                rs.getObject("effective_date", LocalDate.class),
                rs.getObject("effective_to", LocalDate.class), rs.getBigDecimal("hourly_rate"),
                rs.getLong("version"), rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "HOURLY_RATE_NOT_FOUND", "Không tìm thấy đơn giá của lớp."));
    }

    private void reconcileClass(UUID tenantId, UUID classId, String reason) {
        List<UUID> sessions = jdbc.sql("""
                SELECT id FROM class_sessions
                WHERE tenant_id=:tenantId AND class_id=:classId AND status='COMPLETED'
                ORDER BY start_at
                """)
            .param("tenantId", tenantId).param("classId", classId).query(UUID.class).list();
        for (UUID sessionId : sessions) {
            accruals.reconcile(tenantId, sessionId, actor.userId(), reason);
        }
    }

    private BigDecimal currentOutstanding(UUID tenantId, UUID teacherId, YearMonth month) {
        return teacherRows(tenantId, month).stream()
            .filter(row -> row.teacherId().equals(teacherId))
            .findFirst().map(PayrollTeacherRow::outstanding).orElse(ZERO);
    }

    private void requireOverpaymentConfirmation(UUID tenantId, UUID teacherId, YearMonth month,
                                                BigDecimal amount, BigDecimal restoredOldPayment,
                                                boolean confirmed, String reason) {
        BigDecimal available = currentOutstanding(tenantId, teacherId, month)
            .add(restoredOldPayment).max(ZERO);
        if (amount.compareTo(available) > 0 && (!confirmed || blankToNull(reason) == null)) {
            throw new ApiException(HttpStatus.CONFLICT, "OVERPAYMENT_CONFIRMATION_REQUIRED",
                "Số tiền vượt số còn phải trả. Cần xác nhận và nhập lý do.",
                java.util.Map.of("outstanding", available, "requestedAmount", amount));
        }
    }

    private void validatePayment(PaymentMethod method, String reference) {
        if (method == PaymentMethod.BANK_TRANSFER && blankToNull(reference) == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_REFERENCE_REQUIRED",
                "Thanh toán chuyển khoản bắt buộc có mã tham chiếu.");
        }
    }

    private void validateNonZero(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ADJUSTMENT_AMOUNT_REQUIRED",
                "Số tiền điều chỉnh phải khác 0.");
        }
    }

    private String requireTeacher(UUID tenantId, UUID teacherId) {
        return jdbc.sql("""
                SELECT u.display_name FROM teacher_profiles t
                JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id
                WHERE t.tenant_id=:tenantId AND t.id=:teacherId
                """)
            .param("tenantId", tenantId).param("teacherId", teacherId)
            .query(String.class).optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "TEACHER_NOT_FOUND", "Không tìm thấy giáo viên."));
    }

    private void requireClass(UUID tenantId, UUID classId) {
        boolean exists = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM classes WHERE tenant_id=:tenantId AND id=:classId)
                """).param("tenantId", tenantId).param("classId", classId)
            .query(Boolean.class).single();
        if (!exists) throw new ApiException(HttpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
    }

    private CompletionRow completionRow(UUID tenantId, UUID sessionId, boolean lock) {
        return jdbc.sql("""
                SELECT id, start_at, end_at, actual_teacher_id, status, version
                FROM class_sessions WHERE tenant_id=:tenantId AND id=:sessionId
                """ + (lock ? " FOR UPDATE" : ""))
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new CompletionRow(
                rs.getObject("id", UUID.class), rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getObject("actual_teacher_id", UUID.class), rs.getString("status"),
                rs.getLong("version")))
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Không tìm thấy buổi học."));
    }

    private Comparator<PayrollTeacherRow> comparator(String sort) {
        String value = sort == null ? "teacherName" : sort;
        boolean descending = value.startsWith("-");
        String field = descending ? value.substring(1) : value;
        Comparator<PayrollTeacherRow> comparator = switch (field) {
            case "accrued" -> Comparator.comparing(PayrollTeacherRow::accrued);
            case "paid" -> Comparator.comparing(PayrollTeacherRow::paid);
            case "outstanding" -> Comparator.comparing(PayrollTeacherRow::outstanding);
            case "totalMinutes" -> Comparator.comparingLong(PayrollTeacherRow::totalMinutes);
            default -> Comparator.comparing(PayrollTeacherRow::teacherName,
                String.CASE_INSENSITIVE_ORDER);
        };
        if (descending) comparator = comparator.reversed();
        return comparator.thenComparing(row -> row.teacherId().toString());
    }

    private PayrollMetrics metrics(List<PayrollTeacherRow> rows) {
        return new PayrollMetrics(rows.size(), rows.stream().mapToLong(PayrollTeacherRow::sessionCount).sum(),
            rows.stream().mapToLong(PayrollTeacherRow::totalMinutes).sum(),
            sum(rows, PayrollTeacherRow::accrued), sum(rows, PayrollTeacherRow::adjustments),
            sum(rows, PayrollTeacherRow::due), sum(rows, PayrollTeacherRow::paid),
            sum(rows, PayrollTeacherRow::outstanding),
            rows.stream().filter(row -> row.status() == BalanceStatus.OVERPAID).count());
    }

    private BigDecimal sum(List<PayrollTeacherRow> rows,
                           java.util.function.Function<PayrollTeacherRow, BigDecimal> mapper) {
        return rows.stream().map(mapper).reduce(ZERO, BigDecimal::add);
    }

    private BalanceStatus balanceStatus(BigDecimal outstanding) {
        int comparison = outstanding.compareTo(BigDecimal.ZERO);
        if (comparison > 0) return BalanceStatus.OWED;
        if (comparison < 0) return BalanceStatus.OVERPAID;
        return BalanceStatus.SETTLED;
    }

    private void validatePage(int page, int pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                "page phải từ 1 và pageSize trong khoảng 1–100.");
        }
    }

    private ApiException stale(String resource) {
        return new ApiException(HttpStatus.CONFLICT, "OPTIMISTIC_LOCK_CONFLICT",
            resource + " đã được thay đổi. Vui lòng tải lại.");
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record RateAudit(HourlyRateView rate, String reason) {
    }
    private record CompletionAudit(CompletionRow session, String reason) {
    }
    private record TransactionAudit(Object transaction, String editReason) {
    }
    private record CompletionRow(
        UUID id, OffsetDateTime startAt, OffsetDateTime endAt, UUID teacherId,
        String status, long version
    ) {
    }
    private record TeacherIdentity(UUID id, String name) {
    }
}
