import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Link2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { useTenant } from "../../app/providers/TenantProvider";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { formatDate, formatDateTime } from "../../shared/lib/format";
import { ApiError } from "../../shared/types/api";
import type {
  AttendanceStatus,
  RosterStudent,
  SessionOperationsDetail,
  TestResult,
  TestResultInput,
} from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input, Select, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^https?:\/\/\S+$/i.test(value),
    "URL phải bắt đầu bằng http/https.",
  );

const recordSchema = z.object({
  lessonName: z.string(),
  lessonContent: z.string(),
  recordUrl: optionalUrl,
  students: z.array(
    z.object({
      studentId: z.string(),
      code: z.string(),
      name: z.string(),
      attendanceStatus: z.enum([
        "",
        "PRESENT",
        "LATE",
        "LEFT_EARLY",
        "ABSENT_EXCUSED",
        "ABSENT_UNEXCUSED",
      ]),
      attendanceNote: z.string(),
      sessionComment: z.string(),
      attendanceVersion: z.number(),
      commentVersion: z.number(),
    }),
  ),
});
type RecordForm = z.infer<typeof recordSchema>;

const checkInSchema = z.object({
  onlineLink: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^https?:\/\/\S+$/i.test(value),
      "Link Online phải là URL http/https hợp lệ.",
    ),
});
type CheckInForm = z.infer<typeof checkInSchema>;

const testSchema = z
  .object({
    testName: z.string().trim().min(1, "Nhập tên bài kiểm tra."),
    score: z.number().min(0, "Điểm không được âm."),
    maxScore: z.number().positive("Điểm tối đa phải lớn hơn 0."),
    testDate: z.string().min(1, "Chọn ngày kiểm tra."),
    comment: z.string(),
    version: z.number(),
  })
  .refine((value) => value.score <= value.maxScore, {
    path: ["score"],
    message: "Điểm đạt không được lớn hơn điểm tối đa.",
  });
type TestForm = z.infer<typeof testSchema>;

const verificationSchema = z.object({
  decision: z.enum(["CONFIRM_TAUGHT", "CANCEL"]),
  reason: z.string().trim().min(1, "Quản lý phải nhập lý do."),
});
type VerificationForm = z.infer<typeof verificationSchema>;

const attendanceOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "PRESENT", label: "Có mặt" },
  { value: "LATE", label: "Đi muộn" },
  { value: "LEFT_EARLY", label: "Về sớm" },
  { value: "ABSENT_EXCUSED", label: "Vắng có phép" },
  { value: "ABSENT_UNEXCUSED", label: "Vắng không phép" },
];

const toRecordDefaults = (detail: SessionOperationsDetail): RecordForm => ({
  lessonName: detail.lessonReport.lessonName,
  lessonContent: detail.lessonReport.lessonContent,
  recordUrl: detail.lessonReport.recordUrl ?? "",
  students: detail.students.map((student) => ({
    studentId: student.studentId,
    code: student.code,
    name: student.name,
    attendanceStatus: student.attendanceStatus ?? "",
    attendanceNote: student.attendanceNote,
    sessionComment: student.sessionComment,
    attendanceVersion: student.attendanceVersion,
    commentVersion: student.commentVersion,
  })),
});

const stateLabel: Record<string, string> = {
  TOO_EARLY: "Chưa đến giờ check-in",
  OPEN: "Có thể check-in",
  CHECKED_IN: "Đã check-in",
  WINDOW_CLOSED: "Đã hết cửa sổ check-in",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

const mutationMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) return "Không thể lưu thay đổi. Vui lòng thử lại.";
  if (error.code === "ROSTER_CHANGED")
    return "Danh sách học sinh vừa thay đổi. Hãy tải bản mới trước khi lưu.";
  if (error.code === "SESSION_STATE_CONFLICT")
    return "Trạng thái buổi vừa thay đổi. Hãy tải bản mới.";
  return error.message;
};

