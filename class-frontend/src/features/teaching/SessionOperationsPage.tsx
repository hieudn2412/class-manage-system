import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPlus,
  FileCheck2,
  FileWarning,
  Link2,
  LockKeyhole,
  MonitorUp,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  UserCheck,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { scheduleRepository } from "../../services/repositories/scheduleRepository";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { formatDate, formatDateTime } from "../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";
import { ApiError } from "../../shared/types/api";
import type {
  AttendanceStatus,
  SessionTestInput,
  SessionTestUpdateInput,
  SessionOperationsDetail,
} from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input, Select, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { HomeworkCreateModal } from "../content/HomeworkCreateModal";
import { RescheduleModal } from "../schedules/components/RescheduleModal";
import { SessionMutationModal } from "../schedules/components/SessionMutationModal";
import { UnconfirmSessionModal } from "./UnconfirmSessionModal";
import { CompletionCorrectionModal } from "./CompletionCorrectionModal";

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^https?:\/\/\S+$/i.test(value),
    "Đường dẫn chưa hợp lệ. Vui lòng kiểm tra và nhập lại.",
  );

const recordSchema = z.object({
  lessonName: z.string(),
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
      "Đường dẫn học trực tuyến chưa hợp lệ.",
    ),
});
type CheckInForm = z.infer<typeof checkInSchema>;

const testDefinitionSchema = z.object({
  testName: z.string().trim().min(1, "Nhập tên bài kiểm tra."),
  maxScore: z.number().positive("Điểm tối đa phải lớn hơn 0."),
  testDate: z.string().min(1, "Chọn ngày kiểm tra."),
  comment: z.string(),
});
type TestDefinitionForm = z.infer<typeof testDefinitionSchema>;

const sessionTestSchema = testDefinitionSchema
  .extend({
    version: z.number(),
    rosterRevision: z.string(),
    results: z.array(
      z.object({
        studentId: z.string(),
        score: z.number().min(0, "Điểm không được âm.").nullable(),
        comment: z.string(),
        version: z.number(),
      }),
    ),
  })
  .superRefine((value, context) => {
    value.results.forEach((result, index) => {
      if (result.score !== null && result.score > value.maxScore) {
        context.addIssue({
          code: "custom",
          path: ["results", index, "score"],
          message: `Điểm không được vượt quá ${value.maxScore}.`,
        });
      }
    });
  });
type SessionTestForm = z.infer<typeof sessionTestSchema>;

const verificationSchema = z
  .object({
    decision: z.enum(["CONFIRM_TAUGHT", "CANCEL"]),
    reason: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.decision === "CANCEL" && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Vui lòng nhập lý do hủy buổi.",
      });
    }
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

const localDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

const toTestDefaults = (detail: SessionOperationsDetail): SessionTestForm => ({
  testName: detail.sessionTest?.testName ?? "",
  maxScore: detail.sessionTest?.maxScore ?? 10,
  testDate: detail.sessionTest?.testDate ?? localDate(),
  comment: detail.sessionTest?.comment ?? "",
  version: detail.sessionTest?.version ?? 0,
  rosterRevision: detail.rosterRevision,
  results: detail.students.map((student) => ({
    studentId: student.studentId,
    score: student.testResult?.score ?? null,
    comment: student.testResult?.comment ?? "",
    version: student.testResult?.version ?? 0,
  })),
});

