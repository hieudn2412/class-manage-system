import { apiRequest } from "../api/apiClient";
import type {
  ApplySessionScheduleInput,
  ClassSchedulingOptions,
  ApplySubstitutionInput,
  CancelSessionInput,
  CreateMakeupInput,
  MakeupPreviewInput,
  SchedulePreview,
  SessionSchedulePreviewInput,
  SessionMutationResult,
  SubstitutionPreviewInput,
  WeekSchedule,
} from "../../shared/types/domain";

export interface ManagementScheduleParams {
  weekStart: string;
  teacherId: string;
  roomId: string;
}

export interface ScheduleRepository {
  getManagementSchedule(
    tenantSlug: string,
    params: ManagementScheduleParams,
  ): Promise<WeekSchedule>;
  getOwnSchedule(tenantSlug: string, weekStart: string): Promise<WeekSchedule>;
  getOptions(tenantSlug: string): Promise<ClassSchedulingOptions>;
  previewSessionSchedule(
    tenantSlug: string,
    sessionId: string,
    input: SessionSchedulePreviewInput,
  ): Promise<SchedulePreview>;
  updateSessionSchedule(
    tenantSlug: string,
    sessionId: string,
    input: ApplySessionScheduleInput,
    idempotencyKey: string,
  ): Promise<WeekSchedule>;
  previewSubstitution(
    tenantSlug: string,
    sessionId: string,
    input: SubstitutionPreviewInput,
  ): Promise<SchedulePreview>;
  substituteTeacher(
    tenantSlug: string,
    sessionId: string,
    input: ApplySubstitutionInput,
  ): Promise<SessionMutationResult>;
  previewMakeup(
    tenantSlug: string,
    sessionId: string,
    input: MakeupPreviewInput,
  ): Promise<SchedulePreview>;
  cancelSession(
    tenantSlug: string,
    sessionId: string,
    input: CancelSessionInput,
  ): Promise<SessionMutationResult>;
  createMakeup(
    tenantSlug: string,
    sessionId: string,
    input: CreateMakeupInput,
  ): Promise<SessionMutationResult>;
}

const idempotencyKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const scheduleRepository: ScheduleRepository = {
  getManagementSchedule: (tenantSlug, params) =>
    apiRequest<WeekSchedule>(
      `schedules/management?${new URLSearchParams({
        weekStart: params.weekStart,
        teacherId: params.teacherId,
        roomId: params.roomId,
      }).toString()}`,
      { tenantSlug },
    ),
  getOwnSchedule: (tenantSlug, weekStart) =>
    apiRequest<WeekSchedule>(`schedules/me?${new URLSearchParams({ weekStart }).toString()}`, {
      tenantSlug,
    }),
  getOptions: (tenantSlug) =>
    apiRequest<ClassSchedulingOptions>("class-scheduling/options", { tenantSlug }),
  previewSessionSchedule: (tenantSlug, sessionId, input) =>
    apiRequest<SchedulePreview>(`sessions/${sessionId}/schedule-preview`, {
      tenantSlug,
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSessionSchedule: (tenantSlug, sessionId, input, idempotencyKey) =>
    apiRequest<WeekSchedule>(`sessions/${sessionId}/schedule`, {
      tenantSlug,
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    }),
  previewSubstitution: (tenantSlug, sessionId, input) =>
    apiRequest<SchedulePreview>(`sessions/${sessionId}/substitution-previews`, {
      tenantSlug,
      method: "POST",
      body: JSON.stringify(input),
    }),
  substituteTeacher: (tenantSlug, sessionId, input) =>
    apiRequest<SessionMutationResult>(`sessions/${sessionId}/substitutions`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
  previewMakeup: (tenantSlug, sessionId, input) =>
    apiRequest<SchedulePreview>(`sessions/${sessionId}/makeup-previews`, {
      tenantSlug,
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelSession: (tenantSlug, sessionId, input) =>
    apiRequest<SessionMutationResult>(`sessions/${sessionId}/cancellations`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
  createMakeup: (tenantSlug, sessionId, input) =>
    apiRequest<SessionMutationResult>(`sessions/${sessionId}/makeups`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
};
