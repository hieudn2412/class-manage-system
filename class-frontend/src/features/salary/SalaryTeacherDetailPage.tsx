import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleMinus, CirclePlus, CreditCard } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { classRepository } from "../../services/repositories/classRepository";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { formatCurrency, formatMonth, getCurrentMonth } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { SalaryDetailSections } from "./SalaryDetailSections";
import { SalaryTransactionModal, type SalaryEditor } from "./SalaryTransactionModal";

export const SalaryTeacherDetailPage = () => {
  const tenant = useTenant();
  const { tenantSlug, teacherId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? getCurrentMonth();
  const [editor, setEditor] = useState<SalaryEditor | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["teacher-payroll", tenant.id, teacherId, month], queryFn: () => salaryRepository.teacherPayroll(tenant.slug, teacherId, month), enabled: Boolean(teacherId) });
  const teachers = useQuery({ queryKey: ["teachers", tenant.id], queryFn: () => classRepository.listTeachers(tenant.slug) });
  if (query.isLoading || teachers.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <StatePanel kind="error" title="Không tải được chi tiết lương" description="Dữ liệu không thuộc tenant hoặc kết nối bị gián đoạn." actionLabel="Thử lại" onAction={() => void query.refetch()} />;
  const detail = query.data;
  const tone = detail.metrics.status === "OVERPAID" ? "danger" : detail.metrics.status === "OWED" ? "warning" : "success";
  return <section className="salary-page"><Link className="back-link" to={`/t/${tenantSlug}/app/finance/salaries?month=${month}`}><ArrowLeft size={17} /> Quay lại bảng lương</Link>
    <header className="salary-detail-hero"><div><p className="eyebrow">TEACHER LEDGER · {month}</p><h1>{detail.teacherName}</h1><p>Mỗi dòng tiền đều truy được về buổi, kỳ và giao dịch gốc.</p></div><div className="salary-detail-actions"><label><span>Kỳ lương</span><input type="month" value={month} onChange={(event) => setParams({ month: event.target.value })} /></label><Button variant="secondary" onClick={() => setEditor({ kind: "adjustment" })}><CirclePlus size={17} /> Cộng / trừ</Button><Button onClick={() => setEditor({ kind: "payment" })}><CreditCard size={17} /> Ghi thanh toán</Button></div></header>
    <div className="salary-balance-card"><div><span>{formatMonth(month)}</span><Badge tone={tone}>{detail.metrics.status === "OWED" ? "Còn phải trả" : detail.metrics.status === "OVERPAID" ? "Trả thừa" : "Đã cân bằng"}</Badge></div><strong className={detail.metrics.outstanding < 0 ? "amount-negative" : ""}>{formatCurrency(detail.metrics.outstanding)}</strong><dl><div><dt>Tiền dạy</dt><dd>{formatCurrency(detail.metrics.accrued)}</dd></div><div><dt>Cộng / trừ</dt><dd>{formatCurrency(detail.metrics.adjustments)}</dd></div><div><dt>Đã trả</dt><dd>{formatCurrency(detail.metrics.paid)}</dd></div><div><dt>Giờ dạy</dt><dd>{(detail.metrics.totalMinutes / 60).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</dd></div></dl>{detail.metrics.status === "OVERPAID" ? <p><CircleMinus size={16} /> Khoản trả thừa chỉ được cảnh báo trong v1; hệ thống không tự bù kỳ sau.</p> : null}</div>
    <SalaryDetailSections detail={detail} basePath={`/t/${tenantSlug}/app`} editable onEditAdjustment={(item) => setEditor({ kind: "adjustment", item })} onEditPayment={(item) => setEditor({ kind: "payment", item })} />
    <SalaryTransactionModal key={`${editor?.kind}-${editor && "item" in editor ? editor.item?.id ?? "new" : "closed"}`} editor={editor} teacherId={teacherId} month={month} teachers={teachers.data ?? []} outstanding={detail.metrics.outstanding} onClose={() => setEditor(null)} onSaved={() => { void client.invalidateQueries({ queryKey: ["teacher-payroll", tenant.id, teacherId, month] }); void client.invalidateQueries({ queryKey: ["salary-payroll", tenant.id] }); }} />
  </section>;
};
