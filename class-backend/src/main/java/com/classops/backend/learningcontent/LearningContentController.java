package com.classops.backend.learningcontent;

import com.classops.backend.common.PageResponse;
import com.classops.backend.learningcontent.ContentDtos.AuditTimelineItem;
import com.classops.backend.learningcontent.ContentDtos.CreateHomeworkInput;
import com.classops.backend.learningcontent.ContentDtos.CreateMaterialInput;
import com.classops.backend.learningcontent.ContentDtos.FilePurpose;
import com.classops.backend.learningcontent.ContentDtos.HomeworkDetail;
import com.classops.backend.learningcontent.ContentDtos.HomeworkReportRow;
import com.classops.backend.learningcontent.ContentDtos.HomeworkSummary;
import com.classops.backend.learningcontent.ContentDtos.MaterialView;
import com.classops.backend.learningcontent.ContentDtos.NotificationView;
import com.classops.backend.learningcontent.ContentDtos.RecipientInput;
import com.classops.backend.learningcontent.ContentDtos.ReopenInput;
import com.classops.backend.learningcontent.ContentDtos.ReviewInput;
import com.classops.backend.learningcontent.ContentDtos.StoredFileView;
import com.classops.backend.learningcontent.ContentDtos.SubmissionView;
import com.classops.backend.learningcontent.ContentDtos.SubmitHomeworkInput;
import com.classops.backend.learningcontent.ContentDtos.TenantStorageUsage;
import com.classops.backend.learningcontent.ContentDtos.UnreadCount;
import com.classops.backend.learningcontent.ContentDtos.UpdateHomeworkInput;
import com.classops.backend.learningcontent.ContentDtos.UpdateMaterialInput;
import com.classops.backend.learningcontent.ContentDtos.UpdateTenantQuotaInput;
import com.classops.backend.learningcontent.ContentDtos.VersionInput;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "FL-10 homework and materials")
@SecurityRequirement(name = "bearerAuth")
public class LearningContentController {
    private final LearningContentService content;
    private final FileStorageService storage;

    public LearningContentController(LearningContentService content, FileStorageService storage) {
        this.content = content;
        this.storage = storage;
    }

    @PostMapping("/uploads/staging")
    @PreAuthorize("hasAnyAuthority('MANAGE_HOMEWORK','SUBMIT_HOMEWORK','MANAGE_MATERIALS','REVIEW_HOMEWORK')")
    StoredFileView upload(@RequestParam MultipartFile file, @RequestParam FilePurpose purpose) {
        return storage.upload(file, purpose);
    }

    @GetMapping("/files/{fileId}/content")
    @PreAuthorize("isAuthenticated()")
    ResponseEntity<Resource> file(@PathVariable UUID fileId,
                                  @RequestHeader(value = "Range", required = false) String range) {
        return content.fileContent(fileId, range);
    }

    @GetMapping("/classes/{classId}/homeworks")
    @PreAuthorize("hasAnyAuthority('VIEW_HOMEWORK','VIEW_OWN_LEARNING')")
    PageResponse<HomeworkSummary> classHomeworks(
        @PathVariable UUID classId,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return content.classHomeworks(classId, status, page, pageSize);
    }

    @PostMapping("/classes/{classId}/homeworks")
    @PreAuthorize("hasAuthority('MANAGE_HOMEWORK')")
    HomeworkDetail createHomework(@PathVariable UUID classId,
                                  @Valid @RequestBody CreateHomeworkInput input,
                                  @RequestHeader("Idempotency-Key") String key) {
        return content.createHomework(classId, input, key);
    }

    @GetMapping("/homeworks/{homeworkId}")
    @PreAuthorize("hasAnyAuthority('VIEW_HOMEWORK','VIEW_OWN_LEARNING')")
    HomeworkDetail homework(@PathVariable UUID homeworkId) {
        return content.homework(homeworkId);
    }

    @PatchMapping("/homeworks/{homeworkId}")
    @PreAuthorize("hasAuthority('MANAGE_HOMEWORK')")
    HomeworkDetail updateHomework(@PathVariable UUID homeworkId,
                                  @Valid @RequestBody UpdateHomeworkInput input) {
        return content.updateHomework(homeworkId, input);
    }

    @PostMapping("/homeworks/{homeworkId}/publish")
    @PreAuthorize("hasAuthority('MANAGE_HOMEWORK')")
    HomeworkDetail publish(@PathVariable UUID homeworkId,
                           @Valid @RequestBody VersionInput input,
                           @RequestHeader("Idempotency-Key") String key) {
        return content.publishHomework(homeworkId, input, key);
    }

    @PostMapping("/homeworks/{homeworkId}/close")
    @PreAuthorize("hasAuthority('MANAGE_HOMEWORK')")
    HomeworkDetail close(@PathVariable UUID homeworkId,
                         @Valid @RequestBody VersionInput input,
                         @RequestHeader("Idempotency-Key") String key) {
        return content.closeHomework(homeworkId, input, key);
    }

    @PostMapping("/homeworks/{homeworkId}/reopen")
    @PreAuthorize("hasAuthority('MANAGE_HOMEWORK')")
    HomeworkDetail reopen(@PathVariable UUID homeworkId,
                          @Valid @RequestBody ReopenInput input,
                          @RequestHeader("Idempotency-Key") String key) {
        return content.reopenHomework(homeworkId, input, key);
    }

    @PostMapping("/homeworks/{homeworkId}/recipients")
    @PreAuthorize("hasAuthority('MANAGE_HOMEWORK')")
    HomeworkDetail addRecipients(@PathVariable UUID homeworkId,
                                 @Valid @RequestBody RecipientInput input,
                                 @RequestHeader("Idempotency-Key") String key) {
        return content.addRecipients(homeworkId, input, key);
    }

