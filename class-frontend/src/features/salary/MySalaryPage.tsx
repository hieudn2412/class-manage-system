import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Wallet } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { formatCurrency, formatMonth, getCurrentMonth } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { SalaryDetailSections } from "./SalaryDetailSections";

export const MySalaryPage = () => {
  const tenant = useTenant(); const { tenantSlug } = useParams(); const [month, setMonth] = useState(getCurrentMonth());
  const query = useQuery({ queryKey: ["my-salary", tenant.id, month], queryFn: () => salaryRepository.ownPayroll(tenant.slug, month) });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <StatePanel kind="error" title="Không tải được lương của bạn" description="Kiểm tra kết nối rồi thử lại." actionLabel="Thử lại" onAction={() => void query.refetch()} />;
  const detail = query.data; const tone = detail.metrics.status === "OVERPAID" ? "danger" : detail.metrics.status === "OWED" ? "warning" : "success";
  return <section className="salary-page my-salary-page"><header className="salary-header"><div><p className="eyebrow">LƯƠNG CỦA TÔI</p><h1>Giờ dạy và lương của tôi</h1><p>Xem số giờ dạy, đơn giá và các khoản lương trong từng tháng.</p></div><label className="month-control"><span>Kỳ lương</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></header>
    <div className="my-salary-hero"><div className="my-salary-seal"><Wallet size={26} /><span>{formatMonth(month)}</span></div><div><small>Còn phải trả</small><strong className={detail.metrics.outstanding < 0 ? "amount-negative" : ""}>{formatCurrency(detail.metrics.outstanding)}</strong><Badge tone={tone}>{detail.metrics.status === "OWED" ? "Còn phải trả" : detail.metrics.status === "OVERPAID" ? "Trả thừa" : "Đã cân bằng"}</Badge></div><dl><div><dt>Tổng giờ</dt><dd>{(detail.metrics.totalMinutes / 60).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</dd></div><div><dt>Tiền dạy</dt><dd>{formatCurrency(detail.metrics.accrued)}</dd></div><div><dt>Cộng hoặc trừ</dt><dd>{formatCurrency(detail.metrics.adjustments)}</dd></div><div><dt>Đã trả</dt><dd>{formatCurrency(detail.metrics.paid)}</dd></div></dl></div>
    <div className="salary-live-notice"><CircleAlert size={18} /><p><strong>Số liệu có thể thay đổi.</strong> Nếu thời lượng, giáo viên hoặc đơn giá của buổi cũ được sửa, hệ thống sẽ tự tính lại và lưu lịch sử cập nhật.</p></div>
    <SalaryDetailSections detail={detail} basePath={`/t/${tenantSlug}/app`} />
  </section>;
};
