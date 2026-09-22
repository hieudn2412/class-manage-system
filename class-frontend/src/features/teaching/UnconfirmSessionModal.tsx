import { useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import type { SessionOperationsDetail } from "../../shared/types/domain";
import { Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";

export interface UnconfirmTargetSession {
  id: string;
  className: string;
  classCode: string;
  ordinal: number;
  version: number;
}

export interface UnconfirmSessionModalProps {
  open: boolean;
  session: UnconfirmTargetSession;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: (detail: SessionOperationsDetail) => void | Promise<void>;
}

export const UnconfirmSessionModal = ({
  open,
  session,
  tenantSlug,
  onClose,
  onSuccess,
}: UnconfirmSessionModalProps) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      teachingRepository.unconfirmSession(tenantSlug, session.id, {
        reason: reason.trim() || undefined,
        version: session.version,
      }),
    onSuccess,
    onError: (cause) =>
      setError(
        cause instanceof Error ? cause.message : "Không thể hủy xác nhận buổi học. Vui lòng thử lại.",
      ),
  });

  const handleConfirm = () => {
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      title="Hủy xác nhận buổi học"
      onClose={onClose}
      confirmLabel="Xác nhận hủy hoàn tất"
      confirmVariant="danger"
      onConfirm={handleConfirm}
      confirmLoading={mutation.isPending}
    >
      <div className="modal-form-stack">
        <div className="schedule-notice" style={{ borderLeftColor: "var(--color-warning-500, #f59e0b)" }}>
          <AlertTriangle size={20} aria-hidden="true" style={{ color: "var(--color-warning-600, #d97706)", flexShrink: 0 }} />
          <span>
            <strong>
              Lớp {session.className} ({session.classCode}) · Buổi {session.ordinal}
            </strong>
            <small style={{ display: "block", marginTop: "4px" }}>
              Buổi học sẽ được chuyển về trạng thái <strong>Chờ xác nhận</strong> (chưa hoàn tất). Tiền lương tạm tính cho giáo viên của buổi này sẽ bị <strong>hủy bỏ</strong>.
            </small>
            <small style={{ display: "block", marginTop: "4px" }}>
              Dữ liệu điểm danh, nội dung bài học và điểm kiểm tra (nếu có) vẫn được giữ nguyên.
            </small>
          </span>
        </div>

        <Textarea
          label="Lý do hủy xác nhận (tùy chọn)"
          rows={3}
          placeholder="Ví dụ: Cần cập nhật lại danh sách điểm danh, xác nhận nhầm..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};