const stateLabel: Record<string, string> = {
  TOO_EARLY: "Chưa đến giờ xác nhận",
  OPEN: "Có thể xác nhận",
  CHECKED_IN: "Đã xác nhận",
  WINDOW_CLOSED: "Đã hết thời gian xác nhận",
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
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const verificationRequested = searchParams.get("action") === "verify";
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const { showToast } = useToast();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [homeworkOpen, setHomeworkOpen] = useState(false);
  const [testEditorOpen, setTestEditorOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [unconfirmOpen, setUnconfirmOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [sessionMutationAction, setSessionMutationAction] = useState<
    "SUBSTITUTE_TEACHER" | "CANCEL_SESSION" | "CREATE_MAKEUP" | null
  >(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["session-operations", tenant.id, sessionId],
    queryFn: () => teachingRepository.getSession(tenant.slug, sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: (current) => (current.state.data?.status === "IN_PROGRESS" ? 30_000 : false),
  });
  const detail = query.data;
  const optionsQuery = useQuery({
    queryKey: ["schedule-options", tenant.id],
    queryFn: () => scheduleRepository.getOptions(tenant.slug),
    enabled: Boolean(sessionMutationAction),
  });
  const recordForm = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: { lessonName: "", recordUrl: "", students: [] },
  });
  const { fields } = useFieldArray({ control: recordForm.control, name: "students" });
  const testForm = useForm<SessionTestForm>({
    resolver: zodResolver(sessionTestSchema),
    defaultValues: {
      testName: "",
      maxScore: 10,
      testDate: localDate(),
      comment: "",
      version: 0,
      rosterRevision: "",
      results: [],
    },
  });

  useEffect(() => {
    if (detail) {
      recordForm.reset(toRecordDefaults(detail));
      testForm.reset(toTestDefaults(detail));
    }
  }, [detail, recordForm, testForm]);

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
          lessonContent: detail.lessonReport.lessonContent,
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

  const applyUpdatedDetail = async (updated: SessionOperationsDetail, message: string) => {
    queryClient.setQueryData(["session-operations", tenant.id, sessionId], updated);
    recordForm.reset(toRecordDefaults(updated));
    testForm.reset(toTestDefaults(updated));
    setTestEditorOpen(false);
    setSaveError(null);
    await invalidateRelated();
    showToast(message);
  };

  const createTestMutation = useMutation({
    mutationFn: (values: SessionTestInput) =>
      teachingRepository.createSessionTest(tenant.slug, sessionId, values),
    onSuccess: (updated) => applyUpdatedDetail(updated, "Đã tạo bài kiểm tra cho buổi học."),
  });

  const updateTestMutation = useMutation({
    mutationFn: (values: SessionTestUpdateInput) => {
      if (!detail?.sessionTest) throw new Error("Missing session test");
      return teachingRepository.updateSessionTest(
        tenant.slug,
        sessionId,
        detail.sessionTest.id,
        values,
      );
    },
    onSuccess: (updated) => applyUpdatedDetail(updated, "Đã lưu bài kiểm tra và điểm học sinh."),
  });

  const submitRecordAndTest = () => {
    const recordValues = recordForm.getValues();
    if (!detail?.sessionTest || !testForm.formState.isDirty) {
      void recordForm.handleSubmit((values) => saveMutation.mutate(values))();
      return;
    }
    void testForm.handleSubmit(async (testValues) => {
      try {
        await updateTestMutation.mutateAsync(testValues);
        saveMutation.mutate(recordValues);
      } catch {
        // The mutation renders the server error and keeps the edited form values.
      }
    })();
  };

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
  const canCorrectCompletion = Boolean(
    session && hasPermission(session.user.roles, PERMISSIONS.MANAGE_SESSION_SCHEDULE),
  );
  const hasManagementActions =
    (detail.canVerify && detail.status === "PENDING_CONFIRMATION") ||
    (detail.status === "COMPLETED" && canCorrectCompletion) ||
    detail.allowedActions.includes("SUBSTITUTE_TEACHER") ||
    detail.allowedActions.includes("CANCEL_SESSION") ||
    detail.allowedActions.includes("CREATE_MAKEUP") ||
    detail.allowedActions.includes("RESCHEDULE_SESSION");
  const closeVerification = () => {
    setVerificationOpen(false);
    if (verificationRequested) {
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  };
  return (
    <div className="teaching-page session-operations-page">
      <div className="session-page-toolbar">
        <Link
          className="back-link"
          to={
            detail.actualTeacher
              ? `/t/${tenant.slug}/app/my-classes/${detail.classId}`
              : `/t/${tenant.slug}/app/schedule`
          }
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Quay lại lịch sử buổi
        </Link>
        {hasManagementActions ? (
          <div className="session-management-actions" aria-label="Thao tác quản lý buổi học">
            {detail.canVerify && detail.status === "PENDING_CONFIRMATION" ? (
              <Button onClick={() => setVerificationOpen(true)}>
                <ClipboardCheck size={18} aria-hidden="true" />
                Xử lý xác nhận
              </Button>
            ) : null}
            {detail.status === "COMPLETED" && canCorrectCompletion ? (
              <>
                <Button variant="secondary" onClick={() => setCorrectionOpen(true)}>
                  <Pencil size={18} aria-hidden="true" />
                  Sửa dữ liệu hoàn tất
                </Button>
                <Button variant="secondary" onClick={() => setUnconfirmOpen(true)}>
                  <RotateCcw size={18} aria-hidden="true" />
                  Hủy xác nhận
                </Button>
              </>
            ) : null}
            {detail.allowedActions.includes("SUBSTITUTE_TEACHER") ? (
              <Button
                variant="secondary"
                onClick={() => setSessionMutationAction("SUBSTITUTE_TEACHER")}
              >
                <UserRoundCheck size={18} aria-hidden="true" />
                Thay giáo viên
              </Button>
            ) : null}
            {detail.allowedActions.includes("CANCEL_SESSION") ? (
              <Button variant="danger" onClick={() => setSessionMutationAction("CANCEL_SESSION")}>
                <XCircle size={18} aria-hidden="true" />
                Hủy / xếp bù
              </Button>
            ) : null}
            {detail.allowedActions.includes("CREATE_MAKEUP") ? (
              <Button variant="secondary" onClick={() => setSessionMutationAction("CREATE_MAKEUP")}>
                <CalendarPlus size={18} aria-hidden="true" />
                Tạo buổi bù
              </Button>
            ) : null}
            {detail.allowedActions.includes("RESCHEDULE_SESSION") ? (
              <Button variant="secondary" onClick={() => setRescheduleOpen(true)}>
                <CalendarRange size={18} aria-hidden="true" />
                Dời lịch
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <section className="panel session-hero" aria-labelledby="session-title">
        <div className="session-hero-copy">
          <h1 className="page-title" id="session-title">
            {detail.className} <span>· Buổi {detail.ordinal}</span>
          </h1>
          <div className="session-hero-meta">
            <span>
              <CalendarClock size={17} aria-hidden="true" />
              {formatDateTime(detail.startAt)}–
              {new Intl.DateTimeFormat("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(new Date(detail.endAt))}
            </span>
            <span>
              <UserCheck size={17} aria-hidden="true" />
              {detail.actualTeacherName}
            </span>
          </div>
        </div>
        <div className="session-hero-actions">
          <div className="session-hero-state">
            {detail.homework ? (
              <Badge tone="info">
                <ClipboardCheck size={15} aria-hidden="true" />
                Bài tập về nhà
              </Badge>
            ) : null}
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
          </div>
          {detail.checkInState === "OPEN" && detail.canEdit ? (
            <Button onClick={() => setCheckInOpen(true)}>
              <UserCheck size={18} aria-hidden="true" />
              Xác nhận buổi dạy
            </Button>
          ) : null}
        </div>
      </section>

      {detail.substitution || detail.makeup || detail.cancellationReason ? (
        <div className="session-chain-status" role="status">
          {detail.substitution ? <Badge tone="info">Dạy thay</Badge> : null}
          {detail.makeup ? <Badge tone="warning">Buổi bù</Badge> : null}
          {detail.cancellationReason ? <span>Lý do hủy: {detail.cancellationReason}</span> : null}
        </div>
      ) : null}

      <section className="session-overview-grid" aria-label="Thông tin buổi học">
        <article className="panel session-overview-card">
          <span className="session-overview-icon">
            <MonitorUp size={20} aria-hidden="true" />
          </span>
          <div>
            <small>Hình thức</small>
            <strong>
              {isOnline ? "Trực tuyến" : (detail.roomName ?? "Tại lớp · chưa có phòng")}
            </strong>
            {detail.checkIn?.onlineLink ? (
              <a href={detail.checkIn.onlineLink} target="_blank" rel="noreferrer">
                <Link2 size={16} aria-hidden="true" />
                Mở link buổi dạy
              </a>
            ) : null}
          </div>
        </article>
        <article className="panel session-overview-card">
          <span className="session-overview-icon">
            <UsersRound size={20} aria-hidden="true" />
          </span>
          <div>
            <small>Học sinh tham gia</small>
            <strong>
              {detail.participatedStudents}/{detail.students.length}
            </strong>
            <span>{detail.rosterFrozen ? "Danh sách đã khóa" : "Theo danh sách lớp hiện tại"}</span>
          </div>
        </article>
        <article className="panel session-overview-card">
          <span className="session-overview-icon">
            <FileCheck2 size={20} aria-hidden="true" />
          </span>
          <div>
            <small>Hồ sơ buổi học</small>
            <strong>{detail.missingDocumentation ? "Còn thiếu" : "Đã đầy đủ"}</strong>
            <span>
              {detail.checkIn
                ? `Đã xác nhận lúc ${formatDateTime(detail.checkIn.checkedInAt)}`
                : "Chưa xác nhận buổi dạy"}
            </span>
          </div>
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
            <strong>Buổi đã hoàn tất nhưng còn thiếu điểm danh hoặc bản ghi buổi học</strong>
            <small>Bạn vẫn có thể bổ sung để xóa cờ theo dõi.</small>
          </span>
        </div>
      ) : null}
      {saveError || updateTestMutation.isError ? (
        <div className="session-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{saveError ?? mutationMessage(updateTestMutation.error)}</span>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            Tải bản mới
          </Button>
        </div>
      ) : null}

      <div className="session-record-form">
        <section className="panel-flat section-panel" aria-labelledby="lesson-report-title">
          <div className="section-heading-row">
            <span className="section-title-block">
              <span className="section-title-icon">
                <BookOpenCheck size={20} aria-hidden="true" />
              </span>
              <span>
                <h2 className="section-title" id="lesson-report-title">
                  Nội dung đã dạy
                </h2>
              </span>
            </span>
          </div>
          <div className="lesson-form-grid">
            <Input
              label="Tên bài học"
              disabled={!detail.canEdit}
              {...recordForm.register("lessonName")}
            />
            <Input
              label="Đường dẫn bản ghi buổi học"
              placeholder="https://youtube.com/..."
              disabled={!detail.canEdit}
              error={recordForm.formState.errors.recordUrl?.message}
              {...recordForm.register("recordUrl")}
            />
          </div>
        </section>

        <section className="panel-flat section-panel" aria-labelledby="roster-title">
          <div className="section-heading-row">
            <span className="section-title-block">
              <span className="section-title-icon">
                <UsersRound size={20} aria-hidden="true" />
              </span>
              <span>
                <h2 className="section-title" id="roster-title">
                  Điểm danh và nhận xét học sinh
                </h2>
              </span>
            </span>
            <div className="roster-heading-actions">
              <Badge tone="neutral">{fields.length} học sinh</Badge>
              <div className="roster-action-buttons">
                {detail.homework ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void navigate(`/t/${tenant.slug}/app/homeworks/${detail.homework?.id}`)
                    }
                  >
                    <ClipboardCheck size={16} aria-hidden="true" />
                    Xem và sửa bài tập
                  </Button>
                ) : detail.canCreateHomework ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!detail.canEdit}
                    onClick={() => setHomeworkOpen(true)}
                  >
                    <ClipboardPlus size={16} aria-hidden="true" />
                    Giao bài tập
                  </Button>
                ) : null}
                {detail.sessionTest ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!detail.canEdit}
                    onClick={() => setTestEditorOpen(true)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Sửa bài kiểm tra
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={!detail.canEdit || fields.length === 0}
                    onClick={() => setTestEditorOpen(true)}
                  >
                    <ClipboardPlus size={17} aria-hidden="true" />
                    Tạo bài kiểm tra
                  </Button>
                )}
              </div>
            </div>
          </div>
          {detail.sessionTest ? (
            <div className="session-test-summary" role="status">
              <span className="section-title-icon">
                <ClipboardCheck size={19} aria-hidden="true" />
              </span>
              <span>
                <small>Bài kiểm tra của buổi</small>
                <strong>{detail.sessionTest.testName}</strong>
                <span>
                  {formatDate(detail.sessionTest.testDate)} · Tối đa {detail.sessionTest.maxScore}{" "}
                  điểm
                </span>
              </span>
              <p>{detail.sessionTest.comment || "Chưa có nhận xét chung cho bài kiểm tra."}</p>
            </div>
          ) : null}
          {fields.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Buổi học chưa có học sinh"
              description="Quản lý cần thêm học sinh vào lớp; giáo viên không thể thay đổi danh sách lớp."
            />
          ) : (
            <div className={`student-record-table${detail.sessionTest ? " has-session-test" : ""}`}>
              <div className="student-record-table-head" aria-hidden="true">
                <span>Học sinh</span>
                <span>Trạng thái đi học</span>
                <span>Đánh giá buổi học</span>
                {detail.sessionTest ? <span>Điểm và nhận xét bài kiểm tra</span> : null}
              </div>
              <div className="student-record-list">
                {fields.map((field, index) => {
                  return (
                    <article
                      className={`student-record-card${detail.sessionTest ? " has-session-test" : ""}`}
                      key={field.id}
                    >
                      <div className="student-record-identity">
                        <span className="student-record-avatar" aria-hidden="true">
                          {field.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span>
                          <h3>{field.name}</h3>
                        </span>
                      </div>
                      <div className="student-record-attendance">
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
                      </div>
                      <div className="student-session-comment">
                        <Textarea
                          label="Đánh giá buổi học"
                          rows={2}
                          placeholder="Mức độ tập trung, tiến bộ hoặc nội dung cần lưu ý..."
                          disabled={!detail.canEdit}
                          {...recordForm.register(`students.${index}.sessionComment`)}
                        />
                      </div>
                      {detail.sessionTest ? (
                        <div className="student-test-fields">
                          <Input
                            label={`Điểm / ${detail.sessionTest.maxScore}`}
                            type="number"
                            min="0"
                            max={detail.sessionTest.maxScore}
                            step="0.1"
                            placeholder="Chưa nhập"
                            disabled={!detail.canEdit}
                            error={testForm.formState.errors.results?.[index]?.score?.message}
                            {...testForm.register(`results.${index}.score`, {
                              setValueAs: (value) => (value === "" ? null : Number(value)),
                            })}
                          />
                          <Textarea
                            label="Nhận xét bài kiểm tra"
                            rows={2}
                            placeholder="Nhận xét riêng về kết quả bài kiểm tra..."
                            disabled={!detail.canEdit}
                            {...testForm.register(`results.${index}.comment`)}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        {detail.canEdit ? (
          <div className="sticky-form-actions">
            <span>
              {recordForm.formState.isDirty || testForm.formState.isDirty
                ? "Có thay đổi chưa lưu"
                : "Dữ liệu đã đồng bộ"}
            </span>
            <div>
              {detail.sessionTest ? (
                <Button
                  type="button"
                  variant="secondary"
                  loading={updateTestMutation.isPending}
                  onClick={() =>
                    void testForm.handleSubmit((values) => updateTestMutation.mutate(values))()
                  }
                >
                  <ClipboardCheck size={18} aria-hidden="true" />
                  Lưu điểm kiểm tra
                </Button>
              ) : null}
              <Button
                type="button"
                loading={saveMutation.isPending || updateTestMutation.isPending}
                onClick={submitRecordAndTest}
              >
                <Save size={18} aria-hidden="true" />
                {detail.sessionTest && testForm.formState.isDirty
                  ? "Lưu hồ sơ và điểm"
                  : "Lưu hồ sơ buổi"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <CheckInModal
        open={checkInOpen}
        detail={detail}
        tenantSlug={tenant.slug}
        onClose={() => setCheckInOpen(false)}
        onSuccess={async (updated) => {
          queryClient.setQueryData(["session-operations", tenant.id, sessionId], updated);
          setCheckInOpen(false);
          await invalidateRelated();
          showToast("Đã xác nhận buổi dạy.");
        }}
      />
      <HomeworkCreateModal
        tenantSlug={tenant.slug}
        classId={detail.classId}
        className={detail.className}
        sessionId={detail.id}
        sessionOrdinal={detail.ordinal}
        students={detail.students.map((student) => ({
          studentId: student.studentId,
          code: student.code,
          name: student.name,
        }))}
        open={homeworkOpen}
        onClose={() => setHomeworkOpen(false)}
        onCreated={async (homework) => {
          await queryClient.invalidateQueries({
            queryKey: ["class-homeworks", tenant.slug, detail.classId],
          });
          await queryClient.invalidateQueries({
            queryKey: ["session-operations", tenant.id, sessionId],
          });
          void navigate(`/t/${tenant.slug}/app/homeworks/${homework.id}`);
        }}
        onExisting={(homeworkId) => {
          void navigate(`/t/${tenant.slug}/app/homeworks/${homeworkId}`);
        }}
      />
      <SessionTestEditorModal
        open={testEditorOpen}
        detail={detail}
        onClose={() => setTestEditorOpen(false)}
        loading={createTestMutation.isPending || updateTestMutation.isPending}
        error={
          createTestMutation.isError
            ? mutationMessage(createTestMutation.error)
            : updateTestMutation.isError
              ? mutationMessage(updateTestMutation.error)
              : null
        }
        onSubmit={(values) => {
          if (detail.sessionTest) {
            updateTestMutation.mutate({ ...testForm.getValues(), ...values });
          } else {
            createTestMutation.mutate(values);
          }
        }}
      />
      <VerificationModal
        open={
          verificationOpen ||
          (verificationRequested && detail.canVerify && detail.status === "PENDING_CONFIRMATION")
        }
        detail={detail}
        tenantSlug={tenant.slug}
        onClose={closeVerification}
        onSuccess={async (updated) => {
          queryClient.setQueryData(["session-operations", tenant.id, sessionId], updated);
          closeVerification();
          await invalidateRelated();
          showToast("Đã xử lý buổi chờ xác nhận.");
        }}
      />
      {sessionMutationAction && optionsQuery.data ? (
        <SessionMutationModal
          key={`${sessionMutationAction}-${detail.id}-${detail.version}`}
          action={sessionMutationAction}
          session={{
            id: detail.id,
            className: detail.className,
            classCode: detail.classCode,
            ordinal: detail.ordinal,
            startAt: detail.startAt,
            endAt: detail.endAt,
            actualTeacherId: detail.actualTeacherId,
            actualTeacherName: detail.actualTeacherName,
            mode: detail.mode,
            roomId: detail.roomId,
            version: detail.version,
          }}
          options={optionsQuery.data}
          onClose={() => setSessionMutationAction(null)}
          onSaved={() => {
            setSessionMutationAction(null);
            void invalidateRelated();
          }}
        />
      ) : null}
      {correctionOpen ? (
        <CompletionCorrectionModal
          key={`${detail.id}-${detail.version}`}
          detail={detail}
          tenantSlug={tenant.slug}
          onClose={() => setCorrectionOpen(false)}
          onSaved={async () => {
            setCorrectionOpen(false);
            await invalidateRelated();
            showToast("Đã sửa buổi và tính lại lương.");
          }}
        />
      ) : null}
      {unconfirmOpen ? (
        <UnconfirmSessionModal
          key={`unconfirm-${detail.id}-${detail.version}`}
          open={unconfirmOpen}
          session={{
            id: detail.id,
            className: detail.className,
            classCode: detail.classCode,
            ordinal: detail.ordinal,
            version: detail.version,
          }}
          tenantSlug={tenant.slug}
          onClose={() => setUnconfirmOpen(false)}
          onSuccess={async (updated) => {
            setUnconfirmOpen(false);
            await applyUpdatedDetail(updated, "Đã hủy xác nhận buổi học thành công.");
          }}
        />
      ) : null}
      {rescheduleOpen ? (
        <RescheduleModal
          key={`reschedule-${detail.id}-${detail.version}`}
          session={{
            id: detail.id,
            className: detail.className,
            classCode: detail.classCode,
            ordinal: detail.ordinal,
            startAt: detail.startAt,
            endAt: detail.endAt,
            version: detail.version,
          }}
          onClose={() => setRescheduleOpen(false)}
          onSaved={async () => {
            setRescheduleOpen(false);
            await invalidateRelated();
            showToast("Đã dời lịch các buổi học thành công.");
          }}
        />
      ) : null}
    </div>
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
      form.setError("onlineLink", { message: "Vui lòng nhập đường dẫn học trực tuyến." });
      return;
    }
    mutation.mutate(values);
  });
  return (
    <Modal
      open={open}
      title="Xác nhận buổi dạy"
      onClose={onClose}
      confirmLabel="Xác nhận buổi dạy"
      confirmVariant="accent"
      onConfirm={() => void submit()}
      confirmLoading={mutation.isPending}
    >
      <div className="modal-form-stack">
        <p>
          Hệ thống sẽ ghi nhận thời điểm và thiết bị xác nhận. Buổi học tự hoàn tất sau giờ kết
          thúc.
        </p>
        {detail.mode === "ONLINE" ? (
          <Input
            label="Đường dẫn học trực tuyến"
            placeholder="https://meet.example.com/..."
            error={form.formState.errors.onlineLink?.message}
            {...form.register("onlineLink")}
          />
        ) : (
          <div className="schedule-notice">
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>
              <strong>Buổi học tại lớp</strong>
              <small>Buổi học tại lớp không cần đường dẫn trực tuyến.</small>
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

const SessionTestEditorModal = ({
  open,
  detail,
  onClose,
  onSubmit,
  loading,
  error,
}: {
  open: boolean;
  detail: SessionOperationsDetail;
  onClose: () => void;
  onSubmit: (values: TestDefinitionForm) => void;
  loading: boolean;
  error: string | null;
}) => {
  const defaults = useMemo<TestDefinitionForm>(
    () => ({
      testName: detail.sessionTest?.testName ?? "",
      maxScore: detail.sessionTest?.maxScore ?? 10,
      testDate: detail.sessionTest?.testDate ?? localDate(),
      comment: detail.sessionTest?.comment ?? "",
    }),
    [detail.sessionTest],
  );
  const form = useForm<TestDefinitionForm>({
    resolver: zodResolver(testDefinitionSchema),
    values: defaults,
  });
  const submit = form.handleSubmit(onSubmit);
  return (
    <Modal
      open={open}
      title={detail.sessionTest ? "Sửa bài kiểm tra của buổi" : "Tạo bài kiểm tra cho buổi"}
      onClose={onClose}
      confirmLabel={detail.sessionTest ? "Lưu thông tin bài kiểm tra" : "Tạo bài kiểm tra"}
      onConfirm={() => void submit()}
      confirmLoading={loading}
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
          label="Điểm tối đa"
          type="number"
          step="0.1"
          error={form.formState.errors.maxScore?.message}
          {...form.register("maxScore", { valueAsNumber: true })}
        />
        <Textarea
          label="Nhận xét chung bài kiểm tra"
          rows={4}
          placeholder="Mục tiêu, phạm vi hoặc lưu ý chung của bài kiểm tra..."
          {...form.register("comment")}
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
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
      title="Xử lý buổi chưa được xác nhận"
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
        {decision === "CANCEL" ? (
          <Textarea
            label="Lý do hủy buổi"
            rows={4}
            error={form.formState.errors.reason?.message}
            {...form.register("reason")}
          />
        ) : null}
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
            <small>
              {decision === "CANCEL"
                ? "Quyết định và lý do hủy sẽ được lưu trong lịch sử thay đổi."
                : "Buổi học sẽ được hoàn tất và ghi nhận vào lịch sử thay đổi."}
            </small>
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
