import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { classRepository } from "../../services/repositories/classRepository";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import type { SessionOperationsDetail } from "../../shared/types/domain";
import { Button } from "../../shared/ui/Button";
import { Input, Select, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";

const localDateTime = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const withVietnamOffset = (value: string) => `${value}:00+07:00`;

export const CompletionCorrectionModal = ({
  detail,
  tenantSlug,
  onClose,
  onSaved,
}: {
  detail: SessionOperationsDetail;
  tenantSlug: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) => {
  const [startAt, setStartAt] = useState(() => localDateTime(detail.startAt));
  const [endAt, setEndAt] = useState(() => localDateTime(detail.endAt));
  const [teacherId, setTeacherId] = useState(detail.actualTeacherId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const teachers = useQuery({
    queryKey: ["class-teachers", tenantSlug],
    queryFn: () => classRepository.listTeachers(tenantSlug),
  });
  const clientError = useMemo(() => {
    if (!startAt || !endAt || !teacherId || !reason.trim())
      return "Điền đủ thời gian, giáo viên và lý do.";
    if (new Date(withVietnamOffset(endAt)) <= new Date(withVietnamOffset(startAt)))
      return "Giờ kết thúc phải sau giờ bắt đầu.";
    if (new Date(withVietnamOffset(endAt)) > new Date())
      return "Buổi hoàn tất phải có thời điểm kết thúc trong quá khứ.";
    return null;
  }, [endAt, reason, startAt, teacherId]);
  const mutation = useMutation({
    mutationFn: () => salaryRepository.correctCompletion(tenantSlug, detail.id, {
      startAt: withVietnamOffset(startAt),
      endAt: withVietnamOffset(endAt),
      actualTeacherId: teacherId,
      reason: reason.trim(),
      version: detail.version,
    }),
    onSuccess: onSaved,
    onError: (cause) => setError(
      cause instanceof Error ? cause.message : "Không thể sửa buổi đã hoàn tất.",
    ),
  });

  return (
    <Modal open title="Sửa dữ liệu buổi đã hoàn tất" onClose={onClose}>
      <div className="form-stack completion-correction-form">
        <p className="form-note">
          Thao tác này sẽ tính lại lương, có thể chuyển kỳ hoặc chuyển người hưởng lương.
          Lịch sử cũ được giữ trong audit.
        </p>
        <div className="form-grid two-columns">
          <Input label="Bắt đầu" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
          <Input label="Kết thúc" type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
        </div>
        <Select label="Giáo viên thực tế" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} disabled={teachers.isPending}>
          {teachers.data?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
        </Select>
        <Textarea label="Lý do sửa" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
          <Button
            type="button"
            disabled={Boolean(clientError) || mutation.isPending || teachers.isError}
            title={clientError ?? undefined}
            onClick={() => { setError(null); mutation.mutate(); }}
          >
            {mutation.isPending ? "Đang tính lại…" : "Lưu và tính lại lương"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