    @DeleteMapping("/homeworks/{homeworkId}/recipients/{studentId}")
    @PreAuthorize("hasAuthority('MANAGE_HOMEWORK')")
    HomeworkDetail removeRecipient(@PathVariable UUID homeworkId,
                                   @PathVariable UUID studentId,
                                   @RequestParam long version) {
        return content.removeRecipient(homeworkId, studentId, version);
    }

    @GetMapping("/students/me/homeworks")
    @PreAuthorize("hasAuthority('VIEW_OWN_LEARNING')")
    PageResponse<HomeworkSummary> studentHomeworks(
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return content.studentHomeworks(status, page, pageSize);
    }

    @GetMapping("/students/me/homeworks/{homeworkId}")
    @PreAuthorize("hasAuthority('VIEW_OWN_LEARNING')")
    HomeworkDetail studentHomework(@PathVariable UUID homeworkId) {
        return content.homework(homeworkId);
    }

    @PostMapping("/students/me/homeworks/{homeworkId}/submissions")
    @PreAuthorize("hasAuthority('SUBMIT_HOMEWORK')")
    SubmissionView submit(@PathVariable UUID homeworkId,
                          @Valid @RequestBody SubmitHomeworkInput input,
                          @RequestHeader("Idempotency-Key") String key) {
        return content.submit(homeworkId, input, key);
    }

    @PostMapping("/homeworks/{homeworkId}/submissions/{submissionId}/reviews")
    @PreAuthorize("hasAuthority('REVIEW_HOMEWORK')")
    SubmissionView review(@PathVariable UUID homeworkId,
                          @PathVariable UUID submissionId,
                          @Valid @RequestBody ReviewInput input,
                          @RequestHeader("Idempotency-Key") String key) {
        return content.review(homeworkId, submissionId, input, key);
    }

    @GetMapping("/classes/{classId}/materials")
    @PreAuthorize("hasAnyAuthority('VIEW_MATERIALS','VIEW_OWN_LEARNING')")
    PageResponse<MaterialView> materials(
        @PathVariable UUID classId,
        @RequestParam(required = false) UUID sessionId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return content.materials(classId, sessionId, page, pageSize);
    }

    @PostMapping("/classes/{classId}/materials")
    @PreAuthorize("hasAuthority('MANAGE_MATERIALS')")
    MaterialView createMaterial(@PathVariable UUID classId,
                                @Valid @RequestBody CreateMaterialInput input,
                                @RequestHeader("Idempotency-Key") String key) {
        return content.createMaterial(classId, input, key);
    }

    @PatchMapping("/materials/{materialId}")
    @PreAuthorize("hasAuthority('MANAGE_MATERIALS')")
    MaterialView updateMaterial(@PathVariable UUID materialId,
                                @Valid @RequestBody UpdateMaterialInput input) {
        return content.updateMaterial(materialId, input);
    }

    @DeleteMapping("/materials/{materialId}")
    @PreAuthorize("hasAuthority('MANAGE_MATERIALS')")
    void removeMaterial(@PathVariable UUID materialId, @RequestParam long version) {
        content.removeMaterial(materialId, version);
    }

    @GetMapping("/homework-reports")
    @PreAuthorize("hasAuthority('VIEW_HOMEWORK')")
    PageResponse<HomeworkReportRow> report(
        @RequestParam(required = false) UUID classId,
        @RequestParam(required = false) UUID teacherId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return content.report(classId, teacherId, page, pageSize);
    }

    @GetMapping("/notifications")
    @PreAuthorize("hasAuthority('VIEW_NOTIFICATIONS')")
    PageResponse<NotificationView> notifications(
        @RequestParam(defaultValue = "false") boolean unreadOnly,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return content.notifications(unreadOnly, page, pageSize);
    }

    @GetMapping("/notifications/unread-count")
    @PreAuthorize("hasAuthority('VIEW_NOTIFICATIONS')")
    UnreadCount unreadCount() {
        return new UnreadCount(content.unreadCount());
    }

    @PatchMapping("/notifications/{notificationId}/read")
    @PreAuthorize("hasAuthority('VIEW_NOTIFICATIONS')")
    void markRead(@PathVariable UUID notificationId) {
        content.markNotificationRead(notificationId);
    }

    @PatchMapping("/notifications/read-all")
    @PreAuthorize("hasAuthority('VIEW_NOTIFICATIONS')")
    void markAllRead() {
        content.markAllNotificationsRead();
    }

    @GetMapping("/audit-timeline")
    @PreAuthorize("hasAnyAuthority('VIEW_HOMEWORK','VIEW_MATERIALS')")
    List<AuditTimelineItem> auditTimeline(@RequestParam String entityType,
                                          @RequestParam UUID entityId) {
        return content.timeline(entityType, entityId);
    }

    @GetMapping("/storage/usage")
    @PreAuthorize("hasAuthority('VIEW_STORAGE_USAGE')")
    TenantStorageUsage tenantUsage() {
        return content.tenantUsage();
    }

    @GetMapping("/platform/tenants/{tenantId}/quota")
    @PreAuthorize("hasAuthority('MANAGE_TENANT_QUOTA')")
    TenantStorageUsage platformUsage(@PathVariable UUID tenantId) {
        return content.platformTenantUsage(tenantId);
    }

    @PatchMapping("/platform/tenants/{tenantId}/quota")
    @PreAuthorize("hasAuthority('MANAGE_TENANT_QUOTA')")
    TenantStorageUsage updatePlatformQuota(@PathVariable UUID tenantId,
                                           @Valid @RequestBody UpdateTenantQuotaInput input) {
        return content.updateTenantQuota(tenantId, input.quotaBytes(), input.version());
    }
}
