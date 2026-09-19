import { CalendarDays, History, Landmark, TimerReset } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../../shared/lib/format";
import type {
  SalaryAdjustment,
  SalaryPayment,
  TeacherPayrollDetail,
} from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { StatePanel } from "../../shared/ui/StatePanel";

interface Props {
  detail: TeacherPayrollDetail;
  basePath: string;
  editable?: boolean;
  variant?: "default" | "personal";
  onEditAdjustment?: (item: SalaryAdjustment) => void;
  onEditPayment?: (item: SalaryPayment) => void;
}

export const SalaryDetailSections = ({
  detail,
  basePath,
  editable = false,
  variant = "default",
  onEditAdjustment,
  onEditPayment,
}: Props) => (
  <div className={`salary-ledger-stack salary-ledger-${variant}`}>
    <section className="panel salary-ledger-section">
      <header>
        <div>
          <p className="eyebrow">
            {variant === "personal" ? "CHI TIẾT TRONG KỲ" : "LƯƠNG THEO BUỔI DẠY"}
          </p>
          <h2>{variant === "personal" ? "Thu nhập theo buổi dạy" : "Phát sinh theo buổi"}</h2>
        </div>
        <span>{detail.accruals.length} khoản</span>
      </header>
      {!detail.accruals.length ? (
        <StatePanel
          kind="empty"
          title="Chưa có buổi phát sinh lương"
          description="Khoản lương sẽ xuất hiện sau khi buổi học được hoàn tất."
        />
      ) : (
        <>
          <div className="salary-line-columns" aria-hidden="true">
            <span>Ngày dạy</span>
            <span>Lớp học</span>
            <span>Thời lượng và đơn giá</span>
            <span>Thành tiền</span>
            <span>Trạng thái</span>
          </div>
          <div className="salary-line-list">
            {detail.accruals.map((line) => (
              <article
                key={line.id}
                className={line.status === "REVERSED" ? "salary-line reversed" : "salary-line"}
                aria-label={`${line.className}, ${formatDate(line.sessionDate)}`}
              >
                <div className="salary-line-date">
                  <span className="salary-line-label">Ngày dạy</span>
                  <CalendarDays size={17} aria-hidden="true" />
                  <strong>{formatDate(line.sessionDate)}</strong>
                  <small>Buổi {line.ordinal}</small>
                </div>
                <div>
                  <span className="salary-line-label">Lớp học</span>
                  <Link to={`${basePath}/sessions/${line.sessionId}`}>
                    <strong>{line.className}</strong>
                  </Link>
                  <small>
                    {line.classCode}
                    {line.substitution ? " · Dạy thay" : ""}
                  </small>
                </div>
                <div>
                  <span className="salary-line-label">Thời lượng và đơn giá</span>
                  <span>
                    <TimerReset size={15} aria-hidden="true" /> {line.scheduledMinutes} phút
                  </span>
                  <small>{formatCurrency(line.hourlyRate)}/giờ</small>
                </div>
                <div className="salary-line-amount">
                  <span className="salary-line-label">Thành tiền</span>
                  <strong>{formatCurrency(line.amount)}</strong>
                  <small>Lần cập nhật {line.revision}</small>
                </div>
                <div className="salary-line-status">
                  <span className="salary-line-label">Trạng thái</span>
                  <Badge tone={line.status === "ACTIVE" ? "success" : "neutral"}>
                    {line.status === "ACTIVE" ? "Đã ghi nhận" : "Đã hủy ghi nhận"}
                  </Badge>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>

    <div className="salary-ledger-columns">
      <section className="panel salary-ledger-section compact">
        <header>
          <div>
            <p className="eyebrow">CÁC KHOẢN ĐIỀU CHỈNH</p>
            <h2>Cộng hoặc trừ</h2>
          </div>
          <History size={20} aria-hidden="true" />
        </header>
        {!detail.adjustments.length ? (
          <p className="salary-empty-note">Không có điều chỉnh trong kỳ.</p>
        ) : (
          detail.adjustments.map((item) => (
            <article className="salary-transaction" key={item.id}>
              <div>
                <strong className={item.amount < 0 ? "amount-negative" : "amount-positive"}>
                  {formatCurrency(item.amount)}
                </strong>
                <p>{item.reason}</p>
                <small>
                  Cập nhật {formatDate(item.updatedAt)} · lần {item.version}
                </small>
              </div>
              {editable ? (
                <Button variant="ghost" onClick={() => onEditAdjustment?.(item)}>
                  Sửa
                </Button>
              ) : null}
            </article>
          ))
        )}
      </section>

      <section className="panel salary-ledger-section compact">
        <header>
          <div>
            <p className="eyebrow">CÁC KHOẢN ĐÃ TRẢ</p>
            <h2>Lịch sử thanh toán</h2>
          </div>
          <Landmark size={20} aria-hidden="true" />
        </header>
        {!detail.payments.length ? (
          <p className="salary-empty-note">Chưa ghi thanh toán trong kỳ.</p>
        ) : (
          detail.payments.map((item) => (
            <article className="salary-transaction" key={item.id}>
              <div>
                <strong>{formatCurrency(item.amount)}</strong>
                <p>
                  {formatDate(item.paidAt)} · {item.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                </p>
                <small>
                  {item.reference ?? "Không có mã tham chiếu"} · lần {item.version}
                </small>
                {item.overpaymentReason ? <em>Trả vượt: {item.overpaymentReason}</em> : null}
              </div>
              {editable ? (
                <Button variant="ghost" onClick={() => onEditPayment?.(item)}>
                  Sửa
                </Button>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  </div>
);
