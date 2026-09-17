import { CalendarCheck, Pencil, RefreshCw, Send, Sparkles } from "lucide-react";
import { formatDate, formatDateTime } from "../../../shared/lib/format";
import type { SchedulePreview, SchedulePreviewSession } from "../../../shared/types/domain";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { StatePanel } from "../../../shared/ui/StatePanel";
import { ScheduleConflictPanel } from "./ScheduleConflictPanel";

interface SchedulePreviewStepProps {
  preview: SchedulePreview | null;
  previewLoading: boolean;
  publishing: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  onPreview: () => void;
  onPublish: () => void;
  onEditPatterns: () => void;
  onEditSession: (session: SchedulePreviewSession) => void;
}

export const SchedulePreviewStep = ({
  preview,
  previewLoading,
  publishing,
  acknowledged,
  onAcknowledgedChange,
  onPreview,
  onPublish,
  onEditPatterns,
  onEditSession,
}: SchedulePreviewStepProps) => {
  const blockers = preview?.conflicts.filter((item) => item.severity === "BLOCKING") ?? [];
  const warnings = preview?.conflicts.filter((item) => item.severity === "WARNING") ?? [];
  const publishDisabled =
    !preview || blockers.length > 0 || (warnings.length > 0 && !acknowledged) || publishing;

  return (
    <section aria-labelledby="schedule-preview-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bước 4 / 4</p>
          <h2 id="schedule-preview-title">Xem trước & công bố</h2>
          <p>Bản xem trước phải mới nhất trước khi lịch được ghi vào thời khóa biểu.</p>
        </div>
        <Button type="button" onClick={onPreview} loading={previewLoading}>
          {preview ? (
            <RefreshCw size={18} aria-hidden="true" />
          ) : (
            <Sparkles size={18} aria-hidden="true" />
          )}
          {preview ? "Xem trước lại" : "Tạo bản xem trước"}
        </Button>
      </div>

      {!preview ? (
        <StatePanel
          kind="empty"
          title="Chưa có bản xem trước"
          description="Hệ thống sẽ sinh đủ số buổi, bỏ qua ngày nghỉ và kiểm tra mọi xung đột."
          actionLabel="Xem trước lịch"
          onAction={onPreview}
        />
      ) : (
        <>
          <div className="preview-summary">
            <article>
              <CalendarCheck size={20} aria-hidden="true" />
              <span>
                <small>Số buổi đã sinh</small>
                <strong>{preview.sessions.length}</strong>
              </span>
            </article>
            <article>
              <span>
                <small>Bỏ qua ngày nghỉ</small>
                <strong>{preview.skippedHolidays.length}</strong>
              </span>
            </article>
            <article>
              <span>
                <small>Kết thúc dự kiến</small>
                <strong>{formatDate(preview.expectedEndDate)}</strong>
              </span>
            </article>
            <article>
              <span>
                <small>Kiểm tra lịch</small>
                <strong>
                  {blockers.length === 0 && warnings.length === 0
                    ? "Không xung đột"
                    : `${blockers.length} chặn · ${warnings.length} cảnh báo`}
                </strong>
              </span>
            </article>
          </div>

          {preview.skippedHolidays.length > 0 ? (
            <div className="holiday-strip" role="status">
              <strong>Đã bỏ qua:</strong>
              {preview.skippedHolidays.map((item) => (
                <span key={`${item.date}-${item.patternId}`}>
                  {formatDate(item.date)} · {item.holidayName}
                </span>
              ))}
            </div>
          ) : null}

          <ScheduleConflictPanel
            preview={preview}
            onEditPatterns={onEditPatterns}
            acknowledged={acknowledged}
            onAcknowledgedChange={onAcknowledgedChange}
          />

          <div className="table-shell preview-table">
            <table className="data-table">
              <caption className="sr-only">Danh sách buổi học dự kiến</caption>
              <thead>
                <tr>
                  <th scope="col">Buổi</th>
                  <th scope="col">Ngày và giờ</th>
                  <th scope="col">Giáo viên</th>
                  <th scope="col">Hình thức</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.sessions.map((session) => {
                  const conflicts = preview.conflicts.filter(
                    (item) => item.proposedSessionKey === session.key,
                  );
                  const hasBlocker = conflicts.some((item) => item.severity === "BLOCKING");
                  const hasWarning = conflicts.some((item) => item.severity === "WARNING");
                  return (
                    <tr key={session.key}>
                      <td data-label="Buổi">
                        <strong>#{session.ordinal}</strong>
                      </td>
                      <td data-label="Ngày và giờ">{formatDateTime(session.startAt)}</td>
                      <td data-label="Giáo viên">{session.teacherName}</td>
                      <td data-label="Hình thức">
                        {session.mode === "IN_PERSON" ? session.roomName : "Trực tuyến"}
                      </td>
                      <td data-label="Trạng thái">
                        <Badge tone={hasBlocker ? "danger" : hasWarning ? "warning" : "success"}>
                          {hasBlocker ? "Bị chặn" : hasWarning ? "Cần xác nhận" : "Hợp lệ"}
                        </Badge>
                      </td>
                      <td data-label="Thao tác">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onEditSession(session)}
                        >
                          <Pencil size={15} aria-hidden="true" />
                          Điều chỉnh
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="publish-bar">
            <div>
              <strong>Sẵn sàng công bố?</strong>
              <p>
                Lịch sẽ xuất hiện ngay với giáo viên; lượt ghi danh và khoản học phí được tạo cùng giao
                dịch.
              </p>
            </div>
            <Button
              type="button"
              onClick={onPublish}
              disabled={publishDisabled}
              loading={publishing}
            >
              <Send size={18} aria-hidden="true" />
              Công bố lớp
            </Button>
          </div>
        </>
      )}
    </section>
  );
};
