import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, UsersRound } from "lucide-react";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { ApiError } from "../../shared/types/api";
import type { HomeworkDetail, StoredFile } from "../../shared/types/domain";
import { Button } from "../../shared/ui/Button";
import { Input, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { useToast } from "../../shared/ui/Toast";
import { FileTokenPicker } from "./FileTokenPicker";

export interface HomeworkAudienceStudent {
  studentId: string;
  code: string;
  name: string;
}

interface HomeworkCreateModalProps {
  tenantSlug: string;
  classId: string;
  className?: string;
  sessionId?: string | null;
  sessionOrdinal?: number | null;
  students?: HomeworkAudienceStudent[];
  open: boolean;
  onClose: () => void;
  onCreated: (homework: HomeworkDetail) => void | Promise<void>;
  onExisting?: (homeworkId: string) => void | Promise<void>;
}

export const HomeworkCreateModal = ({
  tenantSlug,
  classId,
  className,
  sessionId = null,
  sessionOrdinal = null,
  students,
  open,
  onClose,
  onCreated,
  onExisting,
}: HomeworkCreateModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [link, setLink] = useState("");
  const [audienceType, setAudienceType] = useState<"CLASS" | "SELECTED">("CLASS");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const { showToast } = useToast();

  const rosterQuery = useQuery({
    queryKey: ["homework-create-session-roster", tenantSlug, sessionId],
    queryFn: () => teachingRepository.getSession(tenantSlug, sessionId ?? ""),
    enabled: open && Boolean(sessionId) && students === undefined,
  });

  const audienceStudents = useMemo(
    () =>
      students ??
      rosterQuery.data?.students.map((student) => ({
        studentId: student.studentId,
        code: student.code,
        name: student.name,
      })) ??
      [],
    [rosterQuery.data?.students, students],
  );

  const audienceStudentIds = useMemo(
    () => new Set(audienceStudents.map((student) => student.studentId)),
    [audienceStudents],
  );
  const validSelectedStudentIds = selectedStudentIds.filter((studentId) =>
    audienceStudentIds.has(studentId),
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDeadlineAt("");
    setFiles([]);
    setLink("");
    setAudienceType("CLASS");
    setSelectedStudentIds([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const linkInvalid = Boolean(link.trim()) && !/^https?:\/\/\S+$/i.test(link.trim());
  const selectedAudienceInvalid =
    audienceType === "SELECTED" && validSelectedStudentIds.length === 0;
  const confirmDisabled =
    !title.trim() ||
    linkInvalid ||
    selectedAudienceInvalid ||
    (audienceType === "SELECTED" && rosterQuery.isFetching);

  const mutation = useMutation({
    mutationFn: () =>
      learningContentRepository.createHomework(tenantSlug, classId, {
        sessionId,
        title,
        description,
        deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        audienceType,
        studentIds: audienceType === "SELECTED" ? validSelectedStudentIds : [],
        fileTokens: files
          .map((file) => file.token)
          .filter((token): token is string => Boolean(token)),
        links: link.trim() ? [{ label: "Link học tập", url: link.trim() }] : [],
      }),
    onSuccess: async (homework) => {
      await onCreated(homework);
      showToast("Đã giao bài tập về nhà.");
      resetForm();
      onClose();
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        error.code === "HOMEWORK_ALREADY_EXISTS_FOR_SESSION" &&
        typeof error.details?.homeworkId === "string" &&
        onExisting
      ) {
        resetForm();
        onClose();
        await onExisting(error.details.homeworkId);
      }
    },
  });

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((item) => item !== studentId)
        : [...current, studentId],
    );
  };

  return (
    <Modal
      open={open}
      title={sessionId ? "Giao bài tập cho buổi học" : "Tạo bài tập về nhà"}
      className="homework-create-modal"
      onClose={handleClose}
      confirmLabel="Giao bài tập"
      confirmVariant="accent"
      confirmDisabled={confirmDisabled}
      confirmLoading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    >
      <div className="content-form homework-create-form">
        {sessionId ? (
          <div className="homework-create-context" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>
              <strong>{className ?? "Lớp đang chọn"}</strong>
              <small>
                Buổi {sessionOrdinal ?? ""} · Bài sẽ được giao ngay và gắn cố định với buổi này
              </small>
            </span>
          </div>
        ) : null}

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

        <div className="homework-audience-box">
          <div className="homework-audience-head">
            <span>
              <strong>Người nhận</strong>
              <small>
                Toàn lớp sẽ chụp danh sách học sinh active ngay khi giao; chọn riêng sẽ giao cho
                đúng danh sách đã chọn.
              </small>
            </span>
            {rosterQuery.isFetching ? (
              <span className="homework-roster-loading">
                <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                Đang tải danh sách học sinh
              </span>
            ) : null}
          </div>
          <div
            className="homework-audience-switch"
            role="group"
            aria-label="Chọn người nhận bài tập"
          >
            <Button
              type="button"
              variant={audienceType === "CLASS" ? "primary" : "secondary"}
              onClick={() => setAudienceType("CLASS")}
            >
              <UsersRound size={16} aria-hidden="true" />
              Toàn lớp
            </Button>
            <Button
              type="button"
              variant={audienceType === "SELECTED" ? "primary" : "secondary"}
              disabled={rosterQuery.isFetching || audienceStudents.length === 0}
              onClick={() => setAudienceType("SELECTED")}
            >
              Chọn riêng
            </Button>
          </div>
          {audienceType === "SELECTED" ? (
            <div className="homework-student-picklist">
              {audienceStudents.map((student) => (
                <label className="homework-student-option" key={student.studentId}>
                  <input
                    type="checkbox"
                    checked={validSelectedStudentIds.includes(student.studentId)}
                    onChange={() => toggleStudent(student.studentId)}
                  />
                  <span>
                    <strong>{student.name}</strong>
                    <small>{student.code}</small>
                  </span>
                </label>
              ))}
              {selectedAudienceInvalid ? (
                <p className="field-error" role="alert">
                  Chọn ít nhất một học sinh.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <FileTokenPicker
          tenantSlug={tenantSlug}
          purpose="HOMEWORK_ATTACHMENT"
          files={files}
          onChange={setFiles}
        />
        {mutation.isError ? (
          <p className="field-error" role="alert">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Không thể tạo bài tập về nhà."}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};
