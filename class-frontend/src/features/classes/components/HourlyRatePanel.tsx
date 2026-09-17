import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, History } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useTenant } from "../../../app/providers/TenantProvider";
import { salaryRepository } from "../../../services/repositories/salaryRepository";
import { getTodayInBusinessTimezone } from "../../../shared/lib/calendar";
import { formatCurrency, formatDate } from "../../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../../shared/lib/permissions";
import type { HourlyRate } from "../../../shared/types/domain";
import { Button } from "../../../shared/ui/Button";
import { Input, Textarea } from "../../../shared/ui/FormField";
import { Modal } from "../../../shared/ui/Modal";
import { StatePanel } from "../../../shared/ui/StatePanel";

export const HourlyRatePanel = ({ classId }: { classId: string }) => {
  const tenant = useTenant(); const { session } = useAuth(); const client = useQueryClient();
  const canManage = Boolean(session && hasPermission(session.user.roles, PERMISSIONS.MANAGE_CLASS_RATES));
  const [editing, setEditing] = useState<HourlyRate | "new" | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(getTodayInBusinessTimezone());
  const [hourlyRate, setHourlyRate] = useState(""); const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: ["hourly-rates", tenant.id, classId], queryFn: () => salaryRepository.hourlyRates(tenant.slug, classId) });
  const open = (rate: HourlyRate | "new") => { setEditing(rate); setEffectiveDate(rate === "new" ? getTodayInBusinessTimezone() : rate.effectiveDate); setHourlyRate(rate === "new" ? "" : String(rate.hourlyRate)); setReason(""); };
  const mutation = useMutation({ mutationFn: async () => { if (editing === "new") await salaryRepository.createHourlyRate(tenant.slug, classId, { effectiveDate, hourlyRate: Number(hourlyRate), reason }); else if (editing) await salaryRepository.updateHourlyRate(tenant.slug, classId, editing.id, { effectiveDate, hourlyRate: Number(hourlyRate), reason, version: editing.version }); }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["hourly-rates", tenant.id, classId] }); await client.invalidateQueries({ queryKey: ["class-detail", tenant.id, classId] }); setEditing(null); } });
  return <section className="panel-flat section-panel hourly-rate-panel"><header><div><p className="eyebrow">ĐƠN GIÁ GIẢNG DẠY</p><h2 className="section-title">Lịch sử đơn giá dạy</h2></div>{canManage ? <Button variant="secondary" onClick={() => open("new")}><CirclePlus size={16} /> Thêm mức giá</Button> : <History size={20} />}</header>
    {query.isError ? <StatePanel kind="error" title="Không tải được đơn giá" description="Vui lòng thử lại." actionLabel="Thử lại" onAction={() => void query.refetch()} /> : <div className="rate-timeline">{query.data?.map((rate, index) => <article key={rate.id} className={index === 0 ? "current" : ""}><span className="rate-dot" /><div><strong>{formatCurrency(rate.hourlyRate)}/giờ</strong><small>{formatDate(rate.effectiveDate)} → {rate.effectiveTo ? formatDate(rate.effectiveTo) : "hiện tại"}</small></div><span>Lần cập nhật {rate.version}</span>{canManage ? <Button variant="ghost" onClick={() => open(rate)}>Sửa</Button> : null}</article>)}</div>}
    <Modal open={Boolean(editing)} title={editing === "new" ? "Thêm đơn giá áp dụng" : "Sửa đơn giá"} onClose={() => setEditing(null)} confirmLabel="Lưu và tính lại" confirmDisabled={!effectiveDate || Number(hourlyRate) <= 0 || !reason.trim()} confirmLoading={mutation.isPending} onConfirm={() => mutation.mutate()}><div className="modal-form"><Input label="Ngày bắt đầu áp dụng" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /><Input label="Đơn giá mỗi giờ (VND)" type="number" min="1" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} /><Textarea label="Lý do thay đổi" value={reason} onChange={(event) => setReason(event.target.value)} hint="Lương của các buổi đã hoàn tất bị ảnh hưởng sẽ được tự động tính lại." /></div></Modal>
  </section>;
};
