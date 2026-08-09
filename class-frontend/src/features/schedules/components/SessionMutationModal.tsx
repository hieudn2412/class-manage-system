import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTenant } from "../../../app/providers/TenantProvider";
import { scheduleRepository } from "../../../services/repositories/scheduleRepository";
import { timeFromIso } from "../../../shared/lib/calendar";
import { ApiError } from "../../../shared/types/api";
import type {
  ClassSchedulingOptions,
  DeliveryMode,
  MakeupScheduleInput,
  ScheduleConflict,
  SchedulePreview,
  SessionAction,
} from "../../../shared/types/domain";
import { Input, Select, Textarea } from "../../../shared/ui/FormField";
import { Modal } from "../../../shared/ui/Modal";
import { useToast } from "../../../shared/ui/Toast";

export interface SessionMutationTarget {
  id: string;
  className: string;
  classCode: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  actualTeacherId: string;
  actualTeacherName?: string;
  mode: DeliveryMode;
  roomId: string | null;
  version: number;
}

interface SessionMutationModalProps {
  action: SessionAction;
  session: SessionMutationTarget;
  options: ClassSchedulingOptions;
  onClose: () => void;
  onSaved: () => void;
}

const dateInVietnam = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

const actionTitle: Record<SessionAction, string> = {
  SUBSTITUTE_TEACHER: "Thay giáo viên",
  CANCEL_SESSION: "Hủy / xếp bù",
  CREATE_MAKEUP: "Tạo buổi bù",
};

const firstActiveRoom = (options: ClassSchedulingOptions, fallback: string | null) =>
  fallback ?? options.rooms.find((room) => room.status === "ACTIVE")?.id ?? "";

const firstReplacementTeacher = (options: ClassSchedulingOptions, currentTeacherId: string) =>
  options.teachers.find((teacher) => teacher.id !== currentTeacherId)?.id ?? "";

const conflictText = (conflict: ScheduleConflict) => {
  const names = conflict.studentNames.length > 0 ? ` · ${conflict.studentNames.join(", ")}` : "";
  return `${conflict.conflictingSession.className} ${timeFromIso(
    conflict.conflictingSession.startAt,
  )}–${timeFromIso(conflict.conflictingSession.endAt)}${names}`;
};

