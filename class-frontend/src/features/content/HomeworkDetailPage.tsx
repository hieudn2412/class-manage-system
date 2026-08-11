import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, RotateCcw, Send, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";
import type { HomeworkSubmission, StoredFile } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { fileHref, formatBytes, homeworkStatusLabel, homeworkStatusTone, rate } from "./contentUtils";
import { FileTokenPicker } from "./FileTokenPicker";

const reviewLabels: Record<HomeworkSubmission["reviewStatus"], string> = {
  WAITING_REVIEW: "Chờ chữa",
  REVIEWED: "Đã chữa",
  REVISION_REQUESTED: "Yêu cầu làm lại",
};

export const HomeworkDetailPage = () => {
  const tenant = useTenant();
  const { session } = useAuth();
  const { homeworkId = "" } = useParams<{ homeworkId: string }>();
  const canManage = Boolean(session && hasPermission(session.user.roles, PERMISSIONS.MANAGE_HOMEWORK));
  const canSubmit = Boolean(session && hasPermission(session.user.roles, PERMISSIONS.SUBMIT_HOMEWORK));
  const canReview = Boolean(session && hasPermission(session.user.roles, PERMISSIONS.REVIEW_HOMEWORK));
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["homework-detail", tenant.slug, homeworkId],
    queryFn: () =>
      canSubmit
        ? learningContentRepository.studentHomework(tenant.slug, homeworkId)
        : learningContentRepository.homework(tenant.slug, homeworkId),
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
      showToast("Trạng thái BTVN đã cập nhật.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể cập nhật BTVN."),
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return <StatePanel kind="error" title="Không tải được BTVN" description="Bài không tồn tại hoặc bạn không còn quyền truy cập." />;
  }
  const item = query.data;
  const currentByStudent = new Map<string, HomeworkSubmission>();
  item.submissions.forEach((submission) => {
    const current = currentByStudent.get(submission.studentId);
    if (!current || submission.attemptNo > current.attemptNo) currentByStudent.set(submission.studentId, submission);
  });
  const currentSubmissions = Array.from(currentByStudent.values());
  return (
    <section className="content-page">
      <Link className="back-link" to={canSubmit ? `/t/${tenant.slug}/app/student-homeworks` : `/t/${tenant.slug}/app/homeworks`}>
        <ArrowLeft size={17} /> Quay lại
      </Link>
      <PageHeader
        eyebrow={`${item.classCode}${item.sessionOrdinal ? ` · Buổi ${item.sessionOrdinal}` : ""}`}
        title={item.title}
        subtitle={item.deadlineAt ? `Deadline: ${formatDateTime(item.deadlineAt)}` : "Không đặt deadline"}
        actions={
          <>
            <Badge tone={homeworkStatusTone[item.status]}>{homeworkStatusLabel[item.status]}</Badge>
            {canManage && item.status === "DRAFT" ? <Button onClick={() => action.mutate("publish")}><Send size={16} /> Publish</Button> : null}
            {canManage && item.status === "PUBLISHED" ? <Button variant="secondary" onClick={() => action.mutate("close")}><XCircle size={16} /> Đóng</Button> : null}
            {canManage && item.status === "CLOSED" ? <Button variant="secondary" onClick={() => action.mutate("reopen")}><RotateCcw size={16} /> Mở lại</Button> : null}
          </>
        }
      />
      <div className="content-detail-grid">
        <section className="panel section-panel">
          <h2 className="section-title">Đề bài</h2>
          <p>{item.description || "Không có mô tả."}</p>
          <div className="content-resource-list">
            {item.resources.map((resource) =>
              resource.kind === "LINK" ? (
                <a key={resource.id} className="record-link" href={resource.url ?? "#"} target="_blank" rel="noreferrer">
                  {resource.label || resource.url}
                </a>
              ) : resource.file ? (
                <a key={resource.id} className="record-link" href={fileHref(resource.file)} target="_blank" rel="noreferrer">
                  <Download size={15} /> {resource.file.originalFilename} · {formatBytes(resource.file.sizeBytes)}
                </a>
              ) : null,
            )}
          </div>
        </section>
        <section className="panel section-panel">
          <h2 className="section-title">Tiến độ</h2>
          <dl className="content-stats large">
            <div><dt>Người nhận</dt><dd>{item.recipientCount}</dd></div>
            <div><dt>Đã nộp</dt><dd>{rate(item.submittedCount, item.recipientCount)}</dd></div>
            <div><dt>Đã chữa</dt><dd>{rate(item.reviewedCount, item.recipientCount)}</dd></div>
          </dl>
        </section>
      </div>
      {canSubmit ? <SubmitPanel tenantSlug={tenant.slug} homeworkId={homeworkId} open={item.status === "PUBLISHED"} onDone={invalidate} /> : null}
      {canReview || canManage ? (
        <section className="content-panel">
          <header className="content-section-head"><div><p className="eyebrow">SUBMISSIONS</p><h2>Lượt nộp hiện tại</h2></div></header>
          {!currentSubmissions.length ? (
            <StatePanel kind="empty" title="Chưa có lượt nộp" description="Khi học sinh nộp bài, hàng đợi chữa sẽ hiện ở đây." />
          ) : (
            <div className="content-card-grid">
              {currentSubmissions.map((submission) => (
                <SubmissionCard key={submission.id} tenantSlug={tenant.slug} homeworkId={homeworkId} submission={submission} canReview={canReview} onDone={invalidate} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </section>
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
      {!open ? <p className="text-muted">BTVN đang đóng, bạn chỉ có thể xem lịch sử.</p> : null}
      <Textarea label="Ghi chú" value={note} disabled={!open} onChange={(event) => setNote(event.target.value)} />
      <FileTokenPicker tenantSlug={tenantSlug} purpose="SUBMISSION_IMAGE" files={files} onChange={setFiles} maxFiles={10} />
      <Button disabled={!open || files.length === 0} loading={mutation.isPending} onClick={() => mutation.mutate()}>
        <Send size={16} /> Nộp lượt mới
      </Button>
    </section>
  );
};

const SubmissionCard = ({
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
    <article className="content-card">
      <header>
        <span>
          <strong>{submission.studentName}</strong>
          <small>Lượt {submission.attemptNo} · {formatDateTime(submission.submittedAt)}{submission.late ? " · Trễ" : ""}</small>
        </span>
        <Badge tone={submission.reviewStatus === "REVIEWED" ? "success" : submission.reviewStatus === "REVISION_REQUESTED" ? "warning" : "neutral"}>
          {reviewLabels[submission.reviewStatus]}
        </Badge>
      </header>
      <p>{submission.note || "Không có ghi chú."}</p>
      <div className="content-resource-list">
        {submission.files.map((file) => (
          <a key={file.id} className="record-link" href={fileHref(file)} target="_blank" rel="noreferrer">
            <Download size={15} /> {file.originalFilename}
          </a>
        ))}
      </div>
      {submission.review ? (
        <div className="review-note">
          <CheckCircle2 size={16} />
          <span>{submission.review.comment || "Đã chữa không kèm nhận xét."}</span>
        </div>
      ) : null}
      {canReview ? <Button variant="secondary" onClick={() => setReviewOpen(true)}>Chữa lượt này</Button> : null}
      <ReviewModal
        tenantSlug={tenantSlug}
        homeworkId={homeworkId}
        submission={submission}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onDone={onDone}
      />
    </article>
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
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể chữa bài."),
  });
  return (
    <Modal open={open} title={`Chữa bài ${submission.studentName}`} onClose={onClose} confirmLabel="Lưu nhận xét" confirmLoading={mutation.isPending} onConfirm={() => mutation.mutate()}>
      <div className="content-form">
        <label className="field">
          <span className="field-label">Kết quả</span>
          <select className="control" value={status} onChange={(event) => setStatus(event.target.value as "REVIEWED" | "REVISION_REQUESTED")}>
            <option value="REVIEWED">Đã chữa</option>
            <option value="REVISION_REQUESTED">Yêu cầu làm lại</option>
          </select>
        </label>
        <Textarea label="Nhận xét tùy chọn" value={comment} onChange={(event) => setComment(event.target.value)} />
        <FileTokenPicker tenantSlug={tenantSlug} purpose="REVIEW_ATTACHMENT" files={files} onChange={setFiles} />
      </div>
    </Modal>
  );
};
