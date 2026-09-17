package com.classops.backend.learningcontent;

import com.classops.backend.common.ApiException;
import com.classops.backend.common.PageResponse;
import com.classops.backend.learningcontent.ContentDtos.AuditTimelineItem;
import com.classops.backend.learningcontent.ContentDtos.CreateHomeworkInput;
import com.classops.backend.learningcontent.ContentDtos.CreateMaterialInput;
import com.classops.backend.learningcontent.ContentDtos.FilePurpose;
import com.classops.backend.learningcontent.ContentDtos.HomeworkDetail;
import com.classops.backend.learningcontent.ContentDtos.HomeworkLinkInput;
import com.classops.backend.learningcontent.ContentDtos.HomeworkRecipientView;
import com.classops.backend.learningcontent.ContentDtos.HomeworkReportRow;
import com.classops.backend.learningcontent.ContentDtos.HomeworkResourceView;
import com.classops.backend.learningcontent.ContentDtos.HomeworkSummary;
import com.classops.backend.learningcontent.ContentDtos.MaterialView;
import com.classops.backend.learningcontent.ContentDtos.NotificationView;
import com.classops.backend.learningcontent.ContentDtos.RecipientInput;
import com.classops.backend.learningcontent.ContentDtos.ReopenInput;
import com.classops.backend.learningcontent.ContentDtos.ReviewInput;
import com.classops.backend.learningcontent.ContentDtos.ReviewView;
import com.classops.backend.learningcontent.ContentDtos.StoredFileView;
import com.classops.backend.learningcontent.ContentDtos.StudentHomeworkDetail;
import com.classops.backend.learningcontent.ContentDtos.StudentHomeworkSummary;
import com.classops.backend.learningcontent.ContentDtos.SubmissionView;
import com.classops.backend.learningcontent.ContentDtos.SubmitHomeworkInput;
import com.classops.backend.learningcontent.ContentDtos.TenantStorageUsage;
import com.classops.backend.learningcontent.ContentDtos.UpdateHomeworkInput;
import com.classops.backend.learningcontent.ContentDtos.UpdateMaterialInput;
import com.classops.backend.learningcontent.ContentDtos.VersionInput;
import com.classops.backend.security.CurrentActor;
import com.classops.backend.teaching.TeachingSupport;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class LearningContentService {
    private static final Set<String> CLASS_ACCESS_STATES = Set.of("SCHEDULED", "ACTIVE", "AWAITING_CLOSE");

    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final TeachingSupport support;
    private final FileStorageService storage;
    private final ContentNotificationService notifications;
    private final MaintenanceWriteGuard maintenance;
    private final Clock clock;

    public LearningContentService(JdbcClient jdbc, CurrentActor actor, TeachingSupport support,
                                  FileStorageService storage,
                                  ContentNotificationService notifications,
                                  MaintenanceWriteGuard maintenance, Clock clock) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.support = support;
        this.storage = storage;
        this.notifications = notifications;
        this.maintenance = maintenance;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<HomeworkSummary> classHomeworks(UUID classId, UUID sessionId, String status,
                                                        int page, int pageSize) {
        page(page, pageSize);
        UUID tenantId = actor.tenantId();
        requireClassContentAccess(tenantId, classId, sessionId);
        String normalized = safe(status).trim().toUpperCase(Locale.ROOT);
        boolean filterBySession = sessionId != null;
        long total = jdbc.sql("""
                SELECT count(*) FROM homeworks h
                WHERE h.tenant_id=:tenantId AND h.class_id=:classId
                  AND (:filterBySession=false OR h.session_id=:sessionId)
                  AND (:status='' OR h.status=:status)
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("filterBySession", filterBySession).param("sessionId", sessionId)
            .param("status", normalized)
            .query(Long.class).single();
        List<HomeworkSummary> items = jdbc.sql(summarySql() + """
                WHERE h.tenant_id=:tenantId AND h.class_id=:classId
                  AND (:filterBySession=false OR h.session_id=:sessionId)
                  AND (:status='' OR h.status=:status)
                GROUP BY h.id, h.class_id, h.session_id, c.code, c.name, s.ordinal,
                         h.title, h.status, h.deadline_at, h.version, h.updated_at, h.created_at
                ORDER BY h.updated_at DESC, h.created_at DESC
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("filterBySession", filterBySession).param("sessionId", sessionId)
            .param("status", normalized)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> mapSummary(rs)).list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public PageResponse<StudentHomeworkSummary> studentHomeworks(String status, int page, int pageSize) {
        page(page, pageSize);
        UUID tenantId = actor.tenantId();
        UUID studentId = currentStudent(tenantId);
        String normalized = safe(status).trim().toUpperCase(Locale.ROOT);
        String visible = """
                h.tenant_id=:tenantId
                AND (h.session_id IS NULL OR h.is_session_primary)
                AND h.status IN ('PUBLISHED', 'CLOSED')
                AND hr.student_id=:studentId
                AND hr.removed_at IS NULL
                AND c.status IN ('SCHEDULED','ACTIVE','AWAITING_CLOSE')
                AND EXISTS (
                  SELECT 1 FROM class_enrollments e
                  WHERE e.tenant_id=h.tenant_id AND e.class_id=h.class_id
                    AND e.student_id=:studentId AND e.status='ACTIVE'
                )
                AND (:status='' OR h.status=:status)
                """;
        long total = jdbc.sql("""
                SELECT count(*) FROM homeworks h
                JOIN classes c ON c.tenant_id=h.tenant_id AND c.id=h.class_id
                JOIN homework_recipients hr ON hr.tenant_id=h.tenant_id AND hr.homework_id=h.id
                WHERE
                """ + visible)
            .param("tenantId", tenantId).param("studentId", studentId).param("status", normalized)
            .query(Long.class).single();
        List<StudentHomeworkSummary> items = jdbc.sql(studentSummarySql() + """
                WHERE
                """ + visible + """
                GROUP BY h.id, h.class_id, h.session_id, c.code, c.name, s.ordinal,
                         h.title, h.status, h.deadline_at, h.version, h.updated_at,
                         latest.submitted_at, latest.review_status
                ORDER BY h.deadline_at NULLS LAST, h.updated_at DESC
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("studentId", studentId).param("status", normalized)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> mapStudentSummary(rs)).list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional
    public HomeworkDetail createHomework(UUID classId, CreateHomeworkInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        requireCreateHomeworkAccess(tenantId, classId, input.sessionId());
        String operation = "CREATE_HOMEWORK:" + classId;
        String hash = support.requestHash(input);
        HomeworkDetail repeated = support.repeated(tenantId, operation, idempotencyKey, hash, HomeworkDetail.class);
        if (repeated != null) return repeated;
        String audience = normalizeAudience(input.audienceType());
        if ("SELECTED".equals(audience) && input.studentIds().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "HOMEWORK_RECIPIENTS_REQUIRED",
                "Cần chọn ít nhất một học sinh nhận bài.");
        }
        if ("SELECTED".equals(audience) && input.sessionId() != null) {
            requireSessionRosterRecipients(tenantId, classId, input.sessionId(), input.studentIds());
        }
        if (input.sessionId() != null) {
            lockSessionForHomework(tenantId, classId, input.sessionId());
            UUID existingHomeworkId = primarySessionHomeworkId(tenantId, input.sessionId());
            if (existingHomeworkId != null) {
                throw new ApiException(HttpStatus.CONFLICT, "HOMEWORK_ALREADY_EXISTS_FOR_SESSION",
                    "Buổi này đã có BTVN. Vui lòng mở bài hiện có để sửa.",
                    Map.of("homeworkId", existingHomeworkId));
            }
        }
        List<UUID> recipientIds = "CLASS".equals(audience)
            ? activeStudents(tenantId, classId)
            : input.studentIds();
        if (recipientIds.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "HOMEWORK_RECIPIENTS_REQUIRED",
                "Cần ít nhất một học sinh nhận bài trước khi giao.");
        }
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO homeworks (
                  id, tenant_id, class_id, session_id, title, description, deadline_at,
                  audience_type, status, published_at, is_session_primary, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, :classId, :sessionId, :title, :description, :deadlineAt,
                  :audience, 'PUBLISHED', now(), :isSessionPrimary, :actorId, :actorId
                )
                """)
            .param("id", id).param("tenantId", tenantId).param("classId", classId)
            .param("sessionId", input.sessionId()).param("title", input.title().trim())
            .param("description", clean(input.description())).param("deadlineAt", input.deadlineAt())
            .param("audience", audience).param("isSessionPrimary", input.sessionId() != null)
            .param("actorId", actor.userId()).update();
        replaceHomeworkResources(tenantId, id, input.fileTokens(), input.links(), "homework created");
        addRecipientsLocked(tenantId, id, classId, recipientIds);
        notifyHomeworkStudents(tenantId, id, "HOMEWORK_PUBLISHED",
            "Bạn có BTVN mới", input.title().trim());
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_CREATED",
            "HOMEWORK", id, null, Map.of("title", input.title(), "classId", classId, "status", "PUBLISHED"));
        HomeworkDetail result = homeworkDetail(tenantId, id);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, result);
        return result;
    }

    @Transactional
    public HomeworkDetail updateHomework(UUID homeworkId, UpdateHomeworkInput input) {
        maintenance.requireWritable();
        UUID tenantId = actor.tenantId();
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        requireManageHomework(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), input.version());
        if (!Set.of("DRAFT", "PUBLISHED", "CLOSED").contains(row.status())) {
            throw conflict("Chỉ được sửa bài đang Draft, Published hoặc Closed.");
        }
        HomeworkDetail oldValue = homeworkDetail(tenantId, homeworkId);
        int updated = jdbc.sql("""
                UPDATE homeworks
                SET title=:title, description=:description, deadline_at=:deadlineAt,
                    updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id AND version=:version
                """)
            .param("title", input.title().trim()).param("description", clean(input.description()))
            .param("deadlineAt", input.deadlineAt()).param("actorId", actor.userId())
            .param("tenantId", tenantId).param("id", homeworkId).param("version", input.version())
            .update();
        if (updated == 0) throw stale();
        replaceHomeworkResources(tenantId, homeworkId, input.fileIds(), input.fileTokens(), input.links(), "homework resource replaced");
        notifyHomeworkStudents(tenantId, homeworkId, "HOMEWORK_UPDATED",
            "BTVN đã được cập nhật", input.title().trim());
        HomeworkDetail result = homeworkDetail(tenantId, homeworkId);
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_UPDATED",
            "HOMEWORK", homeworkId, oldValue, result);
        return result;
    }

    @Transactional
    public HomeworkDetail publishHomework(UUID homeworkId, VersionInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "PUBLISH_HOMEWORK:" + homeworkId;
        String hash = support.requestHash(input);
        HomeworkDetail repeated = support.repeated(tenantId, operation, idempotencyKey, hash, HomeworkDetail.class);
        if (repeated != null) return repeated;
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        requireManageHomework(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), input.version());
        if (!"DRAFT".equals(row.status())) throw conflict("Chỉ Draft mới được publish.");
        if ("CLASS".equals(row.audienceType())) {
            List<UUID> students = activeStudents(tenantId, row.classId());
            addRecipientsLocked(tenantId, homeworkId, row.classId(), students);
        }
        int recipients = recipientCount(tenantId, homeworkId);
        if (recipients == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "HOMEWORK_RECIPIENTS_REQUIRED",
                "Cần ít nhất một học sinh nhận bài trước khi publish.");
        }
        jdbc.sql("""
                UPDATE homeworks
                SET status='PUBLISHED', published_at=now(), updated_by=:actorId,
                    updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id
                """)
            .param("actorId", actor.userId()).param("tenantId", tenantId).param("id", homeworkId).update();
        notifyHomeworkStudents(tenantId, homeworkId, "HOMEWORK_PUBLISHED",
            "Bạn có BTVN mới", row.title());
        HomeworkDetail result = homeworkDetail(tenantId, homeworkId);
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_PUBLISHED",
            "HOMEWORK", homeworkId, Map.of("status", "DRAFT"), Map.of("status", "PUBLISHED"));
        support.remember(tenantId, operation, idempotencyKey, hash, 200, result);
        return result;
    }

    @Transactional
    public HomeworkDetail closeHomework(UUID homeworkId, VersionInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "CLOSE_HOMEWORK:" + homeworkId;
        String hash = support.requestHash(input);
        HomeworkDetail repeated = support.repeated(tenantId, operation, idempotencyKey, hash, HomeworkDetail.class);
        if (repeated != null) return repeated;
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        requireManageHomework(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), input.version());
        if (!"PUBLISHED".equals(row.status())) throw conflict("Chỉ bài đang mở mới được đóng.");
        jdbc.sql("""
                UPDATE homeworks
                SET status='CLOSED', closed_at=now(), updated_by=:actorId,
                    updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id
                """)
            .param("actorId", actor.userId()).param("tenantId", tenantId).param("id", homeworkId).update();
        notifyHomeworkStudents(tenantId, homeworkId, "HOMEWORK_CLOSED",
            "BTVN đã đóng", row.title());
        HomeworkDetail result = homeworkDetail(tenantId, homeworkId);
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_CLOSED",
            "HOMEWORK", homeworkId, Map.of("status", "PUBLISHED"), Map.of("status", "CLOSED"));
        support.remember(tenantId, operation, idempotencyKey, hash, 200, result);
        return result;
    }

    @Transactional
    public HomeworkDetail reopenHomework(UUID homeworkId, ReopenInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        String operation = "REOPEN_HOMEWORK:" + homeworkId;
        String hash = support.requestHash(input);
        HomeworkDetail repeated = support.repeated(tenantId, operation, idempotencyKey, hash, HomeworkDetail.class);
        if (repeated != null) return repeated;
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        requireManageHomework(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), input.version());
        requireClassActive(tenantId, row.classId());
        if (!"CLOSED".equals(row.status())) throw conflict("Chỉ bài đã đóng mới được mở lại.");
        jdbc.sql("""
                UPDATE homeworks
                SET status='PUBLISHED', reopened_at=now(), reopen_reason=:reason,
                    updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id
                """)
            .param("reason", input.reason().trim()).param("actorId", actor.userId())
            .param("tenantId", tenantId).param("id", homeworkId).update();
        notifyHomeworkStudents(tenantId, homeworkId, "HOMEWORK_REOPENED",
            "BTVN đã mở lại", row.title());
        HomeworkDetail result = homeworkDetail(tenantId, homeworkId);
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_REOPENED",
            "HOMEWORK", homeworkId, Map.of("status", "CLOSED"),
            Map.of("status", "PUBLISHED", "reason", input.reason()));
        support.remember(tenantId, operation, idempotencyKey, hash, 200, result);
        return result;
    }

    @Transactional
    public HomeworkDetail addRecipients(UUID homeworkId, RecipientInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        requireManageHomework(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), input.version());
        addRecipientsLocked(tenantId, homeworkId, row.classId(), input.studentIds());
        jdbc.sql("""
                UPDATE homeworks
                SET updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id
                """).param("actorId", actor.userId()).param("tenantId", tenantId).param("id", homeworkId).update();
        notifyUsers(tenantId, input.studentIds(), "HOMEWORK_ASSIGNED",
            "Bạn được thêm vào BTVN", row.title(), "/homeworks/" + homeworkId, "recipient-added:" + homeworkId);
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_RECIPIENTS_ADDED",
            "HOMEWORK", homeworkId, null, Map.of("studentIds", input.studentIds()));
        return homeworkDetail(tenantId, homeworkId);
    }

    @Transactional
    public HomeworkDetail removeRecipient(UUID homeworkId, UUID studentId, long version) {
        maintenance.requireWritable();
        UUID tenantId = actor.tenantId();
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        requireManageHomework(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), version);
        boolean submitted = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM homework_submissions
                  WHERE tenant_id=:tenantId AND homework_id=:homeworkId AND student_id=:studentId)
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).param("studentId", studentId)
            .query(Boolean.class).single();
        if (submitted) {
            throw new ApiException(HttpStatus.CONFLICT, "RECIPIENT_HAS_SUBMISSION",
                "Không thể bỏ học sinh đã từng nộp bài.");
        }
        jdbc.sql("""
                UPDATE homework_recipients
                SET removed_at=now(), removed_by=:actorId
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId AND student_id=:studentId
                """)
            .param("actorId", actor.userId()).param("tenantId", tenantId)
            .param("homeworkId", homeworkId).param("studentId", studentId).update();
        jdbc.sql("""
                UPDATE homeworks
                SET updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id
                """).param("actorId", actor.userId()).param("tenantId", tenantId).param("id", homeworkId).update();
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_RECIPIENT_REMOVED",
            "HOMEWORK", homeworkId, null, Map.of("studentId", studentId));
        return homeworkDetail(tenantId, homeworkId);
    }

    @Transactional(readOnly = true)
    public HomeworkDetail homework(UUID homeworkId) {
        UUID tenantId = actor.tenantId();
        HomeworkRow row = homeworkRow(tenantId, homeworkId);
        requireHomeworkRead(tenantId, row);
        return homeworkDetail(tenantId, homeworkId);
    }

    @Transactional(readOnly = true)
    public StudentHomeworkDetail studentHomework(UUID homeworkId) {
        UUID tenantId = actor.tenantId();
        UUID studentId = currentStudent(tenantId);
        HomeworkRow row = homeworkRow(tenantId, homeworkId);
        requireStudentHomeworkAccess(tenantId, studentId, row.classId(), homeworkId);
        if (!Set.of("PUBLISHED", "CLOSED").contains(row.status())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "HOMEWORK_NOT_FOUND", "Không tìm thấy BTVN.");
        }
        HomeworkHead head = homeworkHead(tenantId, homeworkId);
        List<SubmissionView> mine = submissionsForStudent(tenantId, homeworkId, studentId);
        SubmissionView latest = mine.stream().filter(submission -> submission.reviewStatus() != null)
            .findFirst().orElse(null);
        HomeworkRecipientView recipient = recipient(tenantId, homeworkId, studentId);
        return new StudentHomeworkDetail(head.id(), head.classId(), head.sessionId(), head.classCode(),
            head.className(), head.sessionOrdinal(), head.title(), head.description(), head.audienceType(),
            head.status(), head.deadlineAt(), head.publishedAt(), head.closedAt(),
            homeworkResources(tenantId, homeworkId), recipient, mine,
            latest == null ? "ASSIGNED" : latest.reviewStatus(), latest == null ? null : latest.submittedAt(),
            deadlineState(head.status(), head.deadlineAt()), "PUBLISHED".equals(head.status()), head.version());
    }

    @Transactional
    public SubmissionView submit(UUID homeworkId, SubmitHomeworkInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        UUID studentId = currentStudent(tenantId);
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        if (!"PUBLISHED".equals(row.status())) throw conflict("BTVN không còn mở để nộp.");
        requireStudentHomeworkAccess(tenantId, studentId, row.classId(), homeworkId);
        if (input.fileTokens().size() > 10) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SUBMISSION_FILE_LIMIT",
                "Mỗi lượt nộp tối đa 10 ảnh.");
        }
        String operation = "SUBMIT_HOMEWORK:" + homeworkId + ":" + studentId;
        String hash = support.requestHash(input);
        SubmissionView repeated = support.repeated(tenantId, operation, idempotencyKey, hash, SubmissionView.class);
        if (repeated != null) return repeated;
        jdbc.sql("""
                UPDATE homework_submissions
                SET current_attempt=false
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId
                  AND student_id=:studentId AND current_attempt=true
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).param("studentId", studentId).update();
        int attempt = jdbc.sql("""
                SELECT COALESCE(max(attempt_no),0)+1 FROM homework_submissions
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId AND student_id=:studentId
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).param("studentId", studentId)
            .query(Integer.class).single();
        UUID submissionId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        boolean late = row.deadlineAt() != null && now.isAfter(row.deadlineAt());
        jdbc.sql("""
                INSERT INTO homework_submissions (
                  id, tenant_id, homework_id, student_id, attempt_no, note,
                  submitted_at, deadline_snapshot, late, current_attempt, review_status
                ) VALUES (
                  :id, :tenantId, :homeworkId, :studentId, :attempt, :note,
                  :now, :deadlineAt, :late, true, 'WAITING_REVIEW'
                )
                """)
            .param("id", submissionId).param("tenantId", tenantId).param("homeworkId", homeworkId)
            .param("studentId", studentId).param("attempt", attempt).param("note", clean(input.note()))
            .param("now", now).param("deadlineAt", row.deadlineAt()).param("late", late).update();
        int sort = 0;
        for (String token : input.fileTokens()) {
            UUID fileId = storage.promote(tenantId, token, FilePurpose.SUBMISSION_IMAGE);
            jdbc.sql("""
                    INSERT INTO homework_submission_files (tenant_id, submission_id, file_id, sort_order)
                    VALUES (:tenantId, :submissionId, :fileId, :sortOrder)
                    """)
                .param("tenantId", tenantId).param("submissionId", submissionId)
                .param("fileId", fileId).param("sortOrder", sort++).update();
        }
        notifyResponsibleTeachers(tenantId, row, "HOMEWORK_SUBMITTED",
            "Có lượt nộp BTVN mới", row.title());
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_SUBMITTED",
            "HOMEWORK_SUBMISSION", submissionId, null,
            Map.of("homeworkId", homeworkId, "studentId", studentId, "attemptNo", attempt, "late", late));
        SubmissionView result = submission(tenantId, submissionId);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, result);
        return result;
    }

    @Transactional
    public SubmissionView review(UUID homeworkId, UUID submissionId, ReviewInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        HomeworkRow row = lockHomework(tenantId, homeworkId);
        requireReviewHomework(tenantId, row.classId(), row.sessionId());
        String status = normalizeReviewStatus(input.status());
        SubmissionLock submission = jdbc.sql("""
                SELECT id, student_id, version, current_attempt
                FROM homework_submissions
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId AND id=:submissionId
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).param("submissionId", submissionId)
            .query((rs, r) -> new SubmissionLock(rs.getObject("id", UUID.class),
                rs.getObject("student_id", UUID.class), rs.getLong("version"), rs.getBoolean("current_attempt")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "SUBMISSION_NOT_FOUND", "Không tìm thấy lượt nộp."));
        if (!submission.currentAttempt()) throw conflict("Chỉ được chữa lượt nộp hiện tại.");
        requireVersion(submission.version(), input.submissionVersion());
        String operation = "REVIEW_HOMEWORK:" + submissionId;
        String hash = support.requestHash(input);
        SubmissionView repeated = support.repeated(tenantId, operation, idempotencyKey, hash, SubmissionView.class);
        if (repeated != null) return repeated;
        UUID reviewId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO homework_reviews (
                  id, tenant_id, homework_id, submission_id, status,
                  comment_text, reviewed_by
                ) VALUES (
                  :id, :tenantId, :homeworkId, :submissionId, :status,
                  :comment, :actorId
                )
                """)
            .param("id", reviewId).param("tenantId", tenantId).param("homeworkId", homeworkId)
            .param("submissionId", submissionId).param("status", status)
            .param("comment", clean(input.comment())).param("actorId", actor.userId()).update();
        int sort = 0;
        for (String token : input.fileTokens()) {
            UUID fileId = storage.promote(tenantId, token, FilePurpose.REVIEW_ATTACHMENT);
            jdbc.sql("""
                    INSERT INTO homework_review_files (tenant_id, review_id, file_id, sort_order)
                    VALUES (:tenantId, :reviewId, :fileId, :sortOrder)
                    """)
                .param("tenantId", tenantId).param("reviewId", reviewId)
                .param("fileId", fileId).param("sortOrder", sort++).update();
        }
        jdbc.sql("""
                UPDATE homework_submissions
                SET review_status=:status, version=version+1
                WHERE tenant_id=:tenantId AND id=:submissionId AND version=:version
                """)
            .param("status", status).param("tenantId", tenantId)
            .param("submissionId", submissionId).param("version", submission.version()).update();
        UUID studentUserId = studentUserId(tenantId, submission.studentId());
        notifications.inAppAndEmail(tenantId, studentUserId, "HOMEWORK_REVIEWED",
            "BTVN đã được chữa", row.title(), "/homeworks/" + homeworkId,
            "review:" + reviewId + ":" + studentUserId);
        support.audit(tenantId, actor.userId(), "USER", "HOMEWORK_REVIEWED",
            "HOMEWORK_REVIEW", reviewId, null, Map.of("submissionId", submissionId, "status", status));
        SubmissionView result = submission(tenantId, submissionId);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, result);
        return result;
    }

    @Transactional(readOnly = true)
    public PageResponse<MaterialView> materials(UUID classId, UUID sessionId, int page, int pageSize) {
        page(page, pageSize);
        UUID tenantId = actor.tenantId();
        requireClassContentAccess(tenantId, classId);
        long total = jdbc.sql("""
                SELECT count(*) FROM materials
                WHERE tenant_id=:tenantId AND class_id=:classId AND status='ACTIVE'
                  AND (:sessionFilter=false OR session_id=:sessionId)
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("sessionFilter", sessionId != null).param("sessionId", sessionId)
            .query(Long.class).single();
        List<MaterialView> items = jdbc.sql(materialSql() + """
                WHERE m.tenant_id=:tenantId AND m.class_id=:classId AND m.status='ACTIVE'
                  AND (:sessionFilter=false OR m.session_id=:sessionId)
                ORDER BY m.updated_at DESC
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("classId", classId)
            .param("sessionFilter", sessionId != null).param("sessionId", sessionId)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> mapMaterial(rs, tenantId)).list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional
    public MaterialView createMaterial(UUID classId, CreateMaterialInput input, String idempotencyKey) {
        maintenance.requireWritable();
        support.requireIdempotencyKey(idempotencyKey);
        UUID tenantId = actor.tenantId();
        requireManageMaterial(tenantId, classId, input.sessionId());
        String operation = "CREATE_MATERIAL:" + classId;
        String hash = support.requestHash(input);
        MaterialView repeated = support.repeated(tenantId, operation, idempotencyKey, hash, MaterialView.class);
        if (repeated != null) return repeated;
        UUID fileId = storage.promote(tenantId, input.fileToken(), FilePurpose.MATERIAL);
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO materials (
                  id, tenant_id, class_id, session_id, title, description, file_id,
                  status, created_by, updated_by
                ) VALUES (
                  :id, :tenantId, :classId, :sessionId, :title, :description, :fileId,
                  'ACTIVE', :actorId, :actorId
                )
                """)
            .param("id", id).param("tenantId", tenantId).param("classId", classId)
            .param("sessionId", input.sessionId()).param("title", input.title().trim())
            .param("description", clean(input.description())).param("fileId", fileId)
            .param("actorId", actor.userId()).update();
        notifyClassStudents(tenantId, classId, "MATERIAL_PUBLISHED",
            "Tài liệu mới", input.title().trim(), "/classes/" + classId + "/materials");
        support.audit(tenantId, actor.userId(), "USER", "MATERIAL_CREATED",
            "MATERIAL", id, null, Map.of("classId", classId, "title", input.title()));
        MaterialView result = material(tenantId, id);
        support.remember(tenantId, operation, idempotencyKey, hash, 201, result);
        return result;
    }

    @Transactional
    public MaterialView updateMaterial(UUID materialId, UpdateMaterialInput input) {
        maintenance.requireWritable();
        UUID tenantId = actor.tenantId();
        MaterialRow row = lockMaterial(tenantId, materialId);
        requireManageMaterial(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), input.version());
        UUID newFileId = row.fileId();
        if (input.fileToken() != null && !input.fileToken().isBlank()) {
            newFileId = storage.promote(tenantId, input.fileToken(), FilePurpose.MATERIAL);
        }
        jdbc.sql("""
                UPDATE materials
                SET title=:title, description=:description, file_id=:fileId,
                    updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id AND version=:version
                """)
            .param("title", input.title().trim()).param("description", clean(input.description()))
            .param("fileId", newFileId).param("actorId", actor.userId())
            .param("tenantId", tenantId).param("id", materialId).param("version", input.version())
            .update();
        if (!newFileId.equals(row.fileId())) {
            storage.markDeleted(tenantId, row.fileId(), "material file replaced");
        }
        notifyClassStudents(tenantId, row.classId(), "MATERIAL_UPDATED",
            "Tài liệu đã được cập nhật", input.title().trim(), "/classes/" + row.classId() + "/materials");
        support.audit(tenantId, actor.userId(), "USER", "MATERIAL_UPDATED",
            "MATERIAL", materialId, row, material(tenantId, materialId));
        return material(tenantId, materialId);
    }

    @Transactional
    public void removeMaterial(UUID materialId, long version) {
        maintenance.requireWritable();
        UUID tenantId = actor.tenantId();
        MaterialRow row = lockMaterial(tenantId, materialId);
        requireManageMaterial(tenantId, row.classId(), row.sessionId());
        requireVersion(row.version(), version);
        jdbc.sql("""
                UPDATE materials
                SET status='REMOVED', removed_by=:actorId, removed_at=now(),
                    updated_by=:actorId, updated_at=now(), version=version+1
                WHERE tenant_id=:tenantId AND id=:id AND version=:version
                """)
            .param("actorId", actor.userId()).param("tenantId", tenantId)
            .param("id", materialId).param("version", version).update();
        storage.markDeleted(tenantId, row.fileId(), "material removed");
        support.audit(tenantId, actor.userId(), "USER", "MATERIAL_REMOVED",
            "MATERIAL", materialId, row, Map.of("status", "REMOVED"));
    }

    @Transactional(readOnly = true)
    public PageResponse<HomeworkReportRow> report(UUID classId, UUID teacherId, int page, int pageSize) {
        page(page, pageSize);
        UUID tenantId = actor.tenantId();
        if (!actor.hasPermission("VIEW_HOMEWORK")) forbidden();
        String where = """
                h.tenant_id=:tenantId
                AND (:classFilter=false OR h.class_id=:classId)
                AND (:teacherFilter=false OR c.primary_teacher_id=:teacherId)
                """;
        long total = jdbc.sql("""
                SELECT count(DISTINCT c.id)
                FROM classes c
                JOIN homeworks h ON h.tenant_id=c.tenant_id AND h.class_id=c.id
                WHERE
                """ + where)
            .param("tenantId", tenantId).param("classFilter", classId != null).param("classId", classId)
            .param("teacherFilter", teacherId != null).param("teacherId", teacherId)
            .query(Long.class).single();
        List<HomeworkReportRow> items = jdbc.sql("""
                SELECT c.id, c.code, c.name, teacher_user.display_name AS teacher_name,
                       count(DISTINCT h.id)::int AS homework_count,
                       count(DISTINCT r.student_id)::int AS recipient_count,
                       count(DISTINCT s.student_id)::int AS submitted_count,
                       count(DISTINCT s.student_id) FILTER (WHERE s.review_status='REVIEWED')::int AS reviewed_count
                FROM classes c
                JOIN teacher_profiles teacher ON teacher.tenant_id=c.tenant_id AND teacher.id=c.primary_teacher_id
                JOIN users teacher_user ON teacher_user.tenant_id=teacher.tenant_id AND teacher_user.id=teacher.user_id
                JOIN homeworks h ON h.tenant_id=c.tenant_id AND h.class_id=c.id
                LEFT JOIN homework_recipients r ON r.tenant_id=h.tenant_id AND r.homework_id=h.id AND r.removed_at IS NULL
                LEFT JOIN homework_submissions s ON s.tenant_id=h.tenant_id AND s.homework_id=h.id AND s.current_attempt
                WHERE
                """ + where + """
                GROUP BY c.id, c.code, c.name, teacher_user.display_name
                ORDER BY c.name
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("classFilter", classId != null).param("classId", classId)
            .param("teacherFilter", teacherId != null).param("teacherId", teacherId)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> new HomeworkReportRow(rs.getObject("id", UUID.class),
                rs.getString("code"), rs.getString("name"), rs.getString("teacher_name"),
                rs.getInt("homework_count"), rs.getInt("recipient_count"),
                rs.getInt("submitted_count"), rs.getInt("reviewed_count"))).list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationView> notifications(boolean unreadOnly, int page, int pageSize) {
        page(page, pageSize);
        UUID tenantId = actor.tenantId();
        UUID userId = actor.userId();
        long total = jdbc.sql("""
                SELECT count(*) FROM notifications
                WHERE tenant_id=:tenantId AND recipient_user_id=:userId
                  AND (:unreadOnly=false OR read_at IS NULL)
                """)
            .param("tenantId", tenantId).param("userId", userId).param("unreadOnly", unreadOnly)
            .query(Long.class).single();
        List<NotificationView> items = jdbc.sql("""
                SELECT id, event_type, title, body, read_at, created_at
                FROM notifications
                WHERE tenant_id=:tenantId AND recipient_user_id=:userId
                  AND (:unreadOnly=false OR read_at IS NULL)
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
                """)
            .param("tenantId", tenantId).param("userId", userId).param("unreadOnly", unreadOnly)
            .param("limit", pageSize).param("offset", (page - 1) * pageSize)
            .query((rs, row) -> new NotificationView(rs.getObject("id", UUID.class),
                rs.getString("event_type"), rs.getString("title"), rs.getString("body"),
                rs.getObject("read_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class))).list();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return jdbc.sql("""
                SELECT count(*) FROM notifications
                WHERE tenant_id=:tenantId AND recipient_user_id=:userId AND read_at IS NULL
                """)
            .param("tenantId", actor.tenantId()).param("userId", actor.userId())
            .query(Long.class).single();
    }

    @Transactional
    public void markNotificationRead(UUID notificationId) {
        jdbc.sql("""
                UPDATE notifications SET read_at=COALESCE(read_at, now())
                WHERE tenant_id=:tenantId AND recipient_user_id=:userId AND id=:id
                """)
            .param("tenantId", actor.tenantId()).param("userId", actor.userId())
            .param("id", notificationId).update();
    }

    @Transactional
    public void markAllNotificationsRead() {
        jdbc.sql("""
                UPDATE notifications SET read_at=COALESCE(read_at, now())
                WHERE tenant_id=:tenantId AND recipient_user_id=:userId AND read_at IS NULL
                """)
            .param("tenantId", actor.tenantId()).param("userId", actor.userId()).update();
    }

    @Transactional(readOnly = true)
    public List<AuditTimelineItem> timeline(String entityType, UUID entityId) {
        UUID tenantId = actor.tenantId();
        if (!actor.hasPermission("VIEW_HOMEWORK") && !actor.hasPermission("VIEW_MATERIALS")) forbidden();
        return jdbc.sql("""
                SELECT audit.id, audit.action, COALESCE(u.display_name, 'Hệ thống') AS actor_name,
                       audit.occurred_at, audit.old_value::text AS old_value,
                       audit.new_value::text AS new_value, audit.trace_id
                FROM audit_events audit
                LEFT JOIN users u ON u.tenant_id=audit.tenant_id AND u.id=audit.actor_user_id
                WHERE audit.tenant_id=:tenantId AND audit.entity_type=:entityType AND audit.entity_id=:entityId
                ORDER BY audit.occurred_at DESC
                LIMIT 100
                """)
            .param("tenantId", tenantId).param("entityType", entityType).param("entityId", entityId)
            .query((rs, row) -> new AuditTimelineItem(rs.getObject("id", UUID.class),
                rs.getString("action"), rs.getString("actor_name"),
                rs.getObject("occurred_at", OffsetDateTime.class),
                rs.getString("old_value"), rs.getString("new_value"), rs.getString("trace_id")))
            .list();
    }

    @Transactional(readOnly = true)
    public TenantStorageUsage tenantUsage() {
        UUID tenantId = actor.tenantId();
        if (!actor.hasPermission("VIEW_STORAGE_USAGE")) forbidden();
        FileStorageService.Usage usage = storage.usage(tenantId);
        return new TenantStorageUsage(tenantId, usage.quotaBytes(), usage.usedBytes(),
            Math.max(0, usage.quotaBytes() - usage.usedBytes()), usage.stagingBytes(), usage.version());
    }

    @Transactional(readOnly = true)
    public TenantStorageUsage platformTenantUsage(UUID tenantId) {
        actor.requirePlatform();
        if (!actor.hasPermission("MANAGE_TENANT_QUOTA")) forbidden();
        FileStorageService.Usage usage = storage.usage(tenantId);
        return new TenantStorageUsage(tenantId, usage.quotaBytes(), usage.usedBytes(),
            Math.max(0, usage.quotaBytes() - usage.usedBytes()), usage.stagingBytes(), usage.version());
    }

    @Transactional
    public TenantStorageUsage updateTenantQuota(UUID tenantId, long quotaBytes, long version) {
        actor.requirePlatform();
        if (!actor.hasPermission("MANAGE_TENANT_QUOTA")) forbidden();
        storage.updateQuota(tenantId, quotaBytes, version);
        return platformTenantUsage(tenantId);
    }

    @Transactional
    public ResponseEntity<Resource> fileContent(UUID fileId, String rangeHeader) {
        UUID tenantId = actor.tenantId();
        FileOwner owner = authorizeFile(tenantId, fileId);
        jdbc.sql("""
                INSERT INTO file_access_logs (
                  id, tenant_id, file_id, actor_user_id, action, entity_type, entity_id
                ) VALUES (
                  :id, :tenantId, :fileId, :actorId, 'VIEW', :entityType, :entityId
                )
                """)
            .param("id", UUID.randomUUID()).param("tenantId", tenantId).param("fileId", fileId)
            .param("actorId", actor.userId()).param("entityType", owner.entityType())
            .param("entityId", owner.entityId()).update();
        return storage.response(tenantId, fileId, rangeHeader);
    }

    @Transactional
    public void closeOpenHomeworksForInactiveClasses() {
        List<UUID> ids = jdbc.sql("""
                SELECT h.id FROM homeworks h
                JOIN classes c ON c.tenant_id=h.tenant_id AND c.id=h.class_id
                WHERE h.status='PUBLISHED' AND c.status IN ('CLOSED','CANCELLED')
                LIMIT 200
                """)
            .query(UUID.class).list();
        for (UUID id : ids) {
            jdbc.sql("""
                    UPDATE homeworks
                    SET status='CLOSED', closed_at=COALESCE(closed_at, now()),
                        updated_at=now(), version=version+1
                    WHERE id=:id AND status='PUBLISHED'
                    """).param("id", id).update();
        }
        List<UUID> sessionIds = jdbc.sql("""
                SELECT h.id FROM homeworks h
                JOIN class_sessions s ON s.tenant_id=h.tenant_id AND s.id=h.session_id
                WHERE h.status='PUBLISHED' AND s.status='CANCELLED'
                LIMIT 200
                """)
            .query(UUID.class).list();
        for (UUID id : sessionIds) {
            jdbc.sql("""
                    UPDATE homeworks
                    SET status='CLOSED', closed_at=COALESCE(closed_at, now()),
                        updated_at=now(), version=version+1
                    WHERE id=:id AND status='PUBLISHED'
                    """).param("id", id).update();
        }
    }

    private HomeworkDetail homeworkDetail(UUID tenantId, UUID homeworkId) {
        HomeworkHead head = homeworkHead(tenantId, homeworkId);
        return new HomeworkDetail(head.id(), head.classId(), head.sessionId(), head.classCode(),
            head.className(), head.sessionOrdinal(), head.title(), head.description(), head.audienceType(),
            head.status(), head.deadlineAt(), head.publishedAt(), head.closedAt(),
            homeworkResources(tenantId, homeworkId), recipients(tenantId, homeworkId),
            submissions(tenantId, homeworkId), head.version());
    }

    private HomeworkHead homeworkHead(UUID tenantId, UUID homeworkId) {
        HomeworkHead head = jdbc.sql("""
                SELECT h.id, h.class_id, h.session_id, c.code, c.name, s.ordinal,
                       h.title, h.description, h.audience_type, h.status, h.deadline_at,
                       h.published_at, h.closed_at, h.version
                FROM homeworks h
                JOIN classes c ON c.tenant_id=h.tenant_id AND c.id=h.class_id
                LEFT JOIN class_sessions s ON s.tenant_id=h.tenant_id AND s.id=h.session_id
                WHERE h.tenant_id=:tenantId AND h.id=:id
                """)
            .param("tenantId", tenantId).param("id", homeworkId)
            .query((rs, row) -> new HomeworkHead(
                rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
                rs.getObject("session_id", UUID.class), rs.getString("code"),
                rs.getString("name"), rs.getObject("ordinal", Integer.class),
                rs.getString("title"), rs.getString("description"), rs.getString("audience_type"),
                rs.getString("status"), rs.getObject("deadline_at", OffsetDateTime.class),
                rs.getObject("published_at", OffsetDateTime.class),
                rs.getObject("closed_at", OffsetDateTime.class), rs.getLong("version")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "HOMEWORK_NOT_FOUND", "Không tìm thấy BTVN."));
        return head;
    }

    private List<HomeworkResourceView> homeworkResources(UUID tenantId, UUID homeworkId) {
        return jdbc.sql("""
                SELECT id, kind, file_id, url, label, sort_order
                FROM homework_resources
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId
                ORDER BY sort_order, created_at
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId)
            .query((rs, row) -> {
                UUID fileId = rs.getObject("file_id", UUID.class);
                return new HomeworkResourceView(rs.getObject("id", UUID.class), rs.getString("kind"),
                    rs.getString("label"), rs.getString("url"),
                    fileId == null ? null : storage.file(tenantId, fileId), rs.getInt("sort_order"));
            }).list();
    }

    private List<HomeworkRecipientView> recipients(UUID tenantId, UUID homeworkId) {
        return jdbc.sql("""
                SELECT r.student_id, sp.code, u.display_name, r.added_at, r.removed_at,
                       EXISTS (
                         SELECT 1 FROM homework_submissions sub
                         WHERE sub.tenant_id=r.tenant_id AND sub.homework_id=r.homework_id
                           AND sub.student_id=r.student_id
                       ) AS submitted
                FROM homework_recipients r
                JOIN student_profiles sp ON sp.tenant_id=r.tenant_id AND sp.id=r.student_id
                JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                WHERE r.tenant_id=:tenantId AND r.homework_id=:homeworkId
                ORDER BY u.display_name
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId)
            .query((rs, row) -> new HomeworkRecipientView(rs.getObject("student_id", UUID.class),
                rs.getString("code"), rs.getString("display_name"),
                rs.getObject("added_at", OffsetDateTime.class), rs.getBoolean("submitted"),
                rs.getObject("removed_at", OffsetDateTime.class) != null)).list();
    }

    private HomeworkRecipientView recipient(UUID tenantId, UUID homeworkId, UUID studentId) {
        return jdbc.sql("""
                SELECT r.student_id, sp.code, u.display_name, r.added_at, r.removed_at,
                       EXISTS (
                         SELECT 1 FROM homework_submissions sub
                         WHERE sub.tenant_id=r.tenant_id AND sub.homework_id=r.homework_id
                           AND sub.student_id=r.student_id
                       ) AS submitted
                FROM homework_recipients r
                JOIN student_profiles sp ON sp.tenant_id=r.tenant_id AND sp.id=r.student_id
                JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                WHERE r.tenant_id=:tenantId AND r.homework_id=:homeworkId
                  AND r.student_id=:studentId AND r.removed_at IS NULL
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).param("studentId", studentId)
            .query((rs, row) -> new HomeworkRecipientView(rs.getObject("student_id", UUID.class),
                rs.getString("code"), rs.getString("display_name"),
                rs.getObject("added_at", OffsetDateTime.class), rs.getBoolean("submitted"),
                rs.getObject("removed_at", OffsetDateTime.class) != null))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN,
                "FORBIDDEN", "Bạn không có quyền xem BTVN này."));
    }

    private List<SubmissionView> submissions(UUID tenantId, UUID homeworkId) {
        return jdbc.sql("""
                SELECT sub.id FROM homework_submissions sub
                WHERE sub.tenant_id=:tenantId AND sub.homework_id=:homeworkId
                ORDER BY sub.student_id, sub.attempt_no DESC
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId)
            .query(UUID.class).list().stream().map(id -> submission(tenantId, id)).toList();
    }

    private List<SubmissionView> submissionsForStudent(UUID tenantId, UUID homeworkId, UUID studentId) {
        return jdbc.sql("""
                SELECT sub.id FROM homework_submissions sub
                WHERE sub.tenant_id=:tenantId AND sub.homework_id=:homeworkId
                  AND sub.student_id=:studentId
                ORDER BY sub.attempt_no DESC
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).param("studentId", studentId)
            .query(UUID.class).list().stream().map(id -> submission(tenantId, id)).toList();
    }

    private SubmissionView submission(UUID tenantId, UUID submissionId) {
        SubmissionBase base = jdbc.sql("""
                SELECT sub.id, sub.homework_id, sub.student_id, sp.code, u.display_name,
                       sub.attempt_no, sub.note, sub.submitted_at, sub.deadline_snapshot,
                       sub.late, sub.review_status, sub.version
                FROM homework_submissions sub
                JOIN student_profiles sp ON sp.tenant_id=sub.tenant_id AND sp.id=sub.student_id
                JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                WHERE sub.tenant_id=:tenantId AND sub.id=:submissionId
                """)
            .param("tenantId", tenantId).param("submissionId", submissionId)
            .query((rs, row) -> new SubmissionBase(rs.getObject("id", UUID.class),
                rs.getObject("homework_id", UUID.class), rs.getObject("student_id", UUID.class),
                rs.getString("code"), rs.getString("display_name"), rs.getInt("attempt_no"),
                rs.getString("note"), rs.getObject("submitted_at", OffsetDateTime.class),
                rs.getObject("deadline_snapshot", OffsetDateTime.class), rs.getBoolean("late"),
                rs.getString("review_status"), rs.getLong("version")))
            .single();
        List<StoredFileView> files = jdbc.sql("""
                SELECT file_id FROM homework_submission_files
                WHERE tenant_id=:tenantId AND submission_id=:submissionId
                ORDER BY sort_order
                """)
            .param("tenantId", tenantId).param("submissionId", submissionId)
            .query(UUID.class).list().stream().map(id -> storage.file(tenantId, id)).toList();
        ReviewView review = reviewForSubmission(tenantId, submissionId);
        return new SubmissionView(base.id(), base.homeworkId(), base.studentId(), base.studentCode(),
            base.studentName(), base.attemptNo(), base.note(), base.submittedAt(),
            base.deadlineSnapshot(), base.late(), base.reviewStatus(), files, review, base.version());
    }

    private ReviewView reviewForSubmission(UUID tenantId, UUID submissionId) {
        ReviewBase review = jdbc.sql("""
                SELECT r.id, r.status, r.comment_text, u.display_name, r.reviewed_at
                FROM homework_reviews r
                JOIN users u ON u.tenant_id=r.tenant_id AND u.id=r.reviewed_by
                WHERE r.tenant_id=:tenantId AND r.submission_id=:submissionId
                ORDER BY r.reviewed_at DESC
                LIMIT 1
                """)
            .param("tenantId", tenantId).param("submissionId", submissionId)
            .query((rs, row) -> new ReviewBase(rs.getObject("id", UUID.class),
                rs.getString("status"), rs.getString("comment_text"), rs.getString("display_name"),
                rs.getObject("reviewed_at", OffsetDateTime.class)))
            .optional().orElse(null);
        if (review == null) return null;
        List<StoredFileView> files = jdbc.sql("""
                SELECT file_id FROM homework_review_files
                WHERE tenant_id=:tenantId AND review_id=:reviewId
                ORDER BY sort_order
                """)
            .param("tenantId", tenantId).param("reviewId", review.id())
            .query(UUID.class).list().stream().map(id -> storage.file(tenantId, id)).toList();
        return new ReviewView(review.id(), review.status(), review.comment(),
            review.reviewedBy(), review.reviewedAt(), files);
    }

    private MaterialView material(UUID tenantId, UUID materialId) {
        return jdbc.sql(materialSql() + """
                WHERE m.tenant_id=:tenantId AND m.id=:id
                """)
            .param("tenantId", tenantId).param("id", materialId)
            .query((rs, row) -> mapMaterial(rs, tenantId))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "MATERIAL_NOT_FOUND", "Không tìm thấy tài liệu."));
    }

    private MaterialView mapMaterial(java.sql.ResultSet rs, UUID tenantId) throws java.sql.SQLException {
        return new MaterialView(rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
            rs.getObject("session_id", UUID.class), rs.getString("class_code"),
            rs.getString("class_name"), rs.getObject("ordinal", Integer.class),
            rs.getString("title"), rs.getString("description"), rs.getString("status"),
            storage.file(tenantId, rs.getObject("file_id", UUID.class)),
            rs.getString("created_by_name"), rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class), rs.getLong("version"));
    }

    private String materialSql() {
        return """
                SELECT m.id, m.class_id, m.session_id, c.code AS class_code, c.name AS class_name,
                       s.ordinal, m.title, m.description, m.status, m.file_id,
                       creator.display_name AS created_by_name, m.created_at, m.updated_at, m.version
                FROM materials m
                JOIN classes c ON c.tenant_id=m.tenant_id AND c.id=m.class_id
                LEFT JOIN class_sessions s ON s.tenant_id=m.tenant_id AND s.id=m.session_id
                JOIN users creator ON creator.tenant_id=m.tenant_id AND creator.id=m.created_by
                """;
    }

    private String summarySql() {
        return """
                SELECT h.id, h.class_id, h.session_id, c.code AS class_code, c.name AS class_name,
                       s.ordinal, h.title, h.status, h.deadline_at,
                       count(DISTINCT r.student_id) FILTER (WHERE r.removed_at IS NULL)::int AS recipient_count,
                       count(DISTINCT sub.student_id) FILTER (WHERE sub.current_attempt)::int AS submitted_count,
                       count(DISTINCT sub.student_id) FILTER (WHERE sub.current_attempt AND sub.review_status='REVIEWED')::int AS reviewed_count,
                       h.version
                FROM homeworks h
                JOIN classes c ON c.tenant_id=h.tenant_id AND c.id=h.class_id
                LEFT JOIN class_sessions s ON s.tenant_id=h.tenant_id AND s.id=h.session_id
                LEFT JOIN homework_recipients r ON r.tenant_id=h.tenant_id AND r.homework_id=h.id
                LEFT JOIN homework_submissions sub ON sub.tenant_id=h.tenant_id AND sub.homework_id=h.id
                """;
    }

    private String studentSummarySql() {
        return """
                SELECT h.id, h.class_id, h.session_id, c.code AS class_code, c.name AS class_name,
                       s.ordinal, h.title, h.status, h.deadline_at,
                       count(DISTINCT r.student_id) FILTER (WHERE r.removed_at IS NULL)::int AS recipient_count,
                       count(DISTINCT sub.student_id) FILTER (WHERE sub.current_attempt)::int AS submitted_count,
                       count(DISTINCT sub.student_id) FILTER (WHERE sub.current_attempt AND sub.review_status='REVIEWED')::int AS reviewed_count,
                       latest.submitted_at AS latest_submission_at,
                       latest.review_status AS my_review_status,
                       h.version
                FROM homeworks h
                JOIN classes c ON c.tenant_id=h.tenant_id AND c.id=h.class_id
                LEFT JOIN class_sessions s ON s.tenant_id=h.tenant_id AND s.id=h.session_id
                JOIN homework_recipients hr ON hr.tenant_id=h.tenant_id AND hr.homework_id=h.id
                LEFT JOIN homework_recipients r ON r.tenant_id=h.tenant_id AND r.homework_id=h.id
                LEFT JOIN homework_submissions sub ON sub.tenant_id=h.tenant_id AND sub.homework_id=h.id
                LEFT JOIN homework_submissions latest ON latest.tenant_id=h.tenant_id
                  AND latest.homework_id=h.id AND latest.student_id=:studentId
                  AND latest.current_attempt
                """;
    }

    private HomeworkSummary mapSummary(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new HomeworkSummary(rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
            rs.getObject("session_id", UUID.class), rs.getString("class_code"),
            rs.getString("class_name"), rs.getObject("ordinal", Integer.class),
            rs.getString("title"), rs.getString("status"),
            rs.getObject("deadline_at", OffsetDateTime.class), rs.getInt("recipient_count"),
            rs.getInt("submitted_count"), rs.getInt("reviewed_count"), rs.getLong("version"));
    }

    private StudentHomeworkSummary mapStudentSummary(java.sql.ResultSet rs) throws java.sql.SQLException {
        OffsetDateTime deadlineAt = rs.getObject("deadline_at", OffsetDateTime.class);
        String status = rs.getString("status");
        OffsetDateTime submittedAt = rs.getObject("latest_submission_at", OffsetDateTime.class);
        String reviewStatus = rs.getString("my_review_status");
        return new StudentHomeworkSummary(rs.getObject("id", UUID.class),
            rs.getObject("class_id", UUID.class), rs.getObject("session_id", UUID.class),
            rs.getString("class_code"), rs.getString("class_name"),
            rs.getObject("ordinal", Integer.class), rs.getString("title"), status,
            deadlineAt, rs.getInt("recipient_count"), rs.getInt("submitted_count"),
            rs.getInt("reviewed_count"), submittedAt == null ? "ASSIGNED" : reviewStatus,
            submittedAt, deadlineState(status, deadlineAt), "PUBLISHED".equals(status),
            rs.getLong("version"));
    }

    private void replaceHomeworkResources(UUID tenantId, UUID homeworkId, List<String> tokens,
                                          List<HomeworkLinkInput> links, String deleteReason) {
        replaceHomeworkResources(tenantId, homeworkId, List.of(), tokens, links, deleteReason);
    }

    private void replaceHomeworkResources(UUID tenantId, UUID homeworkId, List<UUID> existingFileIds,
                                          List<String> tokens, List<HomeworkLinkInput> links, String deleteReason) {
        List<UUID> oldFiles = jdbc.sql("""
                SELECT file_id FROM homework_resources
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId AND kind='FILE'
                ORDER BY sort_order, created_at
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).query(UUID.class).list();
        Set<UUID> oldFileSet = Set.copyOf(oldFiles);
        LinkedHashSet<UUID> keptFileIds = new LinkedHashSet<>();
        for (UUID fileId : existingFileIds) {
            if (fileId == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "HOMEWORK_FILE_NOT_ATTACHED",
                    "File không thuộc BTVN đang sửa.");
            }
            if (!oldFileSet.contains(fileId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "HOMEWORK_FILE_NOT_ATTACHED",
                    "File không thuộc BTVN đang sửa.", Map.of("fileId", fileId));
            }
            keptFileIds.add(fileId);
        }
        jdbc.sql("""
                DELETE FROM homework_resources
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId
                """).param("tenantId", tenantId).param("homeworkId", homeworkId).update();
        int sort = 0;
        for (UUID fileId : keptFileIds) {
            jdbc.sql("""
                    INSERT INTO homework_resources (id, tenant_id, homework_id, kind, file_id, sort_order)
                    VALUES (:id, :tenantId, :homeworkId, 'FILE', :fileId, :sortOrder)
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId)
                .param("homeworkId", homeworkId).param("fileId", fileId).param("sortOrder", sort++).update();
        }
        for (String token : tokens) {
            UUID fileId = storage.promote(tenantId, token, FilePurpose.HOMEWORK_ATTACHMENT);
            jdbc.sql("""
                    INSERT INTO homework_resources (id, tenant_id, homework_id, kind, file_id, sort_order)
                    VALUES (:id, :tenantId, :homeworkId, 'FILE', :fileId, :sortOrder)
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId)
                .param("homeworkId", homeworkId).param("fileId", fileId).param("sortOrder", sort++).update();
        }
        for (HomeworkLinkInput link : links) {
            validateHttpUrl(link.url());
            jdbc.sql("""
                    INSERT INTO homework_resources (id, tenant_id, homework_id, kind, url, label, sort_order)
                    VALUES (:id, :tenantId, :homeworkId, 'LINK', :url, :label, :sortOrder)
                    """)
                .param("id", UUID.randomUUID()).param("tenantId", tenantId)
                .param("homeworkId", homeworkId).param("url", link.url().trim())
                .param("label", link.label().trim()).param("sortOrder", sort++).update();
        }
        for (UUID fileId : oldFiles) {
            if (!keptFileIds.contains(fileId)) {
                storage.markDeleted(tenantId, fileId, deleteReason);
            }
        }
    }

    private void addRecipientsLocked(UUID tenantId, UUID homeworkId, UUID classId, List<UUID> studentIds) {
        for (UUID studentId : studentIds) {
            boolean inClass = jdbc.sql("""
                    SELECT EXISTS(SELECT 1 FROM class_enrollments
                      WHERE tenant_id=:tenantId AND class_id=:classId AND student_id=:studentId)
                    """)
                .param("tenantId", tenantId).param("classId", classId).param("studentId", studentId)
                .query(Boolean.class).single();
            if (!inClass) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "RECIPIENT_NOT_IN_CLASS",
                    "Có học sinh không thuộc lịch sử lớp.", Map.of("studentId", studentId));
            }
            jdbc.sql("""
                    INSERT INTO homework_recipients (tenant_id, homework_id, student_id, added_by)
                    VALUES (:tenantId, :homeworkId, :studentId, :actorId)
                    ON CONFLICT (tenant_id, homework_id, student_id) DO UPDATE
                    SET removed_at=NULL, removed_by=NULL, added_by=:actorId, added_at=now()
                    """)
                .param("tenantId", tenantId).param("homeworkId", homeworkId)
                .param("studentId", studentId).param("actorId", actor.userId()).update();
        }
    }

    private List<UUID> activeStudents(UUID tenantId, UUID classId) {
        return jdbc.sql("""
                SELECT student_id FROM class_enrollments
                WHERE tenant_id=:tenantId AND class_id=:classId AND status='ACTIVE'
                ORDER BY effective_from, student_id
                """).param("tenantId", tenantId).param("classId", classId).query(UUID.class).list();
    }

    private int recipientCount(UUID tenantId, UUID homeworkId) {
        return jdbc.sql("""
                SELECT count(*) FROM homework_recipients
                WHERE tenant_id=:tenantId AND homework_id=:homeworkId AND removed_at IS NULL
                """).param("tenantId", tenantId).param("homeworkId", homeworkId)
            .query(Integer.class).single();
    }

    private void notifyHomeworkStudents(UUID tenantId, UUID homeworkId, String eventType,
                                        String title, String body) {
        List<UUID> users = jdbc.sql("""
                SELECT u.id
                FROM homework_recipients r
                JOIN student_profiles sp ON sp.tenant_id=r.tenant_id AND sp.id=r.student_id
                JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                WHERE r.tenant_id=:tenantId AND r.homework_id=:homeworkId AND r.removed_at IS NULL
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).query(UUID.class).list();
        notifyUserIds(tenantId, users, eventType, title, body,
            "/homeworks/" + homeworkId, eventType + ":" + homeworkId);
    }

    private void notifyClassStudents(UUID tenantId, UUID classId, String eventType,
                                     String title, String body, String deepLink) {
        List<UUID> users = jdbc.sql("""
                SELECT DISTINCT u.id
                FROM class_enrollments e
                JOIN student_profiles sp ON sp.tenant_id=e.tenant_id AND sp.id=e.student_id
                JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                JOIN classes c ON c.tenant_id=e.tenant_id AND c.id=e.class_id
                WHERE e.tenant_id=:tenantId AND e.class_id=:classId
                  AND e.status='ACTIVE' AND c.status IN ('SCHEDULED','ACTIVE','AWAITING_CLOSE')
                """)
            .param("tenantId", tenantId).param("classId", classId).query(UUID.class).list();
        notifyUserIds(tenantId, users, eventType, title, body, deepLink, eventType + ":" + classId);
    }

    private void notifyUsers(UUID tenantId, List<UUID> studentIds, String eventType,
                             String title, String body, String deepLink, String keyPrefix) {
        if (studentIds.isEmpty()) return;
        List<UUID> users = jdbc.sql("""
                SELECT u.id FROM student_profiles sp
                JOIN users u ON u.tenant_id=sp.tenant_id AND u.id=sp.user_id
                WHERE sp.tenant_id=:tenantId AND sp.id IN (:studentIds)
                """)
            .param("tenantId", tenantId).param("studentIds", studentIds)
            .query(UUID.class).list();
        notifyUserIds(tenantId, users, eventType, title, body, deepLink, keyPrefix);
    }

    private void notifyUserIds(UUID tenantId, List<UUID> userIds, String eventType,
                               String title, String body, String deepLink, String keyPrefix) {
        for (UUID userId : userIds) {
            notifications.inAppAndEmail(tenantId, userId, eventType, title, body, deepLink,
                keyPrefix + ":" + userId);
        }
    }

    private void notifyResponsibleTeachers(UUID tenantId, HomeworkRow homework, String eventType,
                                           String title, String body) {
        List<UUID> teachers = jdbc.sql("""
                SELECT DISTINCT teacher_user.id
                FROM teacher_profiles teacher
                JOIN users teacher_user ON teacher_user.tenant_id=teacher.tenant_id
                  AND teacher_user.id=teacher.user_id
                WHERE teacher.tenant_id=:tenantId AND (
                  teacher.id = (SELECT primary_teacher_id FROM classes WHERE tenant_id=:tenantId AND id=:classId)
                  OR teacher.id IN (
                    SELECT planned_teacher_id FROM class_sessions WHERE tenant_id=:tenantId AND id=:sessionId
                    UNION
                    SELECT actual_teacher_id FROM class_sessions WHERE tenant_id=:tenantId AND id=:sessionId
                  )
                )
                """)
            .param("tenantId", tenantId).param("classId", homework.classId())
            .param("sessionId", homework.sessionId()).query(UUID.class).list();
        for (UUID teacher : teachers) {
            notifications.inApp(tenantId, teacher, eventType, title, body);
        }
    }

    private FileOwner authorizeFile(UUID tenantId, UUID fileId) {
        FileOwner owner = homeworkResourceOwner(tenantId, fileId);
        if (owner != null) return owner;
        owner = materialOwner(tenantId, fileId);
        if (owner != null) return owner;
        owner = submissionOwner(tenantId, fileId);
        if (owner != null) return owner;
        owner = reviewFileOwner(tenantId, fileId);
        if (owner != null) return owner;
        throw new ApiException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "Không tìm thấy file.");
    }

    private FileOwner homeworkResourceOwner(UUID tenantId, UUID fileId) {
        HomeworkRow row = jdbc.sql("""
                SELECT h.id, h.class_id, h.session_id, h.title, h.status, h.audience_type,
                       h.deadline_at, h.version
                FROM homework_resources resource
                JOIN homeworks h ON h.tenant_id=resource.tenant_id AND h.id=resource.homework_id
                WHERE resource.tenant_id=:tenantId AND resource.file_id=:fileId
                """)
            .param("tenantId", tenantId).param("fileId", fileId).query(this::mapHomeworkRow)
            .optional().orElse(null);
        if (row == null) return null;
        requireHomeworkRead(tenantId, row);
        return new FileOwner("HOMEWORK", row.id());
    }

    private FileOwner materialOwner(UUID tenantId, UUID fileId) {
        MaterialRow row = jdbc.sql("""
                SELECT id, class_id, session_id, file_id, status, version
                FROM materials
                WHERE tenant_id=:tenantId AND file_id=:fileId AND status='ACTIVE'
                """)
            .param("tenantId", tenantId).param("fileId", fileId)
            .query((rs, r) -> new MaterialRow(rs.getObject("id", UUID.class),
                rs.getObject("class_id", UUID.class), rs.getObject("session_id", UUID.class),
                rs.getObject("file_id", UUID.class), rs.getString("status"), rs.getLong("version")))
            .optional().orElse(null);
        if (row == null) return null;
        requireClassContentAccess(tenantId, row.classId());
        return new FileOwner("MATERIAL", row.id());
    }

    private FileOwner submissionOwner(UUID tenantId, UUID fileId) {
        HomeworkRow row = jdbc.sql("""
                SELECT h.id, h.class_id, h.session_id, h.title, h.status, h.audience_type,
                       h.deadline_at, h.version
                FROM homework_submission_files sf
                JOIN homework_submissions sub ON sub.tenant_id=sf.tenant_id AND sub.id=sf.submission_id
                JOIN homeworks h ON h.tenant_id=sub.tenant_id AND h.id=sub.homework_id
                WHERE sf.tenant_id=:tenantId AND sf.file_id=:fileId
                """)
            .param("tenantId", tenantId).param("fileId", fileId).query(this::mapHomeworkRow)
            .optional().orElse(null);
        if (row == null) return null;
        requireHomeworkRead(tenantId, row);
        return new FileOwner("HOMEWORK_SUBMISSION", row.id());
    }

    private FileOwner reviewFileOwner(UUID tenantId, UUID fileId) {
        HomeworkRow row = jdbc.sql("""
                SELECT h.id, h.class_id, h.session_id, h.title, h.status, h.audience_type,
                       h.deadline_at, h.version
                FROM homework_review_files rf
                JOIN homework_reviews review ON review.tenant_id=rf.tenant_id AND review.id=rf.review_id
                JOIN homeworks h ON h.tenant_id=review.tenant_id AND h.id=review.homework_id
                WHERE rf.tenant_id=:tenantId AND rf.file_id=:fileId
                """)
            .param("tenantId", tenantId).param("fileId", fileId).query(this::mapHomeworkRow)
            .optional().orElse(null);
        if (row == null) return null;
        requireHomeworkRead(tenantId, row);
        return new FileOwner("HOMEWORK_REVIEW", row.id());
    }

    private HomeworkRow lockHomework(UUID tenantId, UUID homeworkId) {
        return jdbc.sql("""
                SELECT id, class_id, session_id, title, status, audience_type, deadline_at, version
                FROM homeworks
                WHERE tenant_id=:tenantId AND id=:id
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("id", homeworkId).query(this::mapHomeworkRow)
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "HOMEWORK_NOT_FOUND", "Không tìm thấy BTVN."));
    }

    private HomeworkRow homeworkRow(UUID tenantId, UUID homeworkId) {
        return jdbc.sql("""
                SELECT id, class_id, session_id, title, status, audience_type, deadline_at, version
                FROM homeworks
                WHERE tenant_id=:tenantId AND id=:id
                """)
            .param("tenantId", tenantId).param("id", homeworkId).query(this::mapHomeworkRow)
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "HOMEWORK_NOT_FOUND", "Không tìm thấy BTVN."));
    }

    private void lockSessionForHomework(UUID tenantId, UUID classId, UUID sessionId) {
        jdbc.sql("""
                SELECT id FROM class_sessions
                WHERE tenant_id=:tenantId AND id=:sessionId AND class_id=:classId
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("classId", classId).param("sessionId", sessionId)
            .query(UUID.class).optional().orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                "HOMEWORK_SESSION_CLASS_MISMATCH", "Buổi học không thuộc lớp đang tạo BTVN."));
    }

    private UUID primarySessionHomeworkId(UUID tenantId, UUID sessionId) {
        return jdbc.sql("""
                SELECT id FROM homeworks
                WHERE tenant_id=:tenantId AND session_id=:sessionId AND is_session_primary
                ORDER BY created_at DESC
                LIMIT 1
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query(UUID.class).optional().orElse(null);
    }

    private HomeworkRow mapHomeworkRow(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new HomeworkRow(rs.getObject("id", UUID.class), rs.getObject("class_id", UUID.class),
            rs.getObject("session_id", UUID.class), rs.getString("title"), rs.getString("status"),
            rs.getString("audience_type"), rs.getObject("deadline_at", OffsetDateTime.class),
            rs.getLong("version"));
    }

    private MaterialRow lockMaterial(UUID tenantId, UUID materialId) {
        return jdbc.sql("""
                SELECT id, class_id, session_id, file_id, status, version
                FROM materials
                WHERE tenant_id=:tenantId AND id=:id
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("id", materialId)
            .query((rs, row) -> new MaterialRow(rs.getObject("id", UUID.class),
                rs.getObject("class_id", UUID.class), rs.getObject("session_id", UUID.class),
                rs.getObject("file_id", UUID.class), rs.getString("status"), rs.getLong("version")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "MATERIAL_NOT_FOUND", "Không tìm thấy tài liệu."));
    }

    private void requireHomeworkRead(UUID tenantId, HomeworkRow homework) {
        if (actor.hasPermission("VIEW_HOMEWORK") && !actor.roles().contains("STUDENT")) {
            if (actor.roles().contains("TEACHER")) requireTeacherRelated(tenantId, homework.classId(), homework.sessionId(), false);
            return;
        }
        UUID studentId = currentStudent(tenantId);
        if (!Set.of("PUBLISHED", "CLOSED").contains(homework.status())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "HOMEWORK_NOT_FOUND", "Không tìm thấy BTVN.");
        }
        requireStudentHomeworkAccess(tenantId, studentId, homework.classId(), homework.id());
    }

    private void requireClassContentAccess(UUID tenantId, UUID classId) {
        requireClassContentAccess(tenantId, classId, null);
    }

    private void requireClassContentAccess(UUID tenantId, UUID classId, UUID sessionId) {
        if (sessionId != null) {
            requireSessionBelongsToClass(tenantId, classId, sessionId);
        }
        if (actor.hasPermission("VIEW_MATERIALS") || actor.hasPermission("VIEW_HOMEWORK")) {
            if (actor.roles().contains("TEACHER")
                && !actor.roles().contains("ADMIN") && !actor.roles().contains("ACADEMIC_MANAGER")
                && !actor.roles().contains("ACCOUNTANT")) {
                requireTeacherRelated(tenantId, classId, sessionId, false);
            }
            if (actor.roles().contains("STUDENT")) {
                requireStudentClassAccess(tenantId, currentStudent(tenantId), classId);
            }
            return;
        }
        forbidden();
    }

    private void requireCreateHomeworkAccess(UUID tenantId, UUID classId, UUID sessionId) {
        if (!actor.hasPermission("MANAGE_HOMEWORK")) forbidden();
        if (sessionId == null) {
            if (isTeacherOnly()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "HOMEWORK_SESSION_REQUIRED",
                    "Giáo viên chỉ được tạo BTVN theo từng buổi.");
            }
            requireClassActive(tenantId, classId);
            return;
        }
        SessionHomeworkState state = sessionHomeworkState(tenantId, classId, sessionId);
        requireSessionManageableForHomework(state);
        if (actor.roles().contains("ADMIN") || actor.roles().contains("ACADEMIC_MANAGER")) return;
        UUID teacherId = currentTeacher(tenantId);
        boolean responsible = "COMPLETED".equals(state.sessionStatus())
            ? teacherId.equals(state.actualTeacherId())
            : teacherId.equals(state.plannedTeacherId());
        if (!responsible) forbidden();
    }

    private void requireManageHomework(UUID tenantId, UUID classId, UUID sessionId) {
        if (!actor.hasPermission("MANAGE_HOMEWORK")) forbidden();
        if (actor.roles().contains("ADMIN") || actor.roles().contains("ACADEMIC_MANAGER")) return;
        requireTeacherRelated(tenantId, classId, sessionId, true);
    }

    private void requireReviewHomework(UUID tenantId, UUID classId, UUID sessionId) {
        if (!actor.hasPermission("REVIEW_HOMEWORK")) forbidden();
        if (actor.roles().contains("ADMIN") || actor.roles().contains("ACADEMIC_MANAGER")) return;
        requireTeacherRelated(tenantId, classId, sessionId, true);
    }

    private void requireManageMaterial(UUID tenantId, UUID classId, UUID sessionId) {
        if (!actor.hasPermission("MANAGE_MATERIALS")) forbidden();
        if (actor.roles().contains("ADMIN") || actor.roles().contains("ACADEMIC_MANAGER")) return;
        requireTeacherRelated(tenantId, classId, sessionId, true);
    }

    private void requireTeacherRelated(UUID tenantId, UUID classId, UUID sessionId, boolean responsibleOnly) {
        UUID teacherId = currentTeacher(tenantId);
        boolean ok;
        if (sessionId != null) {
            ok = jdbc.sql("""
                    SELECT EXISTS(
                      SELECT 1 FROM class_sessions
                      WHERE tenant_id=:tenantId AND id=:sessionId AND class_id=:classId
                        AND (
                          (status='COMPLETED' AND actual_teacher_id=:teacherId)
                          OR (status<>'COMPLETED' AND planned_teacher_id=:teacherId)
                          OR (:responsibleOnly=false AND actual_teacher_id=:teacherId)
                        )
                    )
                    """)
                .param("tenantId", tenantId).param("sessionId", sessionId).param("classId", classId)
                .param("teacherId", teacherId).param("responsibleOnly", responsibleOnly)
                .query(Boolean.class).single();
        } else {
            ok = jdbc.sql("""
                    SELECT EXISTS(
                      SELECT 1 FROM classes c
                      WHERE c.tenant_id=:tenantId AND c.id=:classId AND c.primary_teacher_id=:teacherId
                    ) OR EXISTS(
                      SELECT 1 FROM class_teacher_assignments a
                      WHERE a.tenant_id=:tenantId AND a.class_id=:classId AND a.teacher_id=:teacherId
                      AND a.effective_from <= current_date
                      AND (a.effective_to IS NULL OR a.effective_to >= current_date)
                    ) OR (:responsibleOnly=false AND EXISTS(
                      SELECT 1 FROM class_sessions s
                      WHERE s.tenant_id=:tenantId AND s.class_id=:classId
                        AND (s.planned_teacher_id=:teacherId OR s.actual_teacher_id=:teacherId)
                    )
                    )
                    """)
                .param("tenantId", tenantId).param("classId", classId).param("teacherId", teacherId)
                .param("responsibleOnly", responsibleOnly)
                .query(Boolean.class).single();
        }
        if (!ok) forbidden();
    }

    private void requireSessionBelongsToClass(UUID tenantId, UUID classId, UUID sessionId) {
        sessionHomeworkState(tenantId, classId, sessionId);
    }

    private SessionHomeworkState sessionHomeworkState(UUID tenantId, UUID classId, UUID sessionId) {
        SessionHomeworkState state = jdbc.sql("""
                SELECT s.class_id, s.status AS session_status, c.status AS class_status,
                       s.planned_teacher_id, s.actual_teacher_id
                FROM class_sessions s
                JOIN classes c ON c.tenant_id=s.tenant_id AND c.id=s.class_id
                WHERE s.tenant_id=:tenantId AND s.id=:sessionId
                """)
            .param("tenantId", tenantId).param("sessionId", sessionId)
            .query((rs, row) -> new SessionHomeworkState(
                rs.getObject("class_id", UUID.class), rs.getString("session_status"),
                rs.getString("class_status"), rs.getObject("planned_teacher_id", UUID.class),
                rs.getObject("actual_teacher_id", UUID.class)))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "SESSION_NOT_FOUND", "Không tìm thấy buổi học."));
        if (!classId.equals(state.classId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "HOMEWORK_SESSION_CLASS_MISMATCH",
                "Buổi học không thuộc lớp đang tạo BTVN.");
        }
        return state;
    }

    private void requireSessionManageableForHomework(SessionHomeworkState state) {
        if ("CANCELLED".equals(state.sessionStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "HOMEWORK_SESSION_CANCELLED",
                "Không thể tạo BTVN cho buổi đã hủy.");
        }
        if (!CLASS_ACCESS_STATES.contains(state.classStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "HOMEWORK_SESSION_NOT_MANAGEABLE",
                "Lớp đã đóng hoặc hủy nên không thể tạo BTVN mới.");
        }
    }

    private void requireSessionRosterRecipients(UUID tenantId, UUID classId, UUID sessionId,
                                                List<UUID> studentIds) {
        if (studentIds.isEmpty()) return;
        boolean rosterFrozen = jdbc.sql("""
                SELECT roster_frozen_at IS NOT NULL
                FROM class_sessions
                WHERE tenant_id=:tenantId AND id=:sessionId AND class_id=:classId
                """)
            .param("tenantId", tenantId).param("classId", classId).param("sessionId", sessionId)
            .query(Boolean.class).single();
        List<UUID> roster = rosterFrozen
            ? jdbc.sql("""
                    SELECT student_id FROM session_roster_members
                    WHERE tenant_id=:tenantId AND session_id=:sessionId
                    """)
                .param("tenantId", tenantId).param("sessionId", sessionId).query(UUID.class).list()
            : jdbc.sql("""
                    SELECT e.student_id
                    FROM class_enrollments e
                    JOIN class_sessions s ON s.tenant_id=e.tenant_id AND s.class_id=e.class_id
                    WHERE e.tenant_id=:tenantId AND e.class_id=:classId AND s.id=:sessionId
                      AND e.effective_from <= (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                      AND (e.effective_to IS NULL OR e.effective_to >
                        (s.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                    """)
                .param("tenantId", tenantId).param("classId", classId).param("sessionId", sessionId)
                .query(UUID.class).list();
        Set<UUID> allowed = Set.copyOf(roster);
        for (UUID studentId : studentIds) {
            if (!allowed.contains(studentId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "RECIPIENT_NOT_IN_SESSION_ROSTER",
                    "Có học sinh không thuộc danh sách buổi học.", Map.of("studentId", studentId));
            }
        }
    }

    private void requireStudentHomeworkAccess(UUID tenantId, UUID studentId, UUID classId, UUID homeworkId) {
        requireStudentClassAccess(tenantId, studentId, classId);
        boolean recipient = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM homework_recipients
                  WHERE tenant_id=:tenantId AND homework_id=:homeworkId
                    AND student_id=:studentId AND removed_at IS NULL)
                """)
            .param("tenantId", tenantId).param("homeworkId", homeworkId).param("studentId", studentId)
            .query(Boolean.class).single();
        if (!recipient) forbidden();
    }

    private void requireStudentClassAccess(UUID tenantId, UUID studentId, UUID classId) {
        boolean ok = jdbc.sql("""
                SELECT EXISTS(
                  SELECT 1 FROM class_enrollments e
                  JOIN classes c ON c.tenant_id=e.tenant_id AND c.id=e.class_id
                  WHERE e.tenant_id=:tenantId AND e.class_id=:classId
                    AND e.student_id=:studentId AND e.status='ACTIVE'
                    AND c.status IN ('SCHEDULED','ACTIVE','AWAITING_CLOSE')
                )
                """)
            .param("tenantId", tenantId).param("classId", classId).param("studentId", studentId)
            .query(Boolean.class).single();
        if (!ok) {
            throw new ApiException(HttpStatus.FORBIDDEN, "STUDENT_CLASS_ACCESS_REVOKED",
                "Quyền truy cập nội dung lớp đã bị thu hồi.");
        }
    }

    private void requireClassActive(UUID tenantId, UUID classId) {
        String status = jdbc.sql("""
                SELECT status FROM classes WHERE tenant_id=:tenantId AND id=:classId
                """)
            .param("tenantId", tenantId).param("classId", classId).query(String.class).single();
        if (!CLASS_ACCESS_STATES.contains(status)) {
            throw new ApiException(HttpStatus.CONFLICT, "CLASS_NOT_ACTIVE_FOR_CONTENT",
                "Lớp không còn mở quyền truy cập nội dung.");
        }
    }

    private UUID currentStudent(UUID tenantId) {
        return jdbc.sql("""
                SELECT id FROM student_profiles WHERE tenant_id=:tenantId AND user_id=:userId
                """)
            .param("tenantId", tenantId).param("userId", actor.userId())
            .query(UUID.class).optional().orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN,
                "STUDENT_PROFILE_REQUIRED", "Tài khoản không có hồ sơ học sinh."));
    }

    private UUID currentTeacher(UUID tenantId) {
        return jdbc.sql("""
                SELECT id FROM teacher_profiles WHERE tenant_id=:tenantId AND user_id=:userId
                """)
            .param("tenantId", tenantId).param("userId", actor.userId())
            .query(UUID.class).optional().orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN,
                "TEACHER_PROFILE_REQUIRED", "Tài khoản không có hồ sơ giáo viên."));
    }

    private UUID studentUserId(UUID tenantId, UUID studentId) {
        return jdbc.sql("""
                SELECT user_id FROM student_profiles WHERE tenant_id=:tenantId AND id=:studentId
                """)
            .param("tenantId", tenantId).param("studentId", studentId).query(UUID.class).single();
    }

    private String normalizeAudience(String value) {
        String normalized = safe(value).trim().toUpperCase(Locale.ROOT);
        if (!Set.of("CLASS", "SELECTED").contains(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_HOMEWORK_AUDIENCE",
                "audienceType phải là CLASS hoặc SELECTED.");
        }
        return normalized;
    }

    private String normalizeReviewStatus(String value) {
        String normalized = safe(value).trim().toUpperCase(Locale.ROOT);
        if (!Set.of("REVIEWED", "REVISION_REQUESTED").contains(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REVIEW_STATUS",
                "status phải là REVIEWED hoặc REVISION_REQUESTED.");
        }
        return normalized;
    }

    private void validateHttpUrl(String url) {
        String value = safe(url).trim().toLowerCase(Locale.ROOT);
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LINK_URL",
                "Link chỉ nhận URL http/https.");
        }
    }

    private void requireVersion(long actual, long expected) {
        if (actual != expected) throw stale();
    }

    private ApiException stale() {
        return new ApiException(HttpStatus.CONFLICT, "OPTIMISTIC_LOCK_CONFLICT",
            "Dữ liệu đã được thay đổi. Vui lòng tải lại.");
    }

    private void page(int page, int pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                "page phải từ 1 và pageSize trong khoảng 1–100.");
        }
    }

    private ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "CONTENT_STATE_CONFLICT", message);
    }

    private String deadlineState(String status, OffsetDateTime deadlineAt) {
        if ("CLOSED".equals(status)) return "CLOSED";
        if (deadlineAt == null) return "NO_DEADLINE";
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        return now.isAfter(deadlineAt) ? "OVERDUE" : "UPCOMING";
    }

    private void forbidden() {
        throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
            "Bạn không có quyền thực hiện thao tác này.");
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private boolean isTeacherOnly() {
        return actor.roles().contains("TEACHER")
            && !actor.roles().contains("ADMIN")
            && !actor.roles().contains("ACADEMIC_MANAGER");
    }

    private record HomeworkRow(UUID id, UUID classId, UUID sessionId, String title,
                               String status, String audienceType, OffsetDateTime deadlineAt,
                               long version) {
    }

    private record HomeworkHead(UUID id, UUID classId, UUID sessionId, String classCode,
                                String className, Integer sessionOrdinal, String title,
                                String description, String audienceType, String status,
                                OffsetDateTime deadlineAt, OffsetDateTime publishedAt,
                                OffsetDateTime closedAt, long version) {
    }

    private record MaterialRow(UUID id, UUID classId, UUID sessionId, UUID fileId,
                               String status, long version) {
    }

    private record SessionHomeworkState(UUID classId, String sessionStatus, String classStatus,
                                        UUID plannedTeacherId, UUID actualTeacherId) {
    }

    private record SubmissionLock(UUID id, UUID studentId, long version, boolean currentAttempt) {
    }

    private record SubmissionBase(UUID id, UUID homeworkId, UUID studentId, String studentCode,
                                  String studentName, int attemptNo, String note,
                                  OffsetDateTime submittedAt, OffsetDateTime deadlineSnapshot,
                                  boolean late, String reviewStatus, long version) {
    }

    private record ReviewBase(UUID id, String status, String comment,
                              String reviewedBy, OffsetDateTime reviewedAt) {
    }

    private record FileOwner(String entityType, UUID entityId) {
    }
}