export const SessionMutationModal = ({
  action,
  session,
  options,
  onClose,
  onSaved,
}: SessionMutationModalProps) => {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [teacherId, setTeacherId] = useState(() =>
    firstReplacementTeacher(options, session.actualTeacherId),
  );
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [createMakeupNow, setCreateMakeupNow] = useState(action === "CREATE_MAKEUP");
  const [makeup, setMakeup] = useState<MakeupScheduleInput>({
    date: dateInVietnam(session.startAt),
    startTime: timeFromIso(session.startAt),
    endTime: timeFromIso(session.endAt),
    teacherId: session.actualTeacherId,
    mode: session.mode,
    roomId: session.mode === "IN_PERSON" ? firstActiveRoom(options, session.roomId) : null,
  });
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");

  const blockers = preview?.conflicts.filter((item) => item.severity === "BLOCKING") ?? [];
  const warnings = preview?.conflicts.filter((item) => item.severity === "WARNING") ?? [];
  const warningIds = warnings.map((item) => item.id);
  const needsMakeupPreview = action === "CREATE_MAKEUP" || createMakeupNow;
  const hasReplacementTeacher = action !== "SUBSTITUTE_TEACHER"
    || (teacherId !== "" && teacherId !== session.actualTeacherId);
  const canConfirmPreview = Boolean(preview) && blockers.length === 0
    && (warnings.length === 0 || acknowledged) && hasReplacementTeacher;

  const invalidateRelated = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["management-schedule", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-schedule", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["session-operations", tenant.id, session.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-class-sessions", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["management-dashboard", tenant.id] }),
    ]);
  };

  const clearPreview = () => {
    setPreview(null);
    setAcknowledged(false);
    setError("");
  };

  const updateMakeup = <K extends keyof MakeupScheduleInput>(
    key: K,
    value: MakeupScheduleInput[K],
  ) => {
    setMakeup((current) => ({ ...current, [key]: value }));
    clearPreview();
  };

  const previewMutation = useMutation({
    mutationFn: () => {
      if (action === "SUBSTITUTE_TEACHER") {
        return scheduleRepository.previewSubstitution(tenant.slug, session.id, {
          teacherId,
          note,
          version: session.version,
        });
      }
      return scheduleRepository.previewMakeup(tenant.slug, session.id, {
        makeup: normalizeMakeup(makeup),
        version: session.version,
      });
    },
    onSuccess: (result) => {
      setPreview(result);
      setAcknowledged(false);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Không thể kiểm tra lịch."),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (action === "SUBSTITUTE_TEACHER") {
        if (!preview) throw new Error("Missing preview");
        return scheduleRepository.substituteTeacher(tenant.slug, session.id, {
          teacherId,
          note,
          version: session.version,
          previewId: preview.previewId,
          acknowledgedWarningIds: warningIds,
        });
      }
      if (action === "CREATE_MAKEUP") {
        if (!preview) throw new Error("Missing preview");
        return scheduleRepository.createMakeup(tenant.slug, session.id, {
          version: session.version,
          previewId: preview.previewId,
          makeup: normalizeMakeup(makeup),
          acknowledgedWarningIds: warningIds,
        });
      }
      return scheduleRepository.cancelSession(tenant.slug, session.id, {
        reason,
        version: session.version,
        makeup: createMakeupNow ? normalizeMakeup(makeup) : null,
        previewId: createMakeupNow ? preview?.previewId : null,
        acknowledgedWarningIds: createMakeupNow ? warningIds : [],
      });
    },
    onSuccess: async () => {
      await invalidateRelated();
      showToast(successMessage(action, createMakeupNow));
      onSaved();
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : "Không thể lưu thao tác.");
      if (caught instanceof ApiError && caught.code === "SCHEDULE_PREVIEW_STALE") {
        setPreview(null);
      }
    },
  });

  const confirmLabel = useMemo(() => {
    if (action === "SUBSTITUTE_TEACHER") return preview ? "Xác nhận thay giáo viên" : "Kiểm tra lịch";
    if (action === "CREATE_MAKEUP") return preview ? "Tạo buổi bù" : "Kiểm tra lịch bù";
    if (!createMakeupNow) return "Xác nhận hủy buổi";
    return preview ? "Hủy và tạo bù" : "Kiểm tra lịch bù";
  }, [action, createMakeupNow, preview]);

  const handleConfirm = () => {
    setError("");
    if (action === "SUBSTITUTE_TEACHER" && !hasReplacementTeacher) {
      setError("Chọn một giáo viên khác giáo viên hiện tại.");
      return;
    }
    if (action === "CANCEL_SESSION" && !reason.trim()) {
      setError("Nhập lý do hủy buổi.");
      return;
    }
    if ((action === "SUBSTITUTE_TEACHER" || needsMakeupPreview) && !preview) {
      previewMutation.mutate();
      return;
    }
    if ((action === "SUBSTITUTE_TEACHER" || needsMakeupPreview) && !canConfirmPreview) {
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Modal
      open
      title={actionTitle[action]}
      onClose={onClose}
      confirmLabel={confirmLabel}
      onConfirm={handleConfirm}
      confirmDisabled={
        !hasReplacementTeacher
        || (Boolean(preview) && blockers.length > 0)
        || (warnings.length > 0 && !acknowledged)
      }
      confirmLoading={previewMutation.isPending || saveMutation.isPending}
    >
      <div className="modal-form-stack">
        <div className="fl07-session-context">
          <span>
            {action === "SUBSTITUTE_TEACHER" ? (
              <UserRoundCheck size={18} aria-hidden="true" />
            ) : action === "CANCEL_SESSION" ? (
              <XCircle size={18} aria-hidden="true" />
            ) : (
              <CalendarPlus size={18} aria-hidden="true" />
            )}
          </span>
          <strong>
            {session.classCode} · Buổi {session.ordinal}
          </strong>
          <small>{session.className}</small>
        </div>

        {action === "SUBSTITUTE_TEACHER" ? (
          <>
            <Select
              label="Giáo viên thay thế"
              value={teacherId}
              onChange={(event) => {
                setTeacherId(event.target.value);
                clearPreview();
              }}
            >
              <option value="">Chọn giáo viên thay thế</option>
              {options.teachers.map((teacher) => (
                <option
                  value={teacher.id}
                  disabled={teacher.id === session.actualTeacherId}
                  key={teacher.id}
                >
                  {teacher.name}
                </option>
              ))}
            </Select>
            <Textarea
              label="Ghi chú"
              rows={3}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                clearPreview();
              }}
              placeholder="Lý do hoặc ghi chú nội bộ, có thể bỏ trống."
            />
          </>
        ) : null}

        {action === "CANCEL_SESSION" ? (
          <>
            <Textarea
              label="Lý do hủy"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <label className="warning-acknowledgement">
              <input
                type="checkbox"
                checked={createMakeupNow}
                onChange={(event) => {
                  setCreateMakeupNow(event.target.checked);
                  clearPreview();
                }}
              />
              <span>
                <strong>Xếp buổi bù ngay</strong>
                <small>Có thể bỏ chọn để tạo buổi bù sau từ buổi đã hủy.</small>
              </span>
            </label>
          </>
        ) : null}

        {needsMakeupPreview ? (
          <MakeupFields makeup={makeup} options={options} onChange={updateMakeup} />
        ) : null}

        {error ? (
          <div className="form-alert" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            {error}
          </div>
        ) : null}
        <PreviewResult
          preview={preview}
          blockers={blockers}
          warnings={warnings}
          acknowledged={acknowledged}
          onAcknowledge={setAcknowledged}
        />
      </div>
    </Modal>
  );
};

