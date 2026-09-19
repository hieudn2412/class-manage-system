import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Mail, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useTenant } from "../../app/providers/TenantProvider";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { formatCurrency, formatDateTime, formatMonth } from "../../shared/lib/format";
import { ApiError } from "../../shared/types/api";
import type {
  PayrollTeacherRow,
  SendSalaryNotificationsResult,
} from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Modal } from "../../shared/ui/Modal";
import { useToast } from "../../shared/ui/Toast";

interface Props {
  open: boolean;
  month: string;
  recipients: PayrollTeacherRow[];
  onClose: () => void;
  onSent: (result: SendSalaryNotificationsResult) => void;
}

interface DuplicateDetail {
  teacherId: string;
  teacherName: string;
  status: "QUEUED" | "SENT";
  sentAt: string;
}

const notificationLabel = {
  QUEUED: "Đang chờ gửi",
  SENT: "Đã gửi",
  FAILED: "Gửi thất bại",
} as const;

const readDuplicates = (error: ApiError): DuplicateDetail[] => {
  const value = error.details?.duplicates;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DuplicateDetail => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<DuplicateDetail>;
    return typeof candidate.teacherId === "string" && typeof candidate.teacherName === "string"
      && (candidate.status === "QUEUED" || candidate.status === "SENT")
      && typeof candidate.sentAt === "string";
  });
};

const hours = (minutes: number) => new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
}).format(minutes / 60);

