import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Download, Mail, Search, Send, WalletCards } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { formatCurrency, formatDateTime, formatMonth, getCurrentMonth } from "../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";
import type { PayrollTeacherRow, SalaryBalanceStatus } from "../../shared/types/domain";
import { Badge, type BadgeTone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { notificationLabel, SalaryNotificationModal } from "./SalaryNotificationModal";

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
  const { session } = useAuth();
  const queryClient = useQueryClient();
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
  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, PayrollTeacherRow>>({});
  const [notificationRecipients, setNotificationRecipients] = useState<PayrollTeacherRow[]>([]);
  const { showToast } = useToast();
  const canSendNotifications = Boolean(
    session && hasPermission(session.user.roles, PERMISSIONS.SEND_SALARY_NOTIFICATION),
  );
  const selectedRecipientCount = Object.keys(selectedRecipients).length;
  const clearSelection = () => setSelectedRecipients({});
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
        <div className="salary-header-actions">
          {canSendNotifications ? (
            <span
              className="salary-notification-trigger"
              lang="vi"
              title={selectedRecipientCount
                ? undefined
                : "Chọn ít nhất một giáo viên có email trong bảng để gửi thông báo."}
            >
              <Button
                disabled={!selectedRecipientCount}
                aria-label={selectedRecipientCount
                  ? `Gửi thông báo lương cho ${selectedRecipientCount} giáo viên đã chọn`
                  : "Gửi thông báo lương — hãy chọn ít nhất một giáo viên có email trong bảng"}
                onClick={() => setNotificationRecipients(Object.values(selectedRecipients))}
              >
                <Send size={17} aria-hidden="true" />
                Gửi thông báo lương
                {selectedRecipientCount ? ` (${selectedRecipientCount})` : ""}
              </Button>
            </span>
          ) : null}
          <Button variant="secondary" loading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
            <Download size={17} aria-hidden="true" /> Xuất Excel
          </Button>
        </div>
      </header>

      <div className="salary-period-strip">
        <div className="salary-period-mark"><WalletCards size={22} /><span>Kỳ đối soát</span></div>
        <label><span className="sr-only">Chọn kỳ lương</span><input type="month" value={month} onChange={(event) => { const nextMonth = event.target.value; setMonth(nextMonth); setPage(1); clearSelection(); setSearchParams({ month: nextMonth }, { replace: true }); }} /></label>
        <strong>{formatMonth(month)}</strong><small>Asia/Ho_Chi_Minh · Không khóa kỳ</small>
      </div>

      {data ? <div className="salary-metric-grid" aria-label="Tổng quan bảng lương">
        <article><span>Tổng giờ</span><strong>{hours(data.metrics.totalMinutes)}</strong><small>{data.metrics.sessionCount} buổi đã hoàn tất</small></article>
        <article><span>Lương phát sinh</span><strong>{formatCurrency(data.metrics.accrued)}</strong><small>{data.metrics.teacherCount} giáo viên</small></article>
        <article><span>Đã trả</span><strong>{formatCurrency(data.metrics.paid)}</strong><small>Theo kỳ lương được chọn</small></article>
        <article className={data.metrics.outstanding < 0 ? "metric-negative" : "metric-accent"}><span>Số dư</span><strong>{formatCurrency(data.metrics.outstanding)}</strong><small>{data.metrics.overpaidTeachers} trường hợp trả thừa</small></article>
      </div> : null}

      <div className="salary-filter-bar">
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); clearSelection(); }} placeholder="Tìm giáo viên…" /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); clearSelection(); }} aria-label="Lọc trạng thái"><option value="">Mọi trạng thái</option><option value="OWED">Còn phải trả</option><option value="SETTLED">Đã cân bằng</option><option value="OVERPAID">Trả thừa</option></select>
        <select value={sort} onChange={(event) => { setSort(event.target.value); clearSelection(); }} aria-label="Sắp xếp"><option value="-outstanding">Số dư cao nhất</option><option value="teacherName">Tên giáo viên</option><option value="-accrued">Lương phát sinh</option><option value="-paid">Đã trả</option></select>
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
                  {canSendNotifications ? (
                    <th scope="col" className="salary-select-column">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả giáo viên có email trên trang này"
                        checked={data.teachers.items.some((row) => row.emailAvailable)
                          && data.teachers.items.filter((row) => row.emailAvailable)
                            .every((row) => Boolean(selectedRecipients[row.teacherId]))}
                        onChange={(event) => {
                          const eligible = data.teachers.items.filter((row) => row.emailAvailable);
                          setSelectedRecipients((current) => {
                            const next = { ...current };
                            eligible.forEach((row) => {
                              if (event.target.checked) next[row.teacherId] = row;
                              else delete next[row.teacherId];
                            });
                            return next;
                          });
                        }}
                      />
                    </th>
                  ) : null}
                  <th scope="col">Giáo viên</th>
                  <th scope="col">Giờ / buổi</th>
                  <th scope="col">Tiền dạy</th>
                  <th scope="col">Cộng hoặc trừ</th>
                  <th scope="col">Đã trả</th>
                  <th scope="col">Còn lại</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Email thông báo</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.teachers.items.map((row) => {
                  const meta = statusMeta[row.status];
                  return (
                    <tr key={row.teacherId}>
                      {canSendNotifications ? (
                        <td data-label="Chọn" className="salary-select-column">
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${row.teacherName} để gửi thông báo lương`}
                            checked={Boolean(selectedRecipients[row.teacherId])}
                            disabled={!row.emailAvailable}
                            title={row.emailAvailable ? undefined : "Giáo viên chưa có email"}
                            onChange={(event) => setSelectedRecipients((current) => {
                              const next = { ...current };
                              if (event.target.checked) next[row.teacherId] = row;
                              else delete next[row.teacherId];
                              return next;
                            })}
                          />
                        </td>
                      ) : null}
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
                      <td data-label="Email thông báo">
                        {!row.emailAvailable ? (
                          <Badge tone="neutral">Chưa có email</Badge>
                        ) : row.lastNotificationStatus ? (
                          <span className="salary-notification-status">
                            <Badge tone={row.lastNotificationStatus === "SENT"
                              ? "success"
                              : row.lastNotificationStatus === "FAILED" ? "danger" : "info"}
                            >
                              {notificationLabel[row.lastNotificationStatus]}
                            </Badge>
                            {row.lastNotificationAt ? <small>{formatDateTime(row.lastNotificationAt)}</small> : null}
                          </span>
                        ) : (
                          <span className="muted-text">Chưa gửi</span>
                        )}
                      </td>
                      <td data-label="Thao tác">
                        <div className="salary-row-actions">
                          <Link
                            className="table-action"
                            to={`/t/${tenantSlug}/app/finance/salaries/${row.teacherId}?month=${month}`}
                          >
                            Xem chi tiết <ArrowUpRight size={14} aria-hidden="true" />
                          </Link>
                          {canSendNotifications ? (
                            <Button
                              variant="secondary"
                              disabled={!row.emailAvailable}
                              title={row.emailAvailable ? undefined : "Giáo viên chưa có email"}
                              onClick={() => setNotificationRecipients([row])}
                            >
                              <Mail size={15} aria-hidden="true" /> Gửi email
                            </Button>
                          ) : null}
                        </div>
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
      {notificationRecipients.length ? (
        <SalaryNotificationModal
          open
          month={month}
          recipients={notificationRecipients}
          onClose={() => setNotificationRecipients([])}
          onSent={() => {
            setNotificationRecipients([]);
            clearSelection();
            void queryClient.invalidateQueries({ queryKey: ["salary-payroll", tenant.id] });
          }}
        />
      ) : null}
    </section>
  );
};