const MakeupFields = ({
  makeup,
  options,
  onChange,
}: {
  makeup: MakeupScheduleInput;
  options: ClassSchedulingOptions;
  onChange: <K extends keyof MakeupScheduleInput>(key: K, value: MakeupScheduleInput[K]) => void;
}) => (
  <div className="fl07-makeup-grid">
    <Input
      label="Ngày bù"
      type="date"
      value={makeup.date}
      onChange={(event) => onChange("date", event.target.value)}
    />
    <Input
      label="Bắt đầu"
      type="time"
      value={makeup.startTime}
      onChange={(event) => onChange("startTime", event.target.value)}
    />
    <Input
      label="Kết thúc"
      type="time"
      value={makeup.endTime}
      onChange={(event) => onChange("endTime", event.target.value)}
    />
    <Select
      label="Giáo viên"
      value={makeup.teacherId}
      onChange={(event) => onChange("teacherId", event.target.value)}
    >
      {options.teachers.map((teacher) => (
        <option value={teacher.id} key={teacher.id}>
          {teacher.name}
        </option>
      ))}
    </Select>
    <Select
      label="Hình thức"
      value={makeup.mode}
      onChange={(event) => {
        const mode = event.target.value as DeliveryMode;
        onChange("mode", mode);
        onChange("roomId", mode === "ONLINE" ? null : firstActiveRoom(options, makeup.roomId));
      }}
    >
      <option value="IN_PERSON">Tại lớp</option>
      <option value="ONLINE">Online</option>
    </Select>
    {makeup.mode === "IN_PERSON" ? (
      <Select
        label="Phòng"
        value={makeup.roomId ?? ""}
        onChange={(event) => onChange("roomId", event.target.value)}
      >
        <option value="">Chọn phòng</option>
        {options.rooms.map((room) => (
          <option value={room.id} disabled={room.status === "INACTIVE"} key={room.id}>
            {room.code} · {room.capacity} chỗ
          </option>
        ))}
      </Select>
    ) : null}
  </div>
);

const PreviewResult = ({
  preview,
  blockers,
  warnings,
  acknowledged,
  onAcknowledge,
}: {
  preview: SchedulePreview | null;
  blockers: ScheduleConflict[];
  warnings: ScheduleConflict[];
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) => {
  if (!preview) return null;
  if (blockers.length > 0) {
    return (
      <div className="override-result-error">
        <AlertCircle size={19} aria-hidden="true" />
        <span>
          <strong>Không thể lưu</strong>
          <small>{blockers.map(conflictText).join("; ")}</small>
        </span>
      </div>
    );
  }
  if (warnings.length > 0) {
    return (
      <>
        <div className="override-result-warning">
          <AlertTriangle size={19} aria-hidden="true" />
          <span>
            <strong>{warnings.length} cảnh báo học sinh trùng lịch</strong>
            <small>{warnings.map(conflictText).join("; ")}</small>
          </span>
        </div>
        <label className="warning-acknowledgement">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => onAcknowledge(event.target.checked)}
          />
          <span>Tôi đã kiểm tra và xác nhận cảnh báo này.</span>
        </label>
      </>
    );
  }
  return (
    <div className="override-result-success">
      <CheckCircle2 size={19} aria-hidden="true" />
      <span>Không có xung đột. Có thể xác nhận thao tác.</span>
    </div>
  );
};

const normalizeMakeup = (input: MakeupScheduleInput): MakeupScheduleInput => ({
  ...input,
  roomId: input.mode === "IN_PERSON" ? input.roomId : null,
});

const successMessage = (action: SessionAction, createMakeupNow: boolean) => {
  if (action === "SUBSTITUTE_TEACHER") return "Đã thay giáo viên và gửi thông báo giáo viên.";
  if (action === "CREATE_MAKEUP") return "Đã tạo buổi bù.";
  return createMakeupNow ? "Đã hủy buổi và tạo buổi bù." : "Đã hủy buổi học.";
};
