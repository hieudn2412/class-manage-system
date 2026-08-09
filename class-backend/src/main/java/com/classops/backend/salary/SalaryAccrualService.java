package com.classops.backend.salary;

import com.classops.backend.common.ApiException;
import com.classops.backend.salary.SalaryDtos.AccrualStatus;
import com.classops.backend.teaching.TeachingProperties;
import com.classops.backend.teaching.TeachingSupport;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class SalaryAccrualService {
    private final JdbcClient jdbc;
    private final TeachingProperties properties;
    private final TeachingSupport support;

    public SalaryAccrualService(JdbcClient jdbc, TeachingProperties properties,
                                TeachingSupport support) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.support = support;
    }

    @Transactional
    public AccrualResult reconcile(UUID tenantId, UUID sessionId, UUID actorId, String reason) {
        SessionBasis session = jdbc.sql("""
                SELECT id, tenant_id, class_id, start_at, end_at, actual_teacher_id, status
                FROM class_sessions
                WHERE tenant_id=:tenantId AND id=:sessionId
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new SessionBasis(
                rs.getObject("id", UUID.class), rs.getObject("tenant_id", UUID.class),
                rs.getObject("class_id", UUID.class),
                rs.getObject("start_at", OffsetDateTime.class),
                rs.getObject("end_at", OffsetDateTime.class),
                rs.getObject("actual_teacher_id", UUID.class), rs.getString("status")))
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Không tìm thấy buổi học."));
        AccrualRow existing = existing(tenantId, sessionId);
        if (!"COMPLETED".equals(session.status())) {
            return reverse(existing, actorId, reason);
        }

        int minutes = Math.toIntExact(Duration.between(
            session.startAt().toInstant(), session.endAt().toInstant()).toMinutes());
        if (minutes <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SESSION_DURATION",
                "Thời lượng buổi học phải lớn hơn 0 phút.");
        }
        var sessionDate = session.startAt().atZoneSameInstant(properties.zoneId()).toLocalDate();
        BigDecimal rate = jdbc.sql("""
                SELECT hourly_rate FROM class_hourly_rates
                WHERE tenant_id=:tenantId AND class_id=:classId
                  AND effective_date <= :sessionDate
                ORDER BY effective_date DESC
                LIMIT 1
                """)
            .param("tenantId", tenantId).param("classId", session.classId())
            .param("sessionDate", sessionDate).query(BigDecimal.class)
            .optional().orElseThrow(() -> new ApiException(
                HttpStatus.CONFLICT, "HOURLY_RATE_NOT_FOUND",
                "Không tìm thấy đơn giá có hiệu lực cho buổi học."));
        BigDecimal amount = rate.multiply(BigDecimal.valueOf(minutes))
            .divide(BigDecimal.valueOf(60), 0, RoundingMode.HALF_UP);

        if (existing == null) {
            UUID id = UUID.randomUUID();
            jdbc.sql("""
                    INSERT INTO salary_accruals (
                      id, tenant_id, session_id, teacher_id, scheduled_minutes,
                      hourly_rate_snapshot, amount, status
                    ) VALUES (
                      :id, :tenantId, :sessionId, :teacherId, :minutes, :rate, :amount, 'ACTIVE'
                    )
                    """)
                .param("id", id).param("tenantId", tenantId).param("sessionId", sessionId)
                .param("teacherId", session.teacherId()).param("minutes", minutes)
                .param("rate", rate).param("amount", amount).update();
            AccrualResult created = new AccrualResult(id, sessionId, session.teacherId(), minutes,
                rate, amount, 0, AccrualStatus.ACTIVE);
            support.audit(tenantId, actorId, actorId == null ? "SYSTEM" : "USER",
                "SALARY_ACCRUAL_CREATED", "SALARY_ACCRUAL", id, null,
                new AccrualAudit(created, reason));
            return created;
        }

        boolean unchanged = existing.teacherId().equals(session.teacherId())
            && existing.minutes() == minutes
            && existing.rate().compareTo(rate) == 0
            && existing.amount().compareTo(amount) == 0
            && existing.status() == AccrualStatus.ACTIVE;
        if (unchanged) {
            return result(existing);
        }
        AccrualResult oldValue = result(existing);
        long nextRevision = existing.revision() + 1;
        jdbc.sql("""
                UPDATE salary_accruals
                SET teacher_id=:teacherId, scheduled_minutes=:minutes,
                    hourly_rate_snapshot=:rate, amount=:amount, status='ACTIVE',
                    revision=:revision, updated_at=now()
                WHERE tenant_id=:tenantId AND id=:id
                """)
            .param("teacherId", session.teacherId()).param("minutes", minutes)
            .param("rate", rate).param("amount", amount).param("revision", nextRevision)
            .param("tenantId", tenantId).param("id", existing.id()).update();
        AccrualResult updated = new AccrualResult(existing.id(), sessionId, session.teacherId(),
            minutes, rate, amount, nextRevision, AccrualStatus.ACTIVE);
        support.audit(tenantId, actorId, actorId == null ? "SYSTEM" : "USER",
            "SALARY_ACCRUAL_RECALCULATED", "SALARY_ACCRUAL", existing.id(),
            new AccrualAudit(oldValue, reason), new AccrualAudit(updated, reason));
        return updated;
    }

    private AccrualResult reverse(AccrualRow existing, UUID actorId, String reason) {
        if (existing == null || existing.status() == AccrualStatus.REVERSED) {
            return existing == null ? null : result(existing);
        }
        AccrualResult oldValue = result(existing);
        long nextRevision = existing.revision() + 1;
        jdbc.sql("""
                UPDATE salary_accruals
                SET status='REVERSED', revision=:revision, updated_at=now()
                WHERE tenant_id=:tenantId AND id=:id
                """)
            .param("revision", nextRevision).param("tenantId", existing.tenantId())
            .param("id", existing.id()).update();
        AccrualResult reversed = new AccrualResult(existing.id(), existing.sessionId(),
            existing.teacherId(), existing.minutes(), existing.rate(), existing.amount(),
            nextRevision, AccrualStatus.REVERSED);
        support.audit(existing.tenantId(), actorId, actorId == null ? "SYSTEM" : "USER",
            "SALARY_ACCRUAL_REVERSED", "SALARY_ACCRUAL", existing.id(),
            new AccrualAudit(oldValue, reason), new AccrualAudit(reversed, reason));
        return reversed;
    }

    private AccrualRow existing(UUID tenantId, UUID sessionId) {
        return jdbc.sql("""
                SELECT id, tenant_id, session_id, teacher_id, scheduled_minutes,
                       hourly_rate_snapshot, amount, revision, status
                FROM salary_accruals
                WHERE tenant_id=:tenantId AND session_id=:sessionId
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new AccrualRow(
                rs.getObject("id", UUID.class), rs.getObject("tenant_id", UUID.class),
                rs.getObject("session_id", UUID.class), rs.getObject("teacher_id", UUID.class),
                rs.getInt("scheduled_minutes"), rs.getBigDecimal("hourly_rate_snapshot"),
                rs.getBigDecimal("amount"), rs.getLong("revision"),
                AccrualStatus.valueOf(rs.getString("status"))))
            .optional().orElse(null);
    }

    private AccrualResult result(AccrualRow row) {
        return new AccrualResult(row.id(), row.sessionId(), row.teacherId(), row.minutes(),
            row.rate(), row.amount(), row.revision(), row.status());
    }

    public record AccrualResult(
        UUID id, UUID sessionId, UUID teacherId, int minutes, BigDecimal hourlyRate,
        BigDecimal amount, long revision, AccrualStatus status
    ) {
    }

    private record AccrualAudit(AccrualResult accrual, String reason) {
    }
    private record SessionBasis(
        UUID id, UUID tenantId, UUID classId, OffsetDateTime startAt, OffsetDateTime endAt,
        UUID teacherId, String status
    ) {
    }
    private record AccrualRow(
        UUID id, UUID tenantId, UUID sessionId, UUID teacherId, int minutes, BigDecimal rate,
        BigDecimal amount, long revision, AccrualStatus status
    ) {
    }
}
