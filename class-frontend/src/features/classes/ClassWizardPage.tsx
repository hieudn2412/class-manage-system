import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { classRepository } from "../../services/repositories/classRepository";
import {
  dateKeyFromIso,
  getTodayInBusinessTimezone,
  getWeekStart,
} from "../../shared/lib/calendar";
import { ApiError } from "../../shared/types/api";
import type {
  ClassDraftInput,
  SchedulePreview,
  SchedulePreviewSession,
  SessionScheduleOverride,
} from "../../shared/types/domain";
import { Button } from "../../shared/ui/Button";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { classDraftSchema, classPublishSchema, type ClassFormValues } from "./classFormSchema";
import { ClassInformationStep } from "./components/ClassInformationStep";
import { ClassWizardStepper } from "./components/ClassWizardStepper";
import { PreviewSessionOverrideModal } from "./components/PreviewSessionOverrideModal";
import { SchedulePreviewStep } from "./components/SchedulePreviewStep";
import { StudentSelectionStep } from "./components/StudentSelectionStep";
import { WeeklySlotsStep } from "./components/WeeklySlotsStep";

const defaultValues: ClassFormValues = {
  name: "",
  description: "",
  primaryTeacherId: "",
  startDate: getTodayInBusinessTimezone(),
  totalSessions: 24,
  tuitionAmount: 4_800_000,
  hourlyRate: 200_000,
  capacity: 20,
  defaultMode: "IN_PERSON",
  studentIds: [],
  patterns: [],
  overrides: [],
};

const inputFromRecord = (record: ClassDraftInput): ClassDraftInput => ({
  name: record.name,
  description: record.description,
  primaryTeacherId: record.primaryTeacherId,
  startDate: record.startDate,
  totalSessions: record.totalSessions,
  tuitionAmount: record.tuitionAmount,
  hourlyRate: record.hourlyRate,
  capacity: record.capacity,
  defaultMode: record.defaultMode,
  studentIds: record.studentIds,
  patterns: record.patterns,
  overrides: record.overrides,
});

const makeIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `request-${Date.now()}`;

