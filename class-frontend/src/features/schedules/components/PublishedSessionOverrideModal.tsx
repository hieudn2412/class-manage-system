import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTenant } from "../../../app/providers/TenantProvider";
import { scheduleRepository } from "../../../services/repositories/scheduleRepository";
import { ApiError } from "../../../shared/types/api";
import type {
  CalendarSession,
  ClassSchedulingOptions,
  DeliveryMode,
  SchedulePreview,
} from "../../../shared/types/domain";
import { Select } from "../../../shared/ui/FormField";
import { Modal } from "../../../shared/ui/Modal";
import { useToast } from "../../../shared/ui/Toast";

interface PublishedSessionOverrideModalProps {
  session: CalendarSession;
  options: ClassSchedulingOptions;
  onClose: () => void;
  onSaved: () => void;
}

const makeKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}`;

export const PublishedSessionOverrideModal = ({
  session,
  options,
  onClose,
  onSaved,
}: PublishedSessionOverrideModalProps) => {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [mode, setMode] = useState<DeliveryMode>(session.mode);
  const [roomId, setRoomId] = useState(session.roomId ?? "");
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");

  const clearPreview = () => {
    setPreview(null);
    setAcknowledged(false);
    setError("");
  };

  const previewMutation = useMutation({
    mutationFn: () => {
      return scheduleRepository.previewSessionSchedule(tenant.slug, session.id, {
        mode,
        roomId: mode === "IN_PERSON" ? roomId : null,
        version: session.version,
      });
    },
    onSuccess: (result) => {
      setPreview(result);
      setAcknowledged(false);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Không thể kiểm tra thay đổi."),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Thiếu bản xem trước.");
      return scheduleRepository.updateSessionSchedule(
        tenant.slug,
        session.id,
        {
          mode,
          roomId: mode === "IN_PERSON" ? roomId : null,
          version: session.version,
          previewId: preview.previewId,
          acknowledgedWarningIds: preview.conflicts
            .filter((conflict) => conflict.severity === "WARNING")
            .map((conflict) => conflict.id),
        },
        makeKey(),
      );
    },
    onSuccess: () => {
      showToast("Đã cập nhật buổi học và gửi thông báo cho người liên quan.");
      void queryClient.invalidateQueries({ queryKey: ["management-schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule"] });
      onSaved();
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : "Không thể lưu thay đổi.");
      if (caught instanceof ApiError && caught.code === "PREVIEW_STALE") setPreview(null);
    },
  });

  const blockers = preview?.conflicts.filter((item) => item.severity === "BLOCKING") ?? [];
  const warnings = preview?.conflicts.filter((item) => item.severity === "WARNING") ?? [];
  const saveDisabled =
    Boolean(preview) && (blockers.length > 0 || (warnings.length > 0 && !acknowledged));

  const handleConfirm = () => {
    if (!preview) previewMutation.mutate();
    else updateMutation.mutate();
  };

  return (
    <Modal
      open={Boolean(session)}
      title="Điều chỉnh một buổi đã công bố"
      onClose={onClose}
      confirmLabel={preview ? "Lưu thay đổi" : "Kiểm tra thay đổi"}
      onConfirm={handleConfirm}
      confirmDisabled={saveDisabled}
      confirmLoading={previewMutation.isPending || updateMutation.isPending}
    >
      <p className="modal-description">
        Ngày, giờ và giáo viên giữ nguyên. Thay đổi thành công sẽ được lưu vào lịch sử và gửi thông báo.
      </p>
      <div className="modal-form">
        <Select
          label="Hình thức"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as DeliveryMode);
            clearPreview();
          }}
        >
          <option value="IN_PERSON">Tại lớp</option>
          <option value="ONLINE">Trực tuyến</option>
        </Select>
        {mode === "IN_PERSON" ? (
          <Select
            label="Phòng"
            value={roomId}
            onChange={(event) => {
              setRoomId(event.target.value);
              clearPreview();
            }}
          >
            <option value="">Chọn phòng</option>
            {options.rooms.map((room) => (
              <option value={room.id} disabled={room.status === "INACTIVE"} key={room.id}>
                {room.code} · {room.capacity} chỗ
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      {error ? (
        <div className="form-alert mt-4" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </div>
      ) : null}
      {preview ? (
        <div className="override-check-result" aria-live="polite">
          {blockers.length > 0 ? (
            <div className="override-result-error">
              <AlertCircle size={19} aria-hidden="true" />
              <span>
                <strong>Không thể lưu</strong>
                <small>{blockers.length} xung đột giáo viên/phòng cần được xử lý.</small>
              </span>
            </div>
          ) : warnings.length > 0 ? (
            <>
              <div className="override-result-warning">
                <AlertTriangle size={19} aria-hidden="true" />
                <span>
                  <strong>{warnings.length} cảnh báo học sinh trùng lịch</strong>
                  <small>{warnings.flatMap((item) => item.studentNames).join(", ")}</small>
                </span>
              </div>
              <label className="warning-acknowledgement">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>Tôi đã kiểm tra và xác nhận thay đổi này.</span>
              </label>
            </>
          ) : (
            <div className="override-result-success">
              <CheckCircle2 size={19} aria-hidden="true" />
              <span>Không có xung đột. Có thể lưu thay đổi.</span>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
