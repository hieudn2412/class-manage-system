import { apiRequest } from "../api/apiClient";
import type {
  ApplySessionScheduleInput,
  ClassSchedulingOptions,
  SchedulePreview,
  SessionSchedulePreviewInput,
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
}

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
};
