package com.classops.backend.learningcontent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class ContentDtos {
    private ContentDtos() {
    }

    public enum FilePurpose {
        HOMEWORK_ATTACHMENT, SUBMISSION_IMAGE, REVIEW_ATTACHMENT, MATERIAL
    }

    public enum HomeworkStatus {
        DRAFT, PUBLISHED, CLOSED
    }

    public enum ReviewStatus {
        WAITING_REVIEW, REVIEWED, REVISION_REQUESTED
    }

    public record StoredFileView(
        UUID id,
        String token,
        String originalFilename,
        String contentType,
        long sizeBytes,
        String checksumSha256,
        OffsetDateTime expiresAt,
        String url,
        String previewUrl
    ) {
    }

    public record HomeworkLinkInput(@NotBlank String label, @NotBlank String url) {
    }

    public record CreateHomeworkInput(
        UUID sessionId,
        @NotBlank String title,
        String description,
        OffsetDateTime deadlineAt,
        @NotBlank String audienceType,
        List<UUID> studentIds,
        List<String> fileTokens,
        List<HomeworkLinkInput> links
    ) {
        public CreateHomeworkInput {
            studentIds = studentIds == null ? List.of() : List.copyOf(studentIds);
            fileTokens = fileTokens == null ? List.of() : List.copyOf(fileTokens);
            links = links == null ? List.of() : List.copyOf(links);
        }
    }

    public record UpdateHomeworkInput(
        @NotBlank String title,
        String description,
        OffsetDateTime deadlineAt,
        List<String> fileTokens,
        List<HomeworkLinkInput> links,
        @PositiveOrZero long version
    ) {
        public UpdateHomeworkInput {
            fileTokens = fileTokens == null ? List.of() : List.copyOf(fileTokens);
            links = links == null ? List.of() : List.copyOf(links);
        }
    }

    public record VersionInput(@PositiveOrZero long version) {
    }

    public record ReopenInput(@NotBlank String reason, @PositiveOrZero long version) {
    }

    public record RecipientInput(@NotEmpty List<@NotNull UUID> studentIds,
                                 @PositiveOrZero long version) {
        public RecipientInput {
            studentIds = studentIds == null ? List.of() : List.copyOf(studentIds);
        }
    }

    public record SubmitHomeworkInput(String note, @NotEmpty List<@NotBlank String> fileTokens) {
        public SubmitHomeworkInput {
            fileTokens = fileTokens == null ? List.of() : List.copyOf(fileTokens);
        }
    }

    public record ReviewInput(
        @NotBlank String status,
        String comment,
        List<String> fileTokens,
        @PositiveOrZero long submissionVersion
    ) {
        public ReviewInput {
            fileTokens = fileTokens == null ? List.of() : List.copyOf(fileTokens);
        }
    }

    public record CreateMaterialInput(
        UUID sessionId,
        @NotBlank String title,
        String description,
        @NotBlank String fileToken
    ) {
    }

    public record UpdateMaterialInput(
        @NotBlank String title,
        String description,
        String fileToken,
        @PositiveOrZero long version
    ) {
    }

    public record HomeworkResourceView(UUID id, String kind, String label, String url,
                                       StoredFileView file, int sortOrder) {
    }

    public record HomeworkRecipientView(UUID studentId, String code, String name,
                                        OffsetDateTime addedAt, boolean submitted,
                                        boolean removed) {
    }

    public record SubmissionView(
        UUID id,
        UUID homeworkId,
        UUID studentId,
        String studentCode,
        String studentName,
        int attemptNo,
        String note,
        OffsetDateTime submittedAt,
        OffsetDateTime deadlineSnapshot,
        boolean late,
        String reviewStatus,
        List<StoredFileView> files,
        ReviewView review,
        long version
    ) {
        public SubmissionView {
            files = List.copyOf(files);
        }
    }

    public record ReviewView(UUID id, String status, String comment, String reviewedBy,
                             OffsetDateTime reviewedAt, List<StoredFileView> files) {
        public ReviewView {
            files = List.copyOf(files);
        }
    }

    public record HomeworkSummary(
        UUID id,
        UUID classId,
        UUID sessionId,
        String classCode,
        String className,
        Integer sessionOrdinal,
        String title,
        String status,
        OffsetDateTime deadlineAt,
        int recipientCount,
        int submittedCount,
        int reviewedCount,
        long version
    ) {
    }

    public record HomeworkDetail(
        UUID id,
        UUID classId,
        UUID sessionId,
        String classCode,
        String className,
        Integer sessionOrdinal,
        String title,
        String description,
        String audienceType,
        String status,
        OffsetDateTime deadlineAt,
        OffsetDateTime publishedAt,
        OffsetDateTime closedAt,
        List<HomeworkResourceView> resources,
        List<HomeworkRecipientView> recipients,
        List<SubmissionView> submissions,
        long version
    ) {
        public HomeworkDetail {
            resources = List.copyOf(resources);
            recipients = List.copyOf(recipients);
            submissions = List.copyOf(submissions);
        }
    }

    public record MaterialView(
        UUID id,
        UUID classId,
        UUID sessionId,
        String classCode,
        String className,
        Integer sessionOrdinal,
        String title,
        String description,
        String status,
        StoredFileView file,
        String createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        long version
    ) {
    }

    public record HomeworkReportRow(UUID classId, String classCode, String className,
                                    String teacherName, int homeworkCount,
                                    int recipientCount, int submittedCount,
                                    int reviewedCount) {
    }

    public record NotificationView(UUID id, String eventType, String title, String body,
                                   OffsetDateTime readAt, OffsetDateTime createdAt) {
    }

    public record UnreadCount(long unread) {
    }

    public record AuditTimelineItem(UUID id, String action, String actorName,
                                    OffsetDateTime occurredAt, Object oldValue,
                                    Object newValue, String traceId) {
    }

    public record TenantStorageUsage(UUID tenantId, long quotaBytes, long usedBytes,
                                     long remainingBytes, long stagingBytes, long version) {
    }

    public record UpdateTenantQuotaInput(long quotaBytes, @PositiveOrZero long version) {
    }
}
