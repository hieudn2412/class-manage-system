import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Download, Search, WalletCards } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { formatCurrency, formatMonth, getCurrentMonth } from "../../shared/lib/format";
import type { SalaryBalanceStatus } from "../../shared/types/domain";
import { Badge, type BadgeTone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

const statusMeta: Record<SalaryBalanceStatus, { label: string; tone: BadgeTone }> = {
  OWED: { label: "Còn phải trả", tone: "warning" },
  SETTLED: { label: "Đã cân bằng", tone: "success" },
  OVERPAID: { label: "Trả thừa", tone: "danger" },
};

const hours = (minutes: number) => new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
}).format(minutes / 60);

export const SalaryPayrollPage = () => {
  const tenant = useTenant();
  const { tenantSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMonth = searchParams.get("month");
  const [month, setMonth] = useState(
    requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : getCurrentMonth(),
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("-outstanding");
  const [page, setPage] = useState(1);
  const { showToast } = useToast();
  const queryInput = { month, search, status, page, pageSize: 20, sort };
  const query = useQuery({
    queryKey: ["salary-payroll", tenant.id, queryInput],
    queryFn: () => salaryRepository.payroll(tenant.slug, queryInput),
  });
  const exportMutation = useMutation({
    mutationFn: () => salaryRepository.exportPayroll(tenant.slug, { month, search, status, sort }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `salary-payroll-${month}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Đã xuất bảng lương theo bộ lọc hiện tại.");
    },
  });
  if (query.isLoading) return <PageSkeleton />;
  const data = query.data;
  return (
    <section className="salary-page management-page">
      <header className="salary-header">
        <div>
          <p className="eyebrow">QUẢN LÝ BẢNG LƯƠNG</p>
          <h1>Lương phát sinh và đã trả</h1>
          <p>Kỳ lương luôn mở; mọi thay đổi buổi cũ được phản ánh trực tiếp vào số dư.</p>
        </div>
        <Button variant="secondary" loading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
          <Download size={17} aria-hidden="true" /> Xuất Excel
        </Button>
      </header>

      <div className="salary-period-strip">
        <div className="salary-period-mark"><WalletCards size={22} /><span>Kỳ đối soát</span></div>
        <label><span className="sr-only">Chọn kỳ lương</span><input type="month" value={month} onChange={(event) => { const nextMonth = event.target.value; setMonth(nextMonth); setPage(1); setSearchParams({ month: nextMonth }, { replace: true }); }} /></label>
        <strong>{formatMonth(month)}</strong><small>Asia/Ho_Chi_Minh · Không khóa kỳ</small>
      </div>

      {data ? <div className="salary-metric-grid" aria-label="Tổng quan bảng lương">
        <article><span>Tổng giờ</span><strong>{hours(data.metrics.totalMinutes)}</strong><small>{data.metrics.sessionCount} buổi đã hoàn tất</small></article>
        <article><span>Lương phát sinh</span><strong>{formatCurrency(data.metrics.accrued)}</strong><small>{data.metrics.teacherCount} giáo viên</small></article>
        <article><span>Đã trả</span><strong>{formatCurrency(data.metrics.paid)}</strong><small>Theo kỳ lương được chọn</small></article>
        <article className={data.metrics.outstanding < 0 ? "metric-negative" : "metric-accent"}><span>Số dư</span><strong>{formatCurrency(data.metrics.outstanding)}</strong><small>{data.metrics.overpaidTeachers} trường hợp trả thừa</small></article>
      </div> : null}

      <div className="salary-filter-bar">
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm giáo viên…" /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Lọc trạng thái"><option value="">Mọi trạng thái</option><option value="OWED">Còn phải trả</option><option value="SETTLED">Đã cân bằng</option><option value="OVERPAID">Trả thừa</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp"><option value="-outstanding">Số dư cao nhất</option><option value="teacherName">Tên giáo viên</option><option value="-accrued">Lương phát sinh</option><option value="-paid">Đã trả</option></select>
      </div>

      {query.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được bảng lương"
          description="Kiểm tra kết nối rồi thử lại."
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      ) : !data?.teachers.items.length ? (
        <StatePanel
          kind="empty"
          title="Không có dữ liệu lương phù hợp"
          description="Thay đổi kỳ hoặc bộ lọc để tiếp tục."
        />
      ) : (
        <>
          <div className="data-table-wrap responsive-table-wrap salary-table-wrap">
            <table className="data-table responsive-card-table salary-table">
              <caption className="sr-only">Bảng lương giáo viên</caption>
              <thead>
                <tr>
                  <th scope="col">Giáo viên</th>
                  <th scope="col">Giờ / buổi</th>
                  <th scope="col">Tiền dạy</th>
                  <th scope="col">Cộng hoặc trừ</th>
                  <th scope="col">Đã trả</th>
                  <th scope="col">Còn lại</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.teachers.items.map((row) => {
                  const meta = statusMeta[row.status];
                  return (
                    <tr key={row.teacherId}>
                      <td data-label="Giáo viên">
                        <strong>{row.teacherName}</strong>
                        <small>Mã sổ {row.teacherId.slice(0, 8).toUpperCase()}</small>
                      </td>
                      <td data-label="Giờ / buổi">
                        <strong>{hours(row.totalMinutes)} giờ</strong>
                        <small>{row.sessionCount} buổi</small>
                      </td>
                      <td className="money-cell" data-label="Tiền dạy">
                        {formatCurrency(row.accrued)}
                      </td>
                      <td
                        className={
                          row.adjustments < 0 ? "money-cell amount-negative" : "money-cell"
                        }
                        data-label="Cộng hoặc trừ"
                      >
                        {formatCurrency(row.adjustments)}
                      </td>
                      <td className="money-cell" data-label="Đã trả">
                        {formatCurrency(row.paid)}
                      </td>
                      <td
                        className={
                          row.outstanding < 0
                            ? "money-cell amount-negative"
                            : "money-cell amount-positive"
                        }
                        data-label="Còn lại"
                      >
                        {formatCurrency(row.outstanding)}
                      </td>
                      <td data-label="Trạng thái">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td data-label="Thao tác">
                        <Link
                          className="table-action"
                          to={`/t/${tenantSlug}/app/finance/salaries/${row.teacherId}?month=${month}`}
                        >
                          Xem chi tiết <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.teachers.page}
            totalPages={data.teachers.totalPages}
            totalItems={data.teachers.totalItems}
            itemLabel="giáo viên"
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
};