export const ClassWizardPage = () => {
  const tenant = useTenant();
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [editingSession, setEditingSession] = useState<SchedulePreviewSession | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  const methods = useForm<ClassFormValues>({
    resolver: zodResolver(classDraftSchema),
    defaultValues,
    mode: "onBlur",
  });
  const {
    getValues,
    reset,
    setError,
    setValue,
    trigger,
    control,
    formState: { errors, isDirty },
  } = methods;
  const watchedValues = useWatch({ control });
  const currentInputKey = JSON.stringify(watchedValues);
  const [previewInputKey, setPreviewInputKey] = useState("");
  const currentPreview = previewInputKey === currentInputKey ? preview : null;

  const optionsQuery = useQuery({
    queryKey: ["class-scheduling-options", tenant.id],
    queryFn: () => classRepository.getSchedulingOptions(tenant.slug),
  });
  const draftQuery = useQuery({
    queryKey: ["class-draft", tenant.id, classId],
    queryFn: () => classRepository.getDraft(tenant.slug, classId ?? ""),
    enabled: Boolean(classId),
    retry: false,
  });

  useEffect(() => {
    if (!draftQuery.data) return;
    reset(inputFromRecord(draftQuery.data));
  }, [draftQuery.data, reset]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const saveDraftMutation = useMutation({
    mutationFn: async (input: ClassDraftInput) =>
      classId
        ? classRepository.updateDraft(tenant.slug, classId, input)
        : classRepository.createDraft(tenant.slug, input),
    onSuccess: (record) => {
      reset(inputFromRecord(record));
      showToast(`Đã lưu lớp nháp ${record.code}. Chưa phát thông báo hoặc học phí.`);
      if (!classId) {
        void navigate(`/t/${tenant.slug}/app/classes/${record.id}/edit`, { replace: true });
      }
      void queryClient.invalidateQueries({ queryKey: ["classes", tenant.id] });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (input: ClassDraftInput) => classRepository.previewSchedule(tenant.slug, input),
    onSuccess: (result, input) => {
      setPreview(result);
      setPreviewInputKey(JSON.stringify(input));
      setWarningsAcknowledged(false);
      setStep(4);
    },
    onError: (caught) => {
      setError("root", {
        message:
          caught instanceof ApiError
            ? caught.message
            : "Không thể tạo bản xem trước. Dữ liệu đã nhập vẫn được giữ.",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (input: ClassDraftInput) => {
      const draft = classId
        ? await classRepository.updateDraft(tenant.slug, classId, input)
        : await classRepository.createDraft(tenant.slug, input);
      try {
        return await classRepository.publishClass(
          tenant.slug,
          draft.id,
          {
            previewId: currentPreview?.previewId ?? "",
            acknowledgedWarningIds:
              currentPreview?.conflicts
                .filter((conflict) => conflict.severity === "WARNING")
                .map((conflict) => conflict.id) ?? [],
          },
          makeIdempotencyKey(),
        );
      } catch (caught) {
        if (!classId) {
          void navigate(`/t/${tenant.slug}/app/classes/${draft.id}/edit`, { replace: true });
        }
        throw caught;
      }
    },
    onSuccess: () => {
      setPublishConfirmOpen(false);
      showToast("Đã công bố lớp. Lịch giáo viên và thời khóa biểu đã được cập nhật.");
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["management-schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule"] });
      const firstSessionDate = currentPreview?.sessions[0]?.startAt
        ? dateKeyFromIso(currentPreview.sessions[0].startAt)
        : getValues("startDate");
      void navigate(`/t/${tenant.slug}/app/schedule?week=${getWeekStart(firstSessionDate)}`, {
        replace: true,
      });
    },
    onError: (caught) => {
      setPublishConfirmOpen(false);
      setError("root", {
        message:
          caught instanceof ApiError
            ? caught.message
            : "Không thể công bố lớp. Bản nháp và dữ liệu form vẫn được giữ.",
      });
      if (
        caught instanceof ApiError &&
        ["PREVIEW_STALE", "SCHEDULE_CONFLICT"].includes(caught.code)
      ) {
        setPreview(null);
        setPreviewInputKey("");
        setWarningsAcknowledged(false);
      }
    },
  });

  const validatePublishInput = (): ClassDraftInput | null => {
    const result = classPublishSchema.safeParse(getValues());
    if (result.success) return result.data;
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".") as FieldPath<ClassFormValues>;
      if (path) setError(path, { message: issue.message });
    });
    setError("root", { message: "Hãy hoàn thiện các trường bắt buộc trước khi xem trước." });
    const firstPath = result.error.issues[0]?.path[0];
    if (firstPath === "patterns") setStep(3);
    else setStep(1);
    return null;
  };

  const handleSaveDraft = async () => {
    const informationValid = await trigger([
      "name",
      "primaryTeacherId",
      "startDate",
      "totalSessions",
      "tuitionAmount",
      "hourlyRate",
      "capacity",
    ]);
    if (!informationValid) {
      setStep(1);
      return;
    }
    saveDraftMutation.mutate(getValues());
  };

  const handlePreview = () => {
    const input = validatePublishInput();
    if (input) previewMutation.mutate(input);
  };

  const handleApplyOverride = (override: SessionScheduleOverride) => {
    const current = getValues();
    const overrides = [
      ...current.overrides.filter((item) => item.sessionKey !== override.sessionKey),
      override,
    ];
    const next = { ...current, overrides };
    setValue("overrides", overrides, { shouldDirty: true, shouldValidate: true });
    setEditingSession(null);
    previewMutation.mutate(next);
  };

  const handleNext = async () => {
    if (step === 1) {
      const valid = await trigger([
        "name",
        "primaryTeacherId",
        "startDate",
        "totalSessions",
        "tuitionAmount",
        "hourlyRate",
        "capacity",
      ]);
      if (!valid) return;
    }
    if (step === 3) {
      handlePreview();
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  };

  if (optionsQuery.isPending || (classId && draftQuery.isPending)) return <PageSkeleton />;
  if (optionsQuery.isError || !optionsQuery.data || (classId && draftQuery.isError)) {
    return (
      <StatePanel
        kind="error"
        title="Không thể mở trình tạo lớp"
        description="Không tải được dữ liệu giáo viên, phòng hoặc lớp nháp. Hãy thử lại."
        actionLabel="Thử lại"
        onAction={() => {
          void optionsQuery.refetch();
          if (classId) void draftQuery.refetch();
        }}
      />
    );
  }

  const warningCount =
    currentPreview?.conflicts.filter((conflict) => conflict.severity === "WARNING").length ?? 0;

  return (
    <FormProvider {...methods}>
      <Link className="back-link" to={`/t/${tenant.slug}/app/classes`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Danh sách lớp
      </Link>
      <PageHeader
        eyebrow="WF-05 · FR-CLS-001–006"
        title={classId ? "Tiếp tục thiết lập lớp nháp" : "Tạo lớp học mới"}
        subtitle="Khóa dữ liệu nền, học sinh, lịch lặp và bản xem trước trước khi công bố."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleSaveDraft()}
            loading={saveDraftMutation.isPending}
          >
            <Save size={18} aria-hidden="true" />
            Lưu nháp
          </Button>
        }
      />
      {errors.root?.message ? (
        <div className="form-alert mb-5" role="alert">
          <AlertTriangle size={19} aria-hidden="true" />
          <span>{errors.root.message}</span>
        </div>
      ) : null}
      <div className="wizard-layout">
        <ClassWizardStepper currentStep={step} onStepChange={setStep} />
        <div className="wizard-panel">
          {step === 1 ? <ClassInformationStep options={optionsQuery.data} /> : null}
          {step === 2 ? <StudentSelectionStep /> : null}
          {step === 3 ? <WeeklySlotsStep options={optionsQuery.data} /> : null}
          {step === 4 ? (
            <SchedulePreviewStep
              preview={currentPreview}
              previewLoading={previewMutation.isPending}
              publishing={publishMutation.isPending}
              acknowledged={warningsAcknowledged}
              onAcknowledgedChange={setWarningsAcknowledged}
              onPreview={handlePreview}
              onPublish={() => setPublishConfirmOpen(true)}
              onEditPatterns={() => setStep(3)}
              onEditSession={setEditingSession}
            />
          ) : null}
          {step < 4 ? (
            <div className="wizard-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                <ArrowLeft size={17} aria-hidden="true" />
                Quay lại
              </Button>
              <Button type="button" onClick={() => void handleNext()}>
                {step === 3 ? "Xem trước lịch" : "Tiếp tục"}
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {editingSession ? (
        <PreviewSessionOverrideModal
          key={editingSession.key}
          session={editingSession}
          rooms={optionsQuery.data.rooms}
          onClose={() => setEditingSession(null)}
          onApply={handleApplyOverride}
        />
      ) : null}
      <Modal
        open={publishConfirmOpen}
        title="Xác nhận công bố lớp"
        onClose={() => setPublishConfirmOpen(false)}
        confirmLabel="Công bố lớp"
        onConfirm={() => publishMutation.mutate(getValues())}
      >
        <div className="confirmation-summary">
          <p>
            Hệ thống sẽ tạo <strong>{currentPreview?.sessions.length ?? 0} buổi học</strong>,{" "}
            <strong>{getValues("studentIds").length} enrollment</strong> và cùng số khoản học phí
            chưa nộp.
          </p>
          {warningCount > 0 ? (
            <p>{warningCount} cảnh báo trùng lịch học sinh đã được bạn xác nhận.</p>
          ) : null}
          <p>Giáo viên và học sinh liên quan sẽ nhận thông báo sau khi giao dịch thành công.</p>
        </div>
      </Modal>
    </FormProvider>
  );
};
