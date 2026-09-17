import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Archive, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { useTenant } from "../../../app/providers/TenantProvider";
import { lifecycleRepository } from "../../../services/repositories/lifecycleRepository";
import { ApiError } from "../../../shared/types/api";
import type { ClassDetail } from "../../../shared/types/domain";
import { Button } from "../../../shared/ui/Button";
import { Modal } from "../../../shared/ui/Modal";
import { useToast } from "../../../shared/ui/Toast";

type TargetStatus = "Closed" | "AwaitingClose" | "Cancelled";

export const LifecycleActions = ({ item }: { item: ClassDetail }) => {
  const tenant = useTenant();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [target, setTarget] = useState<TargetStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("Missing target status");
      return lifecycleRepository.changeStatus(
        tenant.slug,
        item.id,
        target,
        reason,
        item.version,
        target === "Closed" ? item.closeReadiness.warnings.map((warning) => warning.id) : [],
      );
    },
    onSuccess: async (result) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["class-detail", tenant.id, item.id] }),
        client.invalidateQueries({ queryKey: ["classes"] }),
        client.invalidateQueries({ queryKey: ["class-enrollments", tenant.id, item.id] }),
        client.invalidateQueries({ queryKey: ["management-schedule"] }),
        client.invalidateQueries({ queryKey: ["teacher-schedule"] }),
        client.invalidateQueries({ queryKey: ["teacher-classes"] }),
        client.invalidateQueries({ queryKey: ["student-classes"] }),
      ]);
      setTarget(null);
      setReason("");
      setError("");
      const message =
        result.status === "Closed"
          ? "Đã đóng lớp và khóa quyền nội dung của học sinh."
          : result.status === "AwaitingClose"
            ? "Đã mở lại lớp và khôi phục quyền cho học sinh đang tham gia."
            : `Đã hủy lớp và hủy ${result.cancelledFutureSessions} buổi tương lai.`;
      showToast(message);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Không thể đổi trạng thái lớp."),
  });

  const close = () => {
    if (mutation.isPending) return;
    setTarget(null);
    setReason("");
    setError("");
  };
  const requiresReason = target === "AwaitingClose" || target === "Cancelled";

  return (
    <>
      {item.allowedTransitions.includes("Closed") ? (
        <Button variant="secondary" onClick={() => setTarget("Closed")}>
          <Archive size={17} aria-hidden="true" />
          Đóng lớp
        </Button>
      ) : null}
      {item.allowedTransitions.includes("AwaitingClose") ? (
        <Button variant="secondary" onClick={() => setTarget("AwaitingClose")}>
          <RotateCcw size={17} aria-hidden="true" />
          Mở lại
        </Button>
      ) : null}
      {item.allowedTransitions.includes("Cancelled") ? (
        <Button variant="danger" onClick={() => setTarget("Cancelled")}>
          <XCircle size={17} aria-hidden="true" />
          Hủy lớp
        </Button>
      ) : null}

      <Modal
        open={Boolean(target)}
        title={
          target === "Closed" ? "Đóng lớp" : target === "AwaitingClose" ? "Mở lại lớp" : "Hủy lớp"
        }
        onClose={close}
        confirmLabel={
          target === "Closed"
            ? "Xác nhận đóng"
            : target === "AwaitingClose"
              ? "Xác nhận mở lại"
              : "Xác nhận hủy"
        }
        onConfirm={() => mutation.mutate()}
        confirmDisabled={requiresReason && !reason.trim()}
        confirmLoading={mutation.isPending}
      >
        <div className="modal-form">
          {target === "Closed" ? (
            <>
              <p className="modal-description">
                Khi đóng lớp, học sinh sẽ không còn xem được nội dung. Lịch sử ghi danh và tài chính vẫn được giữ nguyên.
              </p>
              {item.closeReadiness.warnings.length ? (
                <div className="warning-stack" role="alert">
                  {item.closeReadiness.warnings.map((warning) => (
                    <div className="form-alert" key={warning.id}>
                      <AlertTriangle size={18} aria-hidden="true" />
                      <span>{warning.message}</span>
                    </div>
                  ))}
                  <small>Tiếp tục đồng nghĩa bạn xác nhận các hồ sơ còn thiếu.</small>
                </div>
              ) : (
                <p className="form-success">Điểm danh và bản ghi buổi học đã đầy đủ.</p>
              )}
            </>
          ) : null}
          {target === "AwaitingClose" ? (
            <p className="modal-description">
              Enrollment còn hoạt động sẽ được khôi phục quyền. Hệ thống không tạo thêm buổi học.
            </p>
          ) : null}
          {target === "Cancelled" ? (
            <p className="modal-description">
              {item.futureSessionCount} buổi chưa bắt đầu sẽ bị hủy. Buổi đang diễn ra, đã dạy,
              lịch sử ghi danh và tài chính vẫn được giữ nguyên.
            </p>
          ) : null}
          {requiresReason ? (
            <label className="field">
              <span className="field-label">Lý do *</span>
              <textarea
                className="control"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}
          {error ? (
            <p className="form-alert" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
};