export const SessionOperationsPage = () => {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const { showToast } = useToast();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [testTarget, setTestTarget] = useState<{
    student: RosterStudent;
    result: TestResult | null;
  } | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["session-operations", tenant.id, sessionId],
    queryFn: () => teachingRepository.getSession(tenant.slug, sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: (current) => (current.state.data?.status === "IN_PROGRESS" ? 30_000 : false),
  });
  const detail = query.data;
  const recordForm = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: { lessonName: "", lessonContent: "", recordUrl: "", students: [] },
  });
  const { fields } = useFieldArray({ control: recordForm.control, name: "students" });

  useEffect(() => {
    if (detail) recordForm.reset(toRecordDefaults(detail));
  }, [detail, recordForm]);

  const invalidateRelated = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["session-operations", tenant.id, sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-classes", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-class-sessions", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-schedule", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["management-schedule", tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ["management-dashboard", tenant.id] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: (values: RecordForm) => {
      if (!detail) throw new Error("Missing detail");
      return teachingRepository.savePedagogicalRecord(tenant.slug, detail.id, {
        rosterRevision: detail.rosterRevision,
        lessonReport: {
          lessonName: values.lessonName,
          lessonContent: values.lessonContent,
          recordUrl: values.recordUrl || null,
          version: detail.lessonReport.version,
        },
        students: values.students.map((student) => ({
          studentId: student.studentId,
          attendanceStatus: student.attendanceStatus || null,
          attendanceNote: student.attendanceNote,
          attendanceVersion: student.attendanceVersion,
          sessionComment: student.sessionComment,
          commentVersion: student.commentVersion,
        })),
      });
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(["session-operations", tenant.id, sessionId], updated);
      recordForm.reset(toRecordDefaults(updated));
      setSaveError(null);
      await invalidateRelated();
      showToast("Đã lưu điểm danh và hồ sơ buổi học.");
    },
    onError: (error) => setSaveError(mutationMessage(error)),
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !detail) {
    return (
      <StatePanel
        kind="error"
        title="Không thể tải buổi học"
        description="Buổi không thuộc phạm vi của bạn hoặc kết nối bị gián đoạn."
        actionLabel="Thử lại"
        onAction={() => void query.refetch()}
      />
    );
  }

  const isOnline = detail.mode === "ONLINE";
  return (
    <>
      <Link
        className="back-link"
        to={
          detail.actualTeacher
            ? `/t/${tenant.slug}/app/my-classes/${detail.classId}`
            : `/t/${tenant.slug}/app/schedule`
        }
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại
      </Link>
      <PageHeader
        eyebrow={`${detail.classCode} · WF-20/WF-27`}
        title={`${detail.className} · Buổi ${detail.ordinal}`}
        subtitle={`${formatDateTime(detail.startAt)}–${new Intl.DateTimeFormat("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(detail.endAt))} · ${detail.actualTeacherName}`}
        actions={
          <>
            <Badge
              tone={
                detail.status === "COMPLETED"
                  ? "success"
                  : detail.status === "CANCELLED"
                    ? "danger"
                    : "info"
              }
            >
              {stateLabel[detail.checkInState] ?? detail.status}
            </Badge>
            {detail.checkInState === "OPEN" && detail.canEdit ? (
              <Button onClick={() => setCheckInOpen(true)}>
                <UserCheck size={18} aria-hidden="true" />
                Check-in dạy
              </Button>
            ) : null}
            {detail.canVerify && detail.status === "PENDING_CONFIRMATION" ? (
              <Button onClick={() => setVerificationOpen(true)}>
                <ClipboardCheck size={18} aria-hidden="true" />
                Xử lý xác nhận
              </Button>
            ) : null}
          </>
        }
      />

      <section className="session-overview-grid" aria-label="Thông tin buổi học">
        <article className="panel session-overview-card">
          <small>Hình thức</small>
          <strong>{isOnline ? "Online" : (detail.roomName ?? "Tại lớp · chưa có phòng")}</strong>
          {detail.checkIn?.onlineLink ? (
            <a href={detail.checkIn.onlineLink} target="_blank" rel="noreferrer">
              <Link2 size={16} aria-hidden="true" />
              Mở link buổi dạy
            </a>
          ) : null}
        </article>
        <article className="panel session-overview-card">
          <small>Học sinh tham gia</small>
          <strong>
            {detail.participatedStudents}/{detail.students.length}
          </strong>
          <span>{detail.rosterFrozen ? "Roster đã khóa" : "Roster theo enrollment hiện tại"}</span>
        </article>
        <article className="panel session-overview-card">
          <small>Hồ sơ</small>
          <strong>{detail.missingDocumentation ? "Còn thiếu" : "Đã đủ"}</strong>
          <span>
            {detail.checkIn
              ? `Check-in ${formatDateTime(detail.checkIn.checkedInAt)}`
              : "Chưa có check-in"}
          </span>
        </article>
      </section>

      {!detail.canEdit ? (
        <div className="schedule-notice" role="status">
          <LockKeyhole size={20} aria-hidden="true" />
          <span>
            <strong>Buổi học đang ở chế độ chỉ đọc</strong>
            <small>Chỉ giáo viên thực tế của buổi mới được sửa hồ sơ.</small>
          </span>
        </div>
      ) : null}
      {detail.missingDocumentation ? (
        <div className="session-warning" role="status">
          <FileWarning size={20} aria-hidden="true" />
          <span>
            <strong>Buổi đã hoàn tất nhưng còn thiếu điểm danh hoặc record</strong>
            <small>Bạn vẫn có thể bổ sung để xóa cờ theo dõi.</small>
          </span>
        </div>
      ) : null}
      {saveError ? (
        <div className="session-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{saveError}</span>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            Tải bản mới
          </Button>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          void recordForm.handleSubmit((values) => saveMutation.mutate(values))(event);
        }}
        className="session-record-form"
      >
        <section className="panel-flat section-panel" aria-labelledby="lesson-report-title">
          <div className="section-heading-row">
            <span>
              <h2 className="section-title" id="lesson-report-title">
                Nội dung đã dạy
              </h2>
              <p>Record có thể bổ sung sau khi buổi đã tự hoàn tất.</p>
            </span>
          </div>
          <div className="lesson-form-grid">
            <Input
              label="Tên bài học"
              disabled={!detail.canEdit}
              {...recordForm.register("lessonName")}
            />
            <Input
              label="Link record"
              placeholder="https://youtube.com/..."
              disabled={!detail.canEdit}
              error={recordForm.formState.errors.recordUrl?.message}
              {...recordForm.register("recordUrl")}
            />
            <Textarea
              label="Nội dung thực dạy"
              rows={4}
              disabled={!detail.canEdit}
              {...recordForm.register("lessonContent")}
            />
          </div>
        </section>

        <section className="panel-flat section-panel" aria-labelledby="roster-title">
          <div className="section-heading-row">
            <span>
              <h2 className="section-title" id="roster-title">
                Điểm danh và nhận xét học sinh
              </h2>
              <p>Không mặc định Có mặt; giáo viên chọn trạng thái phù hợp cho từng học sinh.</p>
            </span>
            <Badge tone="neutral">{fields.length} học sinh</Badge>
          </div>
          {fields.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Buổi học chưa có học sinh"
              description="Quản lý cần thêm học sinh vào lớp; giáo viên không thể thay đổi danh sách lớp."
            />
          ) : (
            <div className="student-record-list">
              {fields.map((field, index) => {
                const student = detail.students.find((item) => item.studentId === field.studentId);
                return (
                  <article className="student-record-card" key={field.id}>
                    <header>
                      <span>
                        <small>{field.code}</small>
                        <h3>{field.name}</h3>
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!detail.canEdit}
                        onClick={() => student && setTestTarget({ student, result: null })}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Thêm điểm kiểm tra
                      </Button>
                    </header>
                    <div className="student-record-fields">
                      <Select
                        label="Trạng thái đi học"
                        disabled={!detail.canEdit}
                        {...recordForm.register(`students.${index}.attendanceStatus`)}
                      >
                        <option value="">Chưa điểm danh</option>
                        {attendanceOptions.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Ghi chú điểm danh"
                        disabled={!detail.canEdit}
                        {...recordForm.register(`students.${index}.attendanceNote`)}
                      />
                      <Textarea
                        label="Nhận xét buổi học"
                        rows={2}
                        disabled={!detail.canEdit}
                        {...recordForm.register(`students.${index}.sessionComment`)}
                      />
                    </div>
                    {student?.testResults.length ? (
                      <div className="test-result-list">
                        {student.testResults.map((result) => (
                          <button
                            className="test-result-chip"
                            type="button"
                            key={result.id}
                            disabled={!detail.canEdit}
                            onClick={() => setTestTarget({ student, result })}
                          >
                            <strong>{result.testName}</strong>
                            <span>
                              {result.score}/{result.maxScore} · {formatDate(result.testDate)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="muted-copy">Chưa có điểm kiểm tra.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        {detail.canEdit ? (
          <div className="sticky-form-actions">
            <span>
              {recordForm.formState.isDirty ? "Có thay đổi chưa lưu" : "Dữ liệu đã đồng bộ"}
            </span>
            <Button type="submit" loading={saveMutation.isPending}>
              <Save size={18} aria-hidden="true" />
              Lưu hồ sơ buổi
            </Button>
          </div>
        ) : null}
      </form>

      <CheckInModal
        open={checkInOpen}
        detail={detail}
        tenantSlug={tenant.slug}
        onClose={() => setCheckInOpen(false)}
        onSuccess={async (updated) => {
          queryClient.setQueryData(["session-operations", tenant.id, sessionId], updated);
          setCheckInOpen(false);
          await invalidateRelated();
          showToast("Check-in thành công.");
        }}
      />
      <TestResultModal
        target={testTarget}
        detail={detail}
        tenantSlug={tenant.slug}
        onClose={() => setTestTarget(null)}
        onSuccess={async () => {
          setTestTarget(null);
          await invalidateRelated();
          showToast("Đã lưu điểm kiểm tra.");
        }}
      />
      <VerificationModal
        open={verificationOpen}
        detail={detail}
        tenantSlug={tenant.slug}
        onClose={() => setVerificationOpen(false)}
        onSuccess={async (updated) => {
          queryClient.setQueryData(["session-operations", tenant.id, sessionId], updated);
          setVerificationOpen(false);
          await invalidateRelated();
          showToast("Đã xử lý buổi chờ xác nhận.");
        }}
      />
    </>
  );
};

const CheckInModal = ({
  open,
  detail,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  open: boolean;
  detail: SessionOperationsDetail;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: (detail: SessionOperationsDetail) => void | Promise<void>;
}) => {
  const form = useForm<CheckInForm>({
    resolver: zodResolver(checkInSchema),
    defaultValues: { onlineLink: "" },
  });
  const mutation = useMutation({
    mutationFn: (values: CheckInForm) =>
      teachingRepository.checkIn(
        tenantSlug,
        detail.id,
        detail.version,
        detail.mode === "ONLINE" ? values.onlineLink : null,
      ),
    onSuccess,
  });
  const submit = form.handleSubmit((values) => {
    if (detail.mode === "ONLINE" && !values.onlineLink) {
      form.setError("onlineLink", { message: "Buổi Online bắt buộc nhập link dạy." });
      return;
    }
    mutation.mutate(values);
  });
  return (
    <Modal
      open={open}
      title="Check-in buổi dạy"
      onClose={onClose}
      confirmLabel="Xác nhận check-in"
      onConfirm={() => void submit()}
      confirmLoading={mutation.isPending}
    >
      <div className="modal-form-stack">
        <p>Check-in ghi nhận thời điểm, IP và thiết bị. Buổi sẽ tự hoàn tất sau giờ kết thúc.</p>
        {detail.mode === "ONLINE" ? (
          <Input
            label="Link dạy Online"
            placeholder="https://meet.example.com/..."
            error={form.formState.errors.onlineLink?.message}
            {...form.register("onlineLink")}
          />
        ) : (
          <div className="schedule-notice">
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>
              <strong>Buổi học tại lớp</strong>
              <small>Không yêu cầu và không lưu link Online.</small>
            </span>
          </div>
        )}
        {mutation.isError ? (
          <p className="field-error" role="alert">
            {mutationMessage(mutation.error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

const TestResultModal = ({
  target,
  detail,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  target: { student: RosterStudent; result: TestResult | null } | null;
  detail: SessionOperationsDetail;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) => {
  const defaults = useMemo<TestForm>(
    () => ({
      testName: target?.result?.testName ?? "",
      score: target?.result?.score ?? 0,
      maxScore: target?.result?.maxScore ?? 10,
      testDate:
        target?.result?.testDate ??
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date()),
      comment: target?.result?.comment ?? "",
      version: target?.result?.version ?? 0,
    }),
    [target],
  );
  const form = useForm<TestForm>({ resolver: zodResolver(testSchema), values: defaults });
  const mutation = useMutation({
    mutationFn: (values: TestForm) => {
      if (!target) throw new Error("Missing target");
      const input: TestResultInput = values;
      return target.result
        ? teachingRepository.updateTestResult(
            tenantSlug,
            detail.id,
            target.student.studentId,
            target.result.id,
            input,
          )
        : teachingRepository.createTestResult(
            tenantSlug,
            detail.id,
            target.student.studentId,
            input,
          );
    },
    onSuccess,
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));
  return (
    <Modal
      open={Boolean(target)}
      title={`${target?.result ? "Sửa" : "Thêm"} điểm kiểm tra · ${target?.student.name ?? ""}`}
      onClose={onClose}
      confirmLabel="Lưu điểm"
      onConfirm={() => void submit()}
      confirmLoading={mutation.isPending}
    >
      <div className="modal-form-grid">
        <Input
          label="Tên bài kiểm tra"
          error={form.formState.errors.testName?.message}
          {...form.register("testName")}
        />
        <Input
          label="Ngày kiểm tra"
          type="date"
          error={form.formState.errors.testDate?.message}
          {...form.register("testDate")}
        />
        <Input
          label="Điểm đạt"
          type="number"
          step="0.1"
          error={form.formState.errors.score?.message}
          {...form.register("score", { valueAsNumber: true })}
        />
        <Input
          label="Điểm tối đa"
          type="number"
          step="0.1"
          error={form.formState.errors.maxScore?.message}
          {...form.register("maxScore", { valueAsNumber: true })}
        />
        <Textarea label="Nhận xét" rows={3} {...form.register("comment")} />
        {mutation.isError ? (
          <p className="field-error" role="alert">
            {mutationMessage(mutation.error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

const VerificationModal = ({
  open,
  detail,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  open: boolean;
  detail: SessionOperationsDetail;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: (detail: SessionOperationsDetail) => void | Promise<void>;
}) => {
  const form = useForm<VerificationForm>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { decision: "CONFIRM_TAUGHT", reason: "" },
  });
  const decision = useWatch({ control: form.control, name: "decision" });
  const mutation = useMutation({
    mutationFn: (values: VerificationForm) =>
      teachingRepository.decideVerification(
        tenantSlug,
        detail.id,
        values.decision,
        values.reason,
        detail.version,
      ),
    onSuccess,
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));
  return (
    <Modal
      open={open}
      title="Xử lý buổi thiếu check-in"
      onClose={onClose}
      confirmLabel={decision === "CONFIRM_TAUGHT" ? "Xác nhận đã dạy" : "Xác nhận hủy buổi"}
      onConfirm={() => void submit()}
      confirmLoading={mutation.isPending}
    >
      <div className="modal-form-stack">
        <Select label="Quyết định" {...form.register("decision")}>
          <option value="CONFIRM_TAUGHT">Xác nhận giáo viên đã dạy</option>
          <option value="CANCEL">Hủy buổi học</option>
        </Select>
        <Textarea
          label="Lý do"
          rows={4}
          error={form.formState.errors.reason?.message}
          {...form.register("reason")}
        />
        <div className={decision === "CANCEL" ? "session-error" : "schedule-notice"}>
          {decision === "CANCEL" ? (
            <AlertTriangle size={20} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={20} aria-hidden="true" />
          )}
          <span>
            <strong>
              {decision === "CANCEL"
                ? "Hủy sẽ không tạo lương"
                : "Xác nhận sẽ hoàn tất buổi và tạo lương"}
            </strong>
            <small>Quyết định được ghi audit cùng lý do.</small>
          </span>
        </div>
        {mutation.isError ? (
          <p className="field-error" role="alert">
            {mutationMessage(mutation.error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};
