import { AlertCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { formatDateTime } from "../../../shared/lib/format";
import type { SchedulePreview } from "../../../shared/types/domain";
import { Button } from "../../../shared/ui/Button";

interface ScheduleConflictPanelProps {
  preview: SchedulePreview;
  onEditPatterns: () => void;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
}

export const ScheduleConflictPanel = ({
  preview,
  onEditPatterns,
  acknowledged,
  onAcknowledgedChange,
}: ScheduleConflictPanelProps) => {
  const blockers = preview.conflicts.filter((conflict) => conflict.severity === "BLOCKING");
  const warnings = preview.conflicts.filter((conflict) => conflict.severity === "WARNING");

  return (
    <div className="conflict-stack">
      {blockers.length > 0 ? (
        <section className="conflict-panel conflict-blocking" aria-labelledby="blocker-title">
          <div className="conflict-panel-head">
            <AlertCircle size={22} aria-hidden="true" />
            <div>
              <h3 id="blocker-title">{blockers.length} xung đột giáo viên/phòng phải sửa</h3>
              <p>Không thể công bố hoặc bỏ qua các xung đột này.</p>
            </div>
          </div>
          <ul>
            {blockers.map((conflict) => {
              const session = preview.sessions.find(
                (item) => item.key === conflict.proposedSessionKey,
              );
              return (
                <li key={conflict.id}>
                  <strong>
                    {conflict.code === "TEACHER_OVERLAP" ? "Trùng giáo viên" : "Trùng phòng"}
                  </strong>
                  <span>
                    {session ? formatDateTime(session.startAt) : "Buổi dự kiến"} trùng với{" "}
                    {conflict.conflictingSession.classCode} ·{" "}
                    {conflict.conflictingSession.className} (
                    {formatDateTime(conflict.conflictingSession.startAt)})
                  </span>
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="secondary" onClick={onEditPatterns}>
            <ArrowLeft size={17} aria-hidden="true" />
            Quay lại sửa ca
          </Button>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="conflict-panel conflict-warning" aria-labelledby="warning-title">
          <div className="conflict-panel-head">
            <AlertTriangle size={22} aria-hidden="true" />
            <div>
              <h3 id="warning-title">{warnings.length} cảnh báo học sinh trùng lịch</h3>
              <p>Cảnh báo không chặn lịch nhưng cần quản lý kiểm tra và xác nhận.</p>
            </div>
          </div>
          <ul>
            {warnings.map((conflict) => {
              const session = preview.sessions.find(
                (item) => item.key === conflict.proposedSessionKey,
              );
              return (
                <li key={conflict.id}>
                  <strong>{conflict.studentNames.join(", ")}</strong>
                  <span>
                    {session ? formatDateTime(session.startAt) : "Buổi dự kiến"} trùng với{" "}
                    {conflict.conflictingSession.classCode} ·{" "}
                    {conflict.conflictingSession.className}
                  </span>
                </li>
              );
            })}
          </ul>
          <label className="warning-acknowledgement">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => onAcknowledgedChange(event.target.checked)}
            />
            <span>
              <strong>Tôi đã kiểm tra và vẫn muốn công bố lịch này</strong>
              <small>Xác nhận áp dụng cho toàn bộ cảnh báo của bản xem trước hiện tại.</small>
            </span>
          </label>
        </section>
      ) : null}
    </div>
  );
};
