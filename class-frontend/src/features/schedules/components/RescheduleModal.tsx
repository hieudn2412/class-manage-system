import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { useTenant } from "../../../app/providers/TenantProvider";
import { scheduleRepository } from "../../../services/repositories/scheduleRepository";
import { timeFromIso } from "../../../shared/lib/calendar";
import { formatDateTime } from "../../../shared/lib/format";
import { ApiError } from "../../../shared/types/api";
import type { ScheduleConflict, SchedulePreview } from "../../../shared/types/domain";
import { Modal } from "../../../shared/ui/Modal";
import { useToast } from "../../../shared/ui/Toast";

export interface RescheduleTarget {
  id: string;
  className: string;
  classCode: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  version: number;
}

interface RescheduleModalProps {
  session: RescheduleTarget;
  onClose: () => void;
  onSaved: () => void;
}

const conflictText = (conflict: ScheduleConflict) => {
  const names = conflict.studentNames.length > 0 ? ` · ${conflict.studentNames.join(", ")}` : "";
  return `${conflict.conflictingSession.className} ${timeFromIso(
    conflict.conflictingSession.startAt,
  )}–${timeFromIso(conflict.conflictingSession.endAt)}${names}`;
};

export const RescheduleModal = ({ session, onClose, onSaved }: RescheduleModalProps) => {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");

  const blockers = preview?.conflicts.filter((item) => item.severity === "BLOCKING") ?? [];
  const warnings = preview?.conflicts.filter((item) => item.severity === "WARNING") ?? [];
  const warningIds = warnings.map((item) => item.id);

  const canConfirmPreview =
    Boolean(preview) && blockers.length === 0 && (warnings.length === 0 || acknowledged);

  const invalidateRelated = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["management-schedule", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-schedule", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["session-operations", tenant.id, session.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-class-sessions", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["management-dashboard", tenant.id] }),
    ]);
  };

  const previewMutation = useMutation({
    mutationFn: () =>
      scheduleRepository.previewReschedule(tenant.slug, session.id, {
        version: session.version,
      }),
    onSuccess: (result) => {
      setPreview(result);
      setAcknowledged(false);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Không thể kiểm tra lịch mới."),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Missing preview");
      return scheduleRepository.applyReschedule(tenant.slug, session.id, {
        version: session.version,
        previewId: preview.previewId,
        acknowledgedWarningIds: warningIds,
      });
    },
    onSuccess: async () => {
      await invalidateRelated();
      showToast("Đã dời lịch thành công.");
      onSaved();
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : "Không thể lưu thao tác.");
      if (caught instanceof ApiError && caught.code === "SCHEDULE_PREVIEW_STALE") {
        setPreview(null);
      }
    },
  });

  const handleConfirm = () => {
    setError("");
    if (!preview) {
      previewMutation.mutate();
      return;
    }
    if (!canConfirmPreview) {
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Modal
      open
      title="Dời lịch"
      onClose={onClose}
      confirmLabel={preview ? "Xác nhận dời lịch" : "Kiểm tra lịch mới"}
      onConfirm={handleConfirm}
      confirmDisabled={(Boolean(preview) && blockers.length > 0) || (warnings.length > 0 && !acknowledged)}
      confirmLoading={previewMutation.isPending || saveMutation.isPending}
    >
      <div className="modal-form-stack">
        <div className="fl07-session-context">
          <span>
            <CalendarRange size={18} aria-hidden="true" />
          </span>
          <strong>
            {session.classCode} · Buổi {session.ordinal}
          </strong>
          <small>{session.className}</small>
        </div>

        <p className="reschedule-description">
          Buổi {session.ordinal} và các buổi phía sau sẽ được dời sang slot kế tiếp theo lịch tuần.
        </p>

        {preview ? (
          <div className="reschedule-preview-table-wrapper">
            <small>
              <strong>{preview.sessions.length}</strong> buổi sẽ được dời lịch:
            </small>
            <table className="data-table reschedule-preview-table">
              <thead>
                <tr>
                  <th>Buổi</th>
                  <th>Lịch mới</th>
                </tr>
              </thead>
              <tbody>
                {preview.sessions.map((s) => (
                  <tr key={s.key}>
                    <td>{s.ordinal}</td>
                    <td>{formatDateTime(s.startAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? (
          <div className="form-alert" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {error}
          </div>
        ) : null}
        
        <PreviewResult
          preview={preview}
          blockers={blockers}
          warnings={warnings}
          acknowledged={acknowledged}
          onAcknowledge={setAcknowledged}
        />
      </div>
    </Modal>
  );
};

const PreviewResult = ({
  preview,
  blockers,
  warnings,
  acknowledged,
  onAcknowledge,
}: {
  preview: SchedulePreview | null;
  blockers: ScheduleConflict[];
  warnings: ScheduleConflict[];
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) => {
  if (!preview) return null;
  if (blockers.length > 0) {
    return (
      <div className="override-result-error">
        <AlertCircle size={19} aria-hidden="true" />
        <span>
          <strong>Không thể lưu</strong>
          <small>{blockers.map(conflictText).join("; ")}</small>
        </span>
      </div>
    );
  }
  if (warnings.length > 0) {
    return (
      <>
        <div className="override-result-warning">
          <AlertTriangle size={19} aria-hidden="true" />
          <span>
            <strong>{warnings.length} cảnh báo học sinh trùng lịch</strong>
            <small>{warnings.map(conflictText).join("; ")}</small>
          </span>
        </div>
        <label className="warning-acknowledgement">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => onAcknowledge(event.target.checked)}
          />
          <span>Tôi đã kiểm tra và xác nhận cảnh báo này.</span>
        </label>
      </>
    );
  }
  return (
    <div className="override-result-success">
      <CheckCircle2 size={19} aria-hidden="true" />
      <span>Không có xung đột. Có thể xác nhận thao tác.</span>
    </div>
  );
};
