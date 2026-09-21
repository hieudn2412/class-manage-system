import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  History,
  Landmark,
  TimerReset,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate, formatMonth } from "../../shared/lib/format";
import type {
  SalaryAccrualItem,
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

const WEEKDAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

export const SalaryDetailSections = ({
  detail,
  basePath,
  editable = false,
  variant = "default",
  onEditAdjustment,
  onEditPayment,
}: Props) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(true);

  // Group accruals by sessionDate
  const accrualsByDate = useMemo(() => {
    const map = new Map<string, SalaryAccrualItem[]>();
    for (const accrual of detail.accruals) {
      const list = map.get(accrual.sessionDate) ?? [];
      list.push(accrual);
      map.set(accrual.sessionDate, list);
    }
    return map;
  }, [detail.accruals]);

  // Compute month calendar days
  const calendarData = useMemo(() => {
    const monthStr = detail.month || "2026-09";
    const [yearStr, mStr] = monthStr.split("-");
    const year = parseInt(yearStr || "2026", 10);
    const month = parseInt(mStr || "9", 10);
    const totalDays = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const startOffset = (firstDayOfWeek + 6) % 7; // Mon = 0, ..., Sun = 6

    const days: {
      dayNumber: number;
      dateString: string;
      sessions: SalaryAccrualItem[];
      totalAmount: number;
    }[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const dayPad = String(d).padStart(2, "0");
      const monthPad = String(month).padStart(2, "0");
      const dateString = `${year}-${monthPad}-${dayPad}`;
      const sessions = accrualsByDate.get(dateString) ?? [];
      const totalAmount = sessions.reduce((sum, s) => sum + s.amount, 0);
      days.push({ dayNumber: d, dateString, sessions, totalAmount });
    }

    return { startOffset, days, totalDays };
  }, [detail.month, accrualsByDate]);

  // Filtered accruals based on selected date
  const filteredAccruals = useMemo(() => {
    if (!selectedDate) return detail.accruals;
    return detail.accruals.filter((line) => line.sessionDate === selectedDate);
  }, [detail.accruals, selectedDate]);

  const selectedDateTotal = useMemo(() => {
    return filteredAccruals.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredAccruals]);

  const teachingDaysCount = accrualsByDate.size;

  return (
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
            {/* Interactive Month Calendar Section */}
            <div className="salary-mini-calendar">
              <div className="salary-mini-calendar-head">
                <div className="salary-mini-calendar-summary">
                  <CalendarDays size={18} aria-hidden="true" />
                  <span>
                    Lịch dạy {formatMonth(detail.month)} (
                    <strong>{teachingDaysCount} ngày dạy</strong> ·{" "}
                    <strong>{detail.accruals.length} buổi</strong>)
                  </span>
                </div>
                <button
                  type="button"
                  className="salary-calendar-toggle-btn"
                  onClick={() => setCalendarExpanded((prev) => !prev)}
                  aria-expanded={calendarExpanded}
                  aria-label={calendarExpanded ? "Thu gọn cuốn lịch" : "Mở cuốn lịch"}
                >
                  {calendarExpanded ? (
                    <>
                      <span>Thu gọn lịch</span>
                      <ChevronUp size={16} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <span>Mở cuốn lịch ({detail.accruals.length} buổi)</span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>

              {calendarExpanded ? (
                <div className="salary-mini-calendar-body">
                  <div className="salary-calendar-weekdays" aria-hidden="true">
                    {WEEKDAY_NAMES.map((name) => (
                      <span key={name} className="salary-calendar-weekday">
                        {name}
                      </span>
                    ))}
                  </div>
                  <div className="salary-calendar-grid" role="grid" aria-label="Lịch dạy trong tháng">
                    {/* Empty offset days */}
                    {Array.from({ length: calendarData.startOffset }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="salary-calendar-day empty"
                        aria-hidden="true"
                      />
                    ))}

                    {/* Active days */}
                    {calendarData.days.map((day) => {
                      const hasSessions = day.sessions.length > 0;
                      const isSelected = selectedDate === day.dateString;
                      return (
                        <button
                          key={day.dateString}
                          type="button"
                          className={`salary-calendar-day${hasSessions ? " has-sessions" : ""}${
                            isSelected ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            if (hasSessions) {
                              setSelectedDate((prev) =>
                                prev === day.dateString ? null : day.dateString,
                              );
                            }
                          }}
                          disabled={!hasSessions}
                          title={
                            hasSessions
                              ? `${formatDate(day.dateString)}: ${
                                  day.sessions.length
                                } buổi · ${formatCurrency(day.totalAmount)}`
                              : `${formatDate(day.dateString)}: Không có buổi dạy`
                          }
                          aria-label={`Ngày ${day.dayNumber}/${calendarData.days[0]?.dateString.split("-")[1]}, ${
                            hasSessions ? `${day.sessions.length} buổi dạy` : "không có buổi dạy"
                          }`}
                          aria-pressed={isSelected}
                        >
                          <span className="salary-day-number">{day.dayNumber}</span>
                          {hasSessions ? (
                            <span className="salary-calendar-dots" aria-hidden="true">
                              {day.sessions.slice(0, 3).map((_, idx) => (
                                <span
                                  key={idx}
                                  className={`salary-calendar-dot salary-dot-${idx + 1}`}
                                />
                              ))}
                              {day.sessions.length > 3 ? (
                                <span className="salary-calendar-dot-more">
                                  +{day.sessions.length - 3}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dot color legends */}
                  <div className="salary-calendar-legend">
                    <span className="salary-legend-title">Ghi chú ca dạy:</span>
                    <span className="salary-legend-item">
                      <span className="salary-calendar-dot salary-dot-1" aria-hidden="true" /> Buổi 1
                    </span>
                    <span className="salary-legend-item">
                      <span className="salary-calendar-dot salary-dot-2" aria-hidden="true" /> Buổi 2
                    </span>
                    <span className="salary-legend-item">
                      <span className="salary-calendar-dot salary-dot-3" aria-hidden="true" /> Buổi 3+
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Active Date Filter Bar */}
            {selectedDate ? (
              <div className="salary-active-filter-bar" role="status">
                <div className="salary-active-filter-info">
                  <CalendarDays size={16} aria-hidden="true" />
                  <span>
                    Đang xem ngày <strong>{formatDate(selectedDate)}</strong> ({filteredAccruals.length}{" "}
                    buổi · <strong>{formatCurrency(selectedDateTotal)}</strong>)
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  className="salary-clear-filter-btn"
                  onClick={() => setSelectedDate(null)}
                >
                  <X size={14} aria-hidden="true" /> Xem tất cả {detail.accruals.length} buổi
                </Button>
              </div>
            ) : null}

            {/* Accruals List Table / Cards */}
            <div className="salary-line-columns" aria-hidden="true">
              <span>Ngày dạy</span>
              <span>Lớp học</span>
              <span>Thời lượng và đơn giá</span>
              <span>Thành tiền</span>
              <span>Trạng thái</span>
            </div>

            <div className="salary-line-list">
              {filteredAccruals.map((line) => (
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
                    {formatDate(item.paidAt)} ·{" "}
                    {item.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
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
};
