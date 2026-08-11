import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import type { StoredFile } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { homeworkStatusLabel, homeworkStatusTone, rate } from "./contentUtils";
import { FileTokenPicker } from "./FileTokenPicker";

export const ClassHomeworksPanel = ({
  tenantSlug,
  classId,
  canManage,
}: {
  tenantSlug: string;
  classId: string;
  canManage: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["class-homeworks", tenantSlug, classId],
    queryFn: () => learningContentRepository.classHomeworks(tenantSlug, classId, { page: 1, pageSize: 100 }),
  });
  const invalidate = async () =>
    client.invalidateQueries({ queryKey: ["class-homeworks", tenantSlug, classId] });
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return <StatePanel kind="error" title="Không tải được BTVN" description="Vui lòng thử lại sau." />;
  }
  return (
    <section className="content-panel">
      <header className="content-section-head">
        <div>
          <p className="eyebrow">FL-10 / BTVN</p>
          <h2>Bài tập về nhà</h2>
        </div>
        {canManage ? (
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} /> Giao bài
          </Button>
        ) : null}
      </header>
      {!query.data?.items.length ? (
        <StatePanel kind="empty" title="Chưa có BTVN" description="Giáo viên hoặc học vụ có thể tạo bài mới từ đây." />
      ) : (
        <div className="table-shell">
          <table className="data-table content-table">
            <thead>
              <tr>
                <th>Bài</th>
                <th>Trạng thái</th>
                <th>Nộp</th>
                <th>Chữa</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="table-primary">{item.title}</span>
                    <span className="table-secondary">
                      {item.sessionOrdinal ? `Buổi ${item.sessionOrdinal}` : "Cấp lớp"}
                    </span>
                  </td>
                  <td><Badge tone={homeworkStatusTone[item.status]}>{homeworkStatusLabel[item.status]}</Badge></td>
                  <td>{rate(item.submittedCount, item.recipientCount)}</td>
                  <td>{rate(item.reviewedCount, item.recipientCount)}</td>
                  <td>
                    <Link className="record-link" to={`/t/${tenantSlug}/app/homeworks/${item.id}`}>
                      Mở chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <HomeworkCreateModal
        tenantSlug={tenantSlug}
        classId={classId}
        open={open}
        onClose={() => setOpen(false)}
        onDone={invalidate}
      />
    </section>
  );
};

const HomeworkCreateModal = ({
  tenantSlug,
  classId,
  open,
  onClose,
  onDone,
}: {
  tenantSlug: string;
  classId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [link, setLink] = useState("");
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      learningContentRepository.createHomework(tenantSlug, classId, {
        title,
        description,
        deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        audienceType: "CLASS",
        studentIds: [],
        fileTokens: files.map((file) => file.token).filter((token): token is string => Boolean(token)),
        links: link.trim() ? [{ label: "Link học tập", url: link.trim() }] : [],
      }),
    onSuccess: async () => {
      await onDone();
      onClose();
      showToast("Đã tạo BTVN nháp.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể tạo BTVN."),
  });
  return (
    <Modal
      open={open}
      title="Tạo BTVN"
      onClose={onClose}
      confirmLabel="Tạo nháp"
      confirmDisabled={!title.trim()}
      confirmLoading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    >
      <div className="content-form">
        <Input label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Input label="Deadline" type="datetime-local" value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} />
        <Textarea label="Mô tả" value={description} onChange={(event) => setDescription(event.target.value)} />
        <Input label="Link http/https" value={link} onChange={(event) => setLink(event.target.value)} />
        <FileTokenPicker tenantSlug={tenantSlug} purpose="HOMEWORK_ATTACHMENT" files={files} onChange={setFiles} />
      </div>
    </Modal>
  );
};