export const SalaryNotificationModal = ({
  open,
  month,
  recipients,
  onClose,
  onSent,
}: Props) => {
  const tenant = useTenant();
  const { showToast } = useToast();
  const [paymentDate, setPaymentDate] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateDetail[]>([]);
  const knownDuplicates = useMemo(() => recipients
    .filter((recipient) => recipient.lastNotificationStatus === "QUEUED"
      || recipient.lastNotificationStatus === "SENT")
    .map((recipient) => ({
      teacherId: recipient.teacherId,
      teacherName: recipient.teacherName,
      status: recipient.lastNotificationStatus as "QUEUED" | "SENT",
      sentAt: recipient.lastNotificationAt ?? "",
    })), [recipients]);
  const resendWarnings = duplicates.length ? duplicates : knownDuplicates;
  const preview = recipients[0];

  const mutation = useMutation({
    mutationFn: (confirmResend: boolean) => salaryRepository.sendNotifications(tenant.slug, {
      month,
      teacherIds: recipients.map((recipient) => recipient.teacherId),
      paymentDate,
      contactNote: contactNote.trim() || undefined,
      confirmResend,
    }),
    onSuccess: (result) => {
      const skippedMessage = result.skipped.length
        ? ` ${result.skipped.length} giáo viên chưa có email nên được bỏ qua.`
        : "";
      showToast(`Đã đưa ${result.queuedCount} email vào hàng đợi.${skippedMessage}`);
      onSent(result);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "SALARY_NOTIFICATION_ALREADY_SENT") {
        setDuplicates(readDuplicates(error));
        return;
      }
      showToast(error instanceof Error
        ? error.message
        : "Chưa thể gửi thông báo lương. Vui lòng thử lại.");
    },
  });

  const handleConfirm = () => {
    if (!paymentDate) {
      setValidationMessage("Vui lòng chọn ngày dự kiến thanh toán.");
      return;
    }
    setValidationMessage("");
    mutation.mutate(resendWarnings.length > 0);
  };

  return (
    <Modal
      open={open}
      title={recipients.length > 1
        ? `Gửi thông báo cho ${recipients.length} giáo viên`
        : "Gửi thông báo lương"}
      onClose={onClose}
      className="salary-notification-modal"
      confirmLabel={resendWarnings.length ? "Xác nhận gửi lại" : "Gửi thông báo"}
      confirmDisabled={!recipients.length}
      confirmLoading={mutation.isPending}
      onConfirm={handleConfirm}
    >
      <div className="salary-notification-form">
        <div className="salary-recipient-summary">
          <UsersRound size={20} aria-hidden="true" />
          <div>
            <strong>{recipients.length} người nhận</strong>
            <span>{recipients.map((recipient) => recipient.teacherName).join(", ")}</span>
          </div>
        </div>

        {resendWarnings.length ? (
          <div className="salary-resend-warning" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Thông báo của kỳ này đã được tạo trước đó</strong>
              {resendWarnings.map((item) => (
                <span key={item.teacherId}>
                  {item.teacherName}: {item.status === "SENT" ? "đã gửi" : "đang chờ gửi"}
                  {item.sentAt ? ` lúc ${formatDateTime(item.sentAt)}` : ""}
                </span>
              ))}
              <small>Chỉ tiếp tục nếu bạn muốn giáo viên nhận thêm một email mới.</small>
            </div>
          </div>
        ) : null}

        <div className="salary-notification-fields">
          <label className="field">
            <span>Ngày dự kiến thanh toán</span>
            <span className="input-with-icon">
              <CalendarDays size={17} aria-hidden="true" />
              <input
                type="date"
                value={paymentDate}
                aria-invalid={Boolean(validationMessage)}
                aria-describedby={validationMessage ? "salary-payment-date-error" : undefined}
                onChange={(event) => {
                  setPaymentDate(event.target.value);
                  setValidationMessage("");
                }}
              />
            </span>
            {validationMessage ? (
              <small id="salary-payment-date-error" className="field-error">
                {validationMessage}
              </small>
            ) : null}
          </label>
          <label className="field">
            <span>Ghi chú liên hệ <small>(không bắt buộc)</small></span>
            <textarea
              rows={3}
              maxLength={500}
              value={contactNote}
              placeholder="Ví dụ: Nếu cần hỗ trợ, vui lòng liên hệ phòng kế toán trước ngày 10/04."
              onChange={(event) => setContactNote(event.target.value)}
            />
            <small>{contactNote.length}/500 ký tự</small>
          </label>
        </div>

        {preview ? (
          <section className="salary-email-preview" aria-label="Xem trước nội dung email">
            <header>
              <span><Mail size={17} aria-hidden="true" /> Xem trước email</span>
              <Badge tone="info">{formatMonth(month)}</Badge>
            </header>
            <div className="salary-email-preview-body">
              <small>EDU OPS · {tenant.name}</small>
              <h3>Thông báo bảng lương</h3>
              <p>Kính gửi Thầy/Cô <strong>{preview.teacherName}</strong>,</p>
              <p>
                Trung tâm gửi thông tin bảng lương {formatMonth(month).toLowerCase()}.
                {paymentDate ? <> Ngày dự kiến thanh toán: <strong>{new Date(`${paymentDate}T00:00:00`).toLocaleDateString("vi-VN")}</strong>.</> : null}
              </p>
              <div className="salary-email-preview-table-wrap">
                <table className="salary-email-preview-table">
                  <caption className="sr-only">Số liệu bảng lương trong email</caption>
                  <thead>
                    <tr>
                      <th scope="col">Số buổi</th>
                      <th scope="col">Tổng giờ dạy</th>
                      <th scope="col">Tiền dạy</th>
                      <th scope="col">Cộng hoặc trừ</th>
                      <th scope="col" className="preview-total">Tổng lương</th>
                      <th scope="col">Đã thanh toán</th>
                      <th scope="col" className="preview-total">Còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{preview.sessionCount}</td>
                      <td>{hours(preview.totalMinutes)} giờ</td>
                      <td>{formatCurrency(preview.accrued)}</td>
                      <td>{formatCurrency(preview.adjustments)}</td>
                      <td className="preview-total">{formatCurrency(preview.due)}</td>
                      <td>{formatCurrency(preview.paid)}</td>
                      <td className="preview-total">{formatCurrency(preview.outstanding)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {contactNote.trim() ? <p className="salary-preview-note">{contactNote.trim()}</p> : null}
              <small>Đây là email tự động. Giáo viên sẽ có nút mở bảng lương cá nhân.</small>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
};

export { notificationLabel };
