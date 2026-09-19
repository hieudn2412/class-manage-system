import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CalendarDays,
  CircleAlert,
  Clock3,
  CreditCard,
  ReceiptText,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { formatCurrency, formatMonth, getCurrentMonth } from "../../shared/lib/format";
import type { SalaryBalanceStatus } from "../../shared/types/domain";
import { Badge, type BadgeTone } from "../../shared/ui/Badge";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { SalaryDetailSections } from "./SalaryDetailSections";

const statusContent: Record<
  SalaryBalanceStatus,
  {
    balanceLabel: string;
    badgeLabel: string;
    description: string;
    tone: BadgeTone;
  }
> = {
  OWED: {
    balanceLabel: "Còn được thanh toán",
    badgeLabel: "Chưa thanh toán hết",
    description: "Khoản trung tâm còn cần thanh toán cho bạn trong kỳ này.",
    tone: "warning",
  },
  OVERPAID: {
    balanceLabel: "Đã thanh toán vượt",
    badgeLabel: "Đã trả vượt",
    description: "Khoản đã thanh toán đang cao hơn tổng lương của kỳ này.",
    tone: "danger",
  },
  SETTLED: {
    balanceLabel: "Số tiền còn lại",
    badgeLabel: "Đã cân bằng",
    description: "Các khoản lương trong kỳ đã được cân bằng.",
    tone: "success",
  },
};

const formatHours = (minutes: number) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  }).format(minutes / 60);

export const MySalaryPage = () => {
  const tenant = useTenant();
  const { tenantSlug } = useParams();
  const [month, setMonth] = useState(getCurrentMonth());
  const query = useQuery({
    queryKey: ["my-salary", tenant.id, month],
    queryFn: () => salaryRepository.ownPayroll(tenant.slug, month),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="Không tải được lương của bạn"
        description="Kiểm tra kết nối rồi thử lại."
        actionLabel="Thử lại"
        onAction={() => void query.refetch()}
      />
    );
  }

  const detail = query.data;
  const status = statusContent[detail.metrics.status];
  const balance =
    detail.metrics.status === "OVERPAID"
      ? Math.abs(detail.metrics.outstanding)
      : detail.metrics.outstanding;

  return (
    <section className="salary-page my-salary-page">
      <header className="my-salary-header">
        <div>
          <p className="eyebrow">LƯƠNG CỦA TÔI</p>
          <h1>Giờ dạy và lương của tôi</h1>
          <p>Theo dõi số buổi, thu nhập và các khoản đã thanh toán trong từng tháng.</p>
        </div>
        <label className="my-salary-month-control">
          <span>Kỳ lương</span>
          <span className="my-salary-month-input">
            <CalendarDays size={17} aria-hidden="true" />
            <input
              type="month"
              value={month}
              aria-label="Kỳ lương"
              onChange={(event) => setMonth(event.target.value)}
            />
          </span>
        </label>
      </header>

      <section
        className={`my-salary-statement status-${detail.metrics.status.toLowerCase()}`}
        aria-labelledby="my-salary-statement-title"
      >
        <header className="my-salary-statement-header">
          <div className="my-salary-statement-period">
            <span className="my-salary-statement-icon">
              <WalletCards size={22} aria-hidden="true" />
            </span>
            <div>
              <small id="my-salary-statement-title">Phiếu lương</small>
              <strong>{formatMonth(month)}</strong>
            </div>
          </div>
          <Badge tone={status.tone}>{status.badgeLabel}</Badge>
        </header>

        <div className="my-salary-balance">
          <span>{status.balanceLabel}</span>
          <strong>{formatCurrency(balance)}</strong>
          <p>{status.description}</p>
        </div>

        <dl className="my-salary-metrics">
          <div>
            <dt>
              <ReceiptText size={16} aria-hidden="true" /> Số buổi
            </dt>
            <dd>{detail.metrics.sessionCount}</dd>
          </div>
          <div>
            <dt>
              <Clock3 size={16} aria-hidden="true" /> Tổng giờ
            </dt>
            <dd>{formatHours(detail.metrics.totalMinutes)} giờ</dd>
          </div>
          <div>
            <dt>
              <Banknote size={16} aria-hidden="true" /> Tiền dạy
            </dt>
            <dd>{formatCurrency(detail.metrics.accrued)}</dd>
          </div>
          <div>
            <dt>
              <SlidersHorizontal size={16} aria-hidden="true" /> Cộng hoặc trừ
            </dt>
            <dd>{formatCurrency(detail.metrics.adjustments)}</dd>
          </div>
          <div className="metric-emphasis">
            <dt>
              <WalletCards size={16} aria-hidden="true" /> Tổng lương
            </dt>
            <dd>{formatCurrency(detail.metrics.due)}</dd>
          </div>
          <div>
            <dt>
              <CreditCard size={16} aria-hidden="true" /> Đã thanh toán
            </dt>
            <dd>{formatCurrency(detail.metrics.paid)}</dd>
          </div>
        </dl>
      </section>

      <div className="salary-live-notice my-salary-live-notice">
        <CircleAlert size={18} aria-hidden="true" />
        <p>
          <strong>Số liệu được cập nhật tự động.</strong> Các thay đổi của buổi dạy sẽ được tính lại
          và lưu trong lịch sử.
        </p>
      </div>

      <SalaryDetailSections detail={detail} basePath={`/t/${tenantSlug}/app`} variant="personal" />
    </section>
  );
};
