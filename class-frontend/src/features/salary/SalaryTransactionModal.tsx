import { useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useTenant } from "../../app/providers/TenantProvider";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { formatCurrency } from "../../shared/lib/format";
import { getTodayInBusinessTimezone } from "../../shared/lib/calendar";
import { ApiError } from "../../shared/types/api";
import type { SalaryAdjustment, SalaryPayment, TeacherOption } from "../../shared/types/domain";
import { Input, Select, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";

export type SalaryEditor = { kind: "adjustment"; item?: SalaryAdjustment } | { kind: "payment"; item?: SalaryPayment };

interface Props { editor: SalaryEditor | null; teacherId: string; month: string; teachers: TeacherOption[]; outstanding: number; onClose: () => void; onSaved: () => void; }

export const SalaryTransactionModal = ({ editor, teacherId, month, teachers, outstanding, onClose, onSaved }: Props) => {
  const tenant = useTenant();
  const adjustment = editor?.kind === "adjustment" ? editor.item : undefined;
  const payment = editor?.kind === "payment" ? editor.item : undefined;
  const [selectedTeacher, setSelectedTeacher] = useState(adjustment?.teacherId ?? payment?.teacherId ?? teacherId);
  const [salaryMonth, setSalaryMonth] = useState(adjustment?.salaryMonth ?? payment?.salaryMonth ?? month);
  const [amount, setAmount] = useState(String(adjustment?.amount ?? payment?.amount ?? ""));
  const [reason, setReason] = useState(adjustment?.reason ?? "");
  const [paidAt, setPaidAt] = useState(payment?.paidAt ?? getTodayInBusinessTimezone());
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">(payment?.method ?? "BANK_TRANSFER");
  const [reference, setReference] = useState(payment?.reference ?? "");
  const [confirmOverpayment, setConfirmOverpayment] = useState(Boolean(payment?.overpaymentReason));
  const [overpaymentReason, setOverpaymentReason] = useState(payment?.overpaymentReason ?? "");
  const [editReason, setEditReason] = useState("");
  const [error, setError] = useState("");
  const [serverRequiresOverpayment, setServerRequiresOverpayment] = useState(false);
  const numericAmount = Number(amount);
  const available = outstanding + (payment?.teacherId === selectedTeacher && payment.salaryMonth === salaryMonth ? payment.amount : 0);
  const isOverpayment = editor?.kind === "payment" && (
    serverRequiresOverpayment
    || (Number.isFinite(numericAmount) && numericAmount > Math.max(available, 0))
  );
  const isEdit = Boolean(adjustment || payment);
  const title = useMemo(() => editor?.kind === "adjustment" ? `${isEdit ? "Sửa" : "Thêm"} khoản cộng / trừ` : `${isEdit ? "Sửa" : "Ghi"} thanh toán lương`, [editor?.kind, isEdit]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!editor) return;
      if (editor.kind === "adjustment") {
        const input = { teacherId: selectedTeacher, salaryMonth, amount: numericAmount, reason };
        return adjustment ? salaryRepository.updateAdjustment(tenant.slug, adjustment.id, { ...input, editReason, version: adjustment.version }) : salaryRepository.createAdjustment(tenant.slug, input);
      }
      const input = { teacherId: selectedTeacher, salaryMonth, paidAt, amount: numericAmount, method, reference, confirmOverpayment, overpaymentReason };
      return payment ? salaryRepository.updatePayment(tenant.slug, payment.id, { ...input, editReason, version: payment.version }) : salaryRepository.createPayment(tenant.slug, input);
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === "OVERPAYMENT_CONFIRMATION_REQUIRED")
        setServerRequiresOverpayment(true);
      setError(failure instanceof ApiError ? failure.message : "Không thể lưu giao dịch.");
    },
  });
  const invalid = !Number.isFinite(numericAmount) || numericAmount === 0 || !selectedTeacher || !salaryMonth || (editor?.kind === "adjustment" ? !reason.trim() : numericAmount < 0 || (method === "BANK_TRANSFER" && !reference.trim()) || (isOverpayment && (!confirmOverpayment || !overpaymentReason.trim()))) || (isEdit && !editReason.trim());
  return <Modal open={Boolean(editor)} title={title} onClose={onClose} confirmLabel="Lưu vào sổ lương" confirmDisabled={invalid} confirmLoading={mutation.isPending} onConfirm={() => mutation.mutate()}>
    <div className="salary-form-grid"><Select label="Giáo viên" value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}</Select><Input label="Kỳ lương" type="month" value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} /><Input label="Số tiền (VND)" type="number" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} hint={editor?.kind === "adjustment" ? "Dùng số âm cho khoản trừ." : undefined} />
      {editor?.kind === "adjustment" ? <Textarea label="Lý do điều chỉnh" value={reason} onChange={(event) => setReason(event.target.value)} /> : <><Input label="Ngày thanh toán" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /><Select label="Phương thức thanh toán" value={method} onChange={(event) => setMethod(event.target.value as "CASH" | "BANK_TRANSFER")}><option value="BANK_TRANSFER">Chuyển khoản</option><option value="CASH">Tiền mặt</option></Select><Input label="Mã tham chiếu" value={reference} onChange={(event) => setReference(event.target.value)} hint={method === "BANK_TRANSFER" ? "Vui lòng nhập mã giao dịch hoặc nội dung chuyển khoản." : "Không bắt buộc khi trả tiền mặt."} />{isOverpayment ? <div className="overpayment-confirm"><AlertTriangle size={19} /><div><strong>Khoản trả vượt {formatCurrency(Math.max(0, numericAmount - Math.max(available, 0)))}</strong><p>Số tiền đã trả có thể lớn hơn số tiền cần thanh toán và sẽ không tự bù sang kỳ sau.</p><label><input type="checkbox" checked={confirmOverpayment} onChange={(event) => setConfirmOverpayment(event.target.checked)} /> Tôi đã kiểm tra và vẫn muốn ghi khoản trả vượt</label><Textarea label="Lý do trả vượt" value={overpaymentReason} onChange={(event) => setOverpaymentReason(event.target.value)} /></div></div> : null}</>}
      {isEdit ? <Textarea label="Lý do sửa giao dịch" value={editReason} onChange={(event) => setEditReason(event.target.value)} hint="Vui lòng nhập lý do. Thông tin trước và sau khi sửa sẽ được lưu trong lịch sử." /> : null}
    </div>{error ? <p className="form-banner error" role="alert">{error}</p> : null}
  </Modal>;
};
