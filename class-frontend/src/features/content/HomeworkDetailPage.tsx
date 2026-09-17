import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  Maximize2,
  Pencil,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";
import type {
  HomeworkDetail,
  HomeworkResource,
  HomeworkSubmission,
  StoredFile,
  StudentHomeworkDetail,
} from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import {
  downloadPrivateFile,
  formatBytes,
  homeworkStatusLabel,
  homeworkStatusTone,
  isPreviewableImageFile,
  rate,
} from "./contentUtils";
import { FileTokenPicker } from "./FileTokenPicker";
import { PrivateFileImage } from "./PrivateFileImage";

const reviewLabels: Record<HomeworkSubmission["reviewStatus"], string> = {
  WAITING_REVIEW: "Chờ nhận xét",
  REVIEWED: "Đã nhận xét",
  REVISION_REQUESTED: "Yêu cầu làm lại",
};

const reviewSortRank: Record<HomeworkSubmission["reviewStatus"], number> = {
  WAITING_REVIEW: 0,
  REVISION_REQUESTED: 1,
  REVIEWED: 2,
};

type HomeworkPageDetail = HomeworkDetail | StudentHomeworkDetail;

export const HomeworkDetailPage = () => {
  const tenant = useTenant();
  const { session } = useAuth();
  const { homeworkId = "" } = useParams<{ homeworkId: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const canManage = Boolean(session && hasPermission(session.user.roles, PERMISSIONS.MANAGE_HOMEWORK));
  const canSubmit = Boolean(session && hasPermission(session.user.roles, PERMISSIONS.SUBMIT_HOMEWORK));
  const canReview = Boolean(session && hasPermission(session.user.roles, PERMISSIONS.REVIEW_HOMEWORK));
  const client = useQueryClient();
  const query = useQuery<HomeworkPageDetail>({
    queryKey: ["homework-detail", tenant.slug, homeworkId],
    queryFn: async () =>
      (canSubmit
        ? learningContentRepository.studentHomework(tenant.slug, homeworkId)
        : learningContentRepository.homework(tenant.slug, homeworkId)),
    retry: false,
  });
  const { showToast } = useToast();
  const invalidate = async () =>
    client.invalidateQueries({ queryKey: ["homework-detail", tenant.slug, homeworkId] });
  const action = useMutation({
    mutationFn: async (kind: "publish" | "close" | "reopen") => {
      if (!query.data) return null;
      if (kind === "publish") return learningContentRepository.publishHomework(tenant.slug, homeworkId, query.data.version);
      if (kind === "close") return learningContentRepository.closeHomework(tenant.slug, homeworkId, query.data.version);
      return learningContentRepository.reopenHomework(tenant.slug, homeworkId, "Mở lại theo yêu cầu học vụ", query.data.version);
    },
    onSuccess: async () => {
      await invalidate();
      showToast("Đã cập nhật trạng thái bài tập.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể cập nhật bài tập."),
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return <StatePanel kind="error" title="Không tải được bài tập" description="Bài tập không tồn tại hoặc bạn không còn quyền truy cập." />;
  }
  const item = query.data;
  const managementItem = item as HomeworkDetail;
  const submissions = "mySubmissions" in item ? item.mySubmissions : item.submissions;
  const currentByStudent = new Map<string, HomeworkSubmission>();
  submissions.forEach((submission) => {
    const current = currentByStudent.get(submission.studentId);
    if (!current || submission.attemptNo > current.attemptNo) currentByStudent.set(submission.studentId, submission);
  });
  const currentSubmissions = Array.from(currentByStudent.values()).sort((a, b) => {
    const statusDiff = reviewSortRank[a.reviewStatus] - reviewSortRank[b.reviewStatus];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
  return (
    <section className="content-page">
      <Link className="back-link" to={canSubmit ? `/t/${tenant.slug}/app/student-homeworks` : `/t/${tenant.slug}/app/homeworks`}>
        <ArrowLeft size={17} /> Quay lại
      </Link>
      <PageHeader
        eyebrow={`${item.classCode}${item.sessionOrdinal ? ` · Buổi ${item.sessionOrdinal}` : ""}`}
        title={item.title}
        subtitle={item.deadlineAt ? `Hạn nộp: ${formatDateTime(item.deadlineAt)}` : "Không có hạn nộp"}
        actions={
          <>
            <Badge tone={homeworkStatusTone[item.status]}>{homeworkStatusLabel[item.status]}</Badge>
            {canManage ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={16} /> Sửa đề bài
              </Button>
            ) : null}
            {canManage && item.status === "DRAFT" ? <Button onClick={() => action.mutate("publish")}><Send size={16} /> Giao bài</Button> : null}
            {canManage && item.status === "PUBLISHED" ? <Button variant="secondary" onClick={() => action.mutate("close")}><XCircle size={16} /> Đóng</Button> : null}
            {canManage && item.status === "CLOSED" ? <Button variant="secondary" onClick={() => action.mutate("reopen")}><RotateCcw size={16} /> Mở lại</Button> : null}
          </>
        }
      />
      <div className="homework-detail-layout">
        <section className="panel section-panel homework-brief-panel">
          <h2 className="section-title">Đề bài</h2>
          <p>{item.description || "Không có mô tả."}</p>
          <HomeworkResourcePanel tenantSlug={tenant.slug} resources={item.resources} />
        </section>
        <aside className="panel section-panel homework-side-panel">
          <h2 className="section-title">Tiến độ</h2>
          <dl className="content-stats large">
            <div><dt>Người nhận</dt><dd>{item.recipientCount}</dd></div>
            <div><dt>Đã nộp</dt><dd>{rate(item.submittedCount, item.recipientCount)}</dd></div>
            <div><dt>Đã nhận xét</dt><dd>{rate(item.reviewedCount, item.recipientCount)}</dd></div>
          </dl>
          {canSubmit ? (
            <div className="student-homework-personal-state">
              <strong>Trạng thái của em</strong>
              <span>
                {currentSubmissions[0]?.reviewStatus
                  ? reviewLabels[currentSubmissions[0].reviewStatus]
                  : "Cần làm"}
              </span>
            </div>
          ) : null}
        </aside>
      </div>
      <HomeworkEditModal
        tenantSlug={tenant.slug}
        homework={managementItem}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onDone={invalidate}
      />
      {canSubmit ? (
        <SubmitPanel
          tenantSlug={tenant.slug}
          homeworkId={homeworkId}
          open={"canSubmit" in item ? item.canSubmit : item.status === "PUBLISHED"}
          onDone={invalidate}
        />
      ) : null}
      {canReview || canManage ? (
        <section className="content-panel">
          <header className="content-section-head"><div><p className="eyebrow">BÀI ĐÃ NỘP</p><h2>Lượt nộp hiện tại</h2></div></header>
          {!currentSubmissions.length ? (
            <StatePanel kind="empty" title="Chưa có lượt nộp" description="Khi học sinh nộp bài, danh sách chờ nhận xét sẽ hiện ở đây." />
          ) : (
            <SubmissionTable
              tenantSlug={tenant.slug}
              homeworkId={homeworkId}
              submissions={currentSubmissions}
              canReview={canReview}
              onDone={invalidate}
            />
          )}
        </section>
      ) : null}
    </section>
  );
};

const isFileResource = (
  resource: HomeworkResource,
): resource is HomeworkResource & { file: StoredFile } =>
  resource.kind === "FILE" && Boolean(resource.file);

const toLocalDateTimeValue = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const HomeworkResourcePanel = ({
  tenantSlug,
  resources,
}: {
  tenantSlug: string;
  resources: HomeworkResource[];
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const fileResources = resources.filter(isFileResource);
  const imageResources = fileResources.filter((resource) => isPreviewableImageFile(resource.file));
  const downloadableResources = fileResources.filter(
    (resource) => !isPreviewableImageFile(resource.file),
  );
  const linkResources = resources.filter((resource) => resource.kind === "LINK" && resource.url);

  if (!resources.length) {
    return <p className="text-muted">Bài này chưa có file hoặc link đính kèm.</p>;
  }

  return (
    <div className="homework-resource-panel">
      {imageResources.length ? (
        <div
          className={`homework-image-gallery${imageResources.length === 1 ? " single" : ""}`}
          aria-label="Ảnh đính kèm đề bài"
        >
          {imageResources.map(({ id, file }) => (
            <button
              type="button"
              className="homework-image-tile"
              key={id}
              onClick={() => setActiveImageIndex(imageResources.findIndex((resource) => resource.id === id))}
            >
              <PrivateFileImage
                file={file}
                tenantSlug={tenantSlug}
                alt={file.originalFilename}
              />
              <span className="homework-image-caption">
                <Maximize2 size={15} aria-hidden="true" />
                {file.originalFilename}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {downloadableResources.length || linkResources.length ? (
        <div className="content-resource-list homework-resource-links">
          {linkResources.map((resource) => (
            <a
              key={resource.id}
              className="record-link"
              href={resource.url ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} aria-hidden="true" />
              {resource.label || resource.url}
            </a>
          ))}
          {downloadableResources.map(({ id, file }) => (
            <PrivateDownloadButton key={id} tenantSlug={tenantSlug} file={file} />
          ))}
        </div>
      ) : null}
      {activeImageIndex !== null ? (
        <HomeworkImageLightbox
          tenantSlug={tenantSlug}
          images={imageResources.map((resource) => resource.file)}
          index={activeImageIndex}
          onIndexChange={setActiveImageIndex}
          onClose={() => setActiveImageIndex(null)}
        />
      ) : null}
    </div>
  );
};

const PrivateDownloadButton = ({
  tenantSlug,
  file,
}: {
  tenantSlug: string;
  file: StoredFile;
}) => {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  return (
    <button
      type="button"
      className="record-link record-link-button"
      disabled={loading}
      onClick={() => {
        void (async () => {
          try {
            setLoading(true);
            await downloadPrivateFile(file, tenantSlug);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Không tải được file.");
          } finally {
            setLoading(false);
          }
        })();
      }}
    >
      <Download size={15} aria-hidden="true" /> {file.originalFilename} · {formatBytes(file.sizeBytes)}
    </button>
  );
};

const HomeworkImageLightbox = ({
  tenantSlug,
  images,
  index,
  onIndexChange,
  onClose,
}: {
  tenantSlug: string;
  images: StoredFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) => {
  const file = images[index];
  const { showToast } = useToast();
  const previous = () => onIndexChange((index - 1 + images.length) % images.length);
  const next = () => onIndexChange((index + 1) % images.length);
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") onIndexChange((index + 1) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, index, onClose, onIndexChange]);
  if (!file) return null;
  return (
    <div className="homework-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh bài tập">
      <button className="homework-lightbox-backdrop" type="button" onClick={onClose} aria-label="Đóng" />
      <div className="homework-lightbox-frame">
        <PrivateFileImage file={file} tenantSlug={tenantSlug} alt={file.originalFilename} />
        <div className="homework-lightbox-toolbar">
          <Button variant="secondary" onClick={previous} disabled={images.length < 2}>
            Trước
          </Button>
          <span>{index + 1}/{images.length}</span>
          <Button variant="secondary" onClick={next} disabled={images.length < 2}>
            Sau
          </Button>
          <Button
            onClick={() =>
              void downloadPrivateFile(file, tenantSlug).catch((error) =>
                showToast(error instanceof Error ? error.message : "Không tải được ảnh."),
              )
            }
          >
            <Download size={16} aria-hidden="true" />
            Tải xuống
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};

const HomeworkEditModal = ({
  tenantSlug,
  homework,
  open,
  onClose,
  onDone,
}: {
  tenantSlug: string;
  homework: HomeworkDetail;
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) => {
  if (!open) return null;
  return (
    <HomeworkEditModalContent
      key={`${homework.id}-${homework.version}`}
      tenantSlug={tenantSlug}
      homework={homework}
      onClose={onClose}
      onDone={onDone}
    />
  );
};

const HomeworkEditModalContent = ({
  tenantSlug,
  homework,
  onClose,
  onDone,
}: {
  tenantSlug: string;
  homework: HomeworkDetail;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) => {
  const [title, setTitle] = useState(homework.title);
  const [description, setDescription] = useState(homework.description);
  const [deadlineAt, setDeadlineAt] = useState(toLocalDateTimeValue(homework.deadlineAt));
  const [link, setLink] = useState(
    homework.resources.find((resource) => resource.kind === "LINK" && resource.url)?.url ?? "",
  );
  const [files, setFiles] = useState<StoredFile[]>(
    homework.resources.filter(isFileResource).map((resource) => resource.file),
  );
  const { showToast } = useToast();

  const linkInvalid = Boolean(link.trim()) && !/^https?:\/\/\S+$/i.test(link.trim());
  const mutation = useMutation({
    mutationFn: () =>
      learningContentRepository.updateHomework(tenantSlug, homework.id, {
        title,
        description,
        deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        fileIds: files.filter((file) => !file.token).map((file) => file.id),
        fileTokens: files.map((file) => file.token).filter((token): token is string => Boolean(token)),
        links: link.trim() ? [{ label: "Link học tập", url: link.trim() }] : [],
        version: homework.version,
      }),
    onSuccess: async () => {
      await onDone();
      onClose();
      showToast("Đã cập nhật bài tập.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể cập nhật bài tập."),
  });

  return (
    <Modal
      open
      title="Sửa nội dung bài tập"
      className="homework-create-modal"
      onClose={onClose}
      confirmLabel="Lưu thay đổi"
      confirmDisabled={!title.trim() || linkInvalid}
      confirmLoading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    >
      <div className="content-form homework-create-form">
        <Input label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Input
          label="Hạn nộp"
          type="datetime-local"
          value={deadlineAt}
          onChange={(event) => setDeadlineAt(event.target.value)}
        />
        <Textarea
          label="Mô tả"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Input
          label="Link http/https"
          value={link}
          error={linkInvalid ? "Link phải bắt đầu bằng http:// hoặc https://." : undefined}
          onChange={(event) => setLink(event.target.value)}
        />
        <FileTokenPicker tenantSlug={tenantSlug} purpose="HOMEWORK_ATTACHMENT" files={files} onChange={setFiles} />
      </div>
    </Modal>
  );
};

const SubmitPanel = ({
  tenantSlug,
  homeworkId,
  open,
  onDone,
}: {
  tenantSlug: string;
  homeworkId: string;
  open: boolean;
  onDone: () => Promise<unknown>;
}) => {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      learningContentRepository.submitHomework(
        tenantSlug,
        homeworkId,
        note,
        files.map((file) => file.token).filter((token): token is string => Boolean(token)),
      ),
    onSuccess: async () => {
      setNote("");
      setFiles([]);
      await onDone();
      showToast("Đã nộp bài.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể nộp bài."),
  });
  return (
    <section className="panel section-panel submit-panel">
      <h2 className="section-title">Nộp bài</h2>
      {!open ? <p className="text-muted">Bài tập đang đóng nên bạn chỉ có thể xem lịch sử.</p> : null}
      <Textarea label="Ghi chú" value={note} disabled={!open} onChange={(event) => setNote(event.target.value)} />
      <FileTokenPicker tenantSlug={tenantSlug} purpose="SUBMISSION_IMAGE" files={files} onChange={setFiles} maxFiles={10} />
      <Button disabled={!open || files.length === 0} loading={mutation.isPending} onClick={() => mutation.mutate()}>
        <Send size={16} /> Nộp lượt mới
      </Button>
    </section>
  );
};

const SubmissionTable = ({
  tenantSlug,
  homeworkId,
  submissions,
  canReview,
  onDone,
}: {
  tenantSlug: string;
  homeworkId: string;
  submissions: HomeworkSubmission[];
  canReview: boolean;
  onDone: () => Promise<unknown>;
}) => (
  <div className="table-shell submission-table-shell">
    <table className="data-table submission-table">
      <thead>
        <tr>
          <th>Học sinh</th>
          <th>Lượt nộp</th>
          <th>File bài làm</th>
          <th>Ghi chú</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {submissions.map((submission) => (
          <SubmissionRow
            key={submission.id}
            tenantSlug={tenantSlug}
            homeworkId={homeworkId}
            submission={submission}
            canReview={canReview}
            onDone={onDone}
          />
        ))}
      </tbody>
    </table>
  </div>
);

const SubmissionRow = ({
  tenantSlug,
  homeworkId,
  submission,
  canReview,
  onDone,
}: {
  tenantSlug: string;
  homeworkId: string;
  submission: HomeworkSubmission;
  canReview: boolean;
  onDone: () => Promise<unknown>;
}) => {
  const [reviewOpen, setReviewOpen] = useState(false);
  return (
    <tr>
      <td>
        <strong>{submission.studentName}</strong>
        <small>{submission.studentCode}</small>
      </td>
      <td>
        <strong>Lượt {submission.attemptNo}</strong>
        <small>{formatDateTime(submission.submittedAt)}{submission.late ? " · Trễ" : ""}</small>
      </td>
      <td>
        <SubmissionFileList tenantSlug={tenantSlug} files={submission.files} />
      </td>
      <td>
        <span className="submission-note-cell">{submission.note || "Không có ghi chú."}</span>
      </td>
      <td>
        <Badge tone={submission.reviewStatus === "REVIEWED" ? "success" : submission.reviewStatus === "REVISION_REQUESTED" ? "warning" : "neutral"}>
          {reviewLabels[submission.reviewStatus]}
        </Badge>
        {submission.review ? (
          <span className="submission-review-inline">
            <CheckCircle2 size={14} aria-hidden="true" />
            {submission.review.comment || "Đã nhận xét, không có nội dung bổ sung."}
          </span>
        ) : null}
      </td>
      <td>
        <div className="row-actions submission-row-actions">
          {canReview ? <Button variant="secondary" onClick={() => setReviewOpen(true)}>Nhận xét bài làm</Button> : null}
        </div>
        <ReviewModal
          tenantSlug={tenantSlug}
          homeworkId={homeworkId}
          submission={submission}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onDone={onDone}
        />
      </td>
    </tr>
  );
};

const SubmissionFileList = ({
  tenantSlug,
  files,
}: {
  tenantSlug: string;
  files: StoredFile[];
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const imageFiles = files.filter(isPreviewableImageFile);
  if (!files.length) return <span className="text-muted">Không có file</span>;

  return (
    <div className="submission-file-list">
      {files.map((file) => {
        const imageIndex = imageFiles.findIndex((image) => image.id === file.id);
        if (imageIndex >= 0) {
          return (
            <button
              key={file.id}
              type="button"
              className="submission-file-chip image"
              onClick={() => setActiveImageIndex(imageIndex)}
              title={`Xem ảnh ${file.originalFilename}`}
            >
              <Eye size={15} aria-hidden="true" />
              <span>{file.originalFilename}</span>
            </button>
          );
        }
        return <PrivateDownloadButton key={file.id} tenantSlug={tenantSlug} file={file} />;
      })}
      {activeImageIndex !== null ? (
        <HomeworkImageLightbox
          tenantSlug={tenantSlug}
          images={imageFiles}
          index={activeImageIndex}
          onIndexChange={setActiveImageIndex}
          onClose={() => setActiveImageIndex(null)}
        />
      ) : null}
    </div>
  );
};

const ReviewModal = ({
  tenantSlug,
  homeworkId,
  submission,
  open,
  onClose,
  onDone,
}: {
  tenantSlug: string;
  homeworkId: string;
  submission: HomeworkSubmission;
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) => {
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"REVIEWED" | "REVISION_REQUESTED">("REVIEWED");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      learningContentRepository.reviewSubmission(tenantSlug, homeworkId, submission.id, {
        status,
        comment,
        fileTokens: files.map((file) => file.token).filter((token): token is string => Boolean(token)),
        submissionVersion: submission.version,
      }),
    onSuccess: async () => {
      await onDone();
      onClose();
      showToast("Đã lưu nhận xét.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể lưu nhận xét. Vui lòng thử lại."),
  });
  return (
    <Modal open={open} title={`Nhận xét bài của ${submission.studentName}`} onClose={onClose} confirmLabel="Lưu nhận xét" confirmLoading={mutation.isPending} onConfirm={() => mutation.mutate()}>
      <div className="content-form">
        <label className="field">
          <span className="field-label">Kết quả</span>
          <select className="control" value={status} onChange={(event) => setStatus(event.target.value as "REVIEWED" | "REVISION_REQUESTED")}>
            <option value="REVIEWED">Đã nhận xét</option>
            <option value="REVISION_REQUESTED">Yêu cầu làm lại</option>
          </select>
        </label>
        <Textarea label="Nhận xét tùy chọn" value={comment} onChange={(event) => setComment(event.target.value)} />
        <FileTokenPicker tenantSlug={tenantSlug} purpose="REVIEW_ATTACHMENT" files={files} onChange={setFiles} />
      </div>
    </Modal>
  );
};
