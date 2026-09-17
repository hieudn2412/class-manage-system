import { env } from "../../shared/config/env";
import { loadSession } from "../../shared/lib/sessionStorage";
import { ApiError, type ApiErrorPayload } from "../../shared/types/api";
import type {
  AppNotification,
  AuditTimelineItem,
  FilePurpose,
  HomeworkDetail,
  HomeworkReportRow,
  HomeworkSummary,
  Material,
  Page,
  StoredFile,
  StudentHomeworkDetail,
  StudentHomeworkSummary,
  TenantStorageUsage,
} from "../../shared/types/domain";
import { apiRequest } from "../api/apiClient";

const idempotencyKey = (): string => crypto.randomUUID();
const params = (values: Record<string, string | number | boolean | null | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return search.toString();
};

const apiBase = () => env.apiBaseUrl.replace(/\/$/, "");

export interface HomeworkInput {
  sessionId?: string | null;
  title: string;
  description: string;
  deadlineAt?: string | null;
  audienceType: "CLASS" | "SELECTED";
  studentIds: string[];
  fileTokens: string[];
  links: Array<{ label: string; url: string }>;
}

export interface HomeworkUpdateInput {
  title: string;
  description: string;
  deadlineAt?: string | null;
  fileIds: string[];
  fileTokens: string[];
  links: Array<{ label: string; url: string }>;
  version: number;
}

export interface HomeworkSearchParams {
  sessionId?: string | null;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface MaterialInput {
  sessionId?: string | null;
  title: string;
  description: string;
  fileToken: string;
}

export const learningContentRepository = {
  upload: async (tenantSlug: string, file: File, purpose: FilePurpose): Promise<StoredFile> => {
    const session = loadSession();
    const body = new FormData();
    body.append("file", file);
    body.append("purpose", purpose);
    const headers = new Headers();
    if (session) headers.set("Authorization", `Bearer ${session.token}`);
    headers.set("X-Tenant-Slug", tenantSlug);
    const response = await fetch(`${apiBase()}/uploads/staging`, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      const fallback: ApiErrorPayload = {
        code: "UPLOAD_FAILED",
        message: "Không thể upload file.",
      };
      const problem = (await response.json().catch(() => fallback)) as Partial<ApiErrorPayload>;
      throw new ApiError(response.status, {
        code: problem.code ?? fallback.code,
        message: problem.message ?? problem.detail ?? fallback.message,
        fieldErrors: problem.fieldErrors,
        details: problem.details,
      });
    }
    return response.json() as Promise<StoredFile>;
  },
  classHomeworks: (tenantSlug: string, classId: string, query: HomeworkSearchParams = {}) =>
    apiRequest<Page<HomeworkSummary>>(
      `classes/${classId}/homeworks?${params({
        sessionId: query.sessionId,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
      { tenantSlug },
    ),
  studentHomeworks: (tenantSlug: string, query = {}) =>
    apiRequest<Page<StudentHomeworkSummary>>(`students/me/homeworks?${params(query)}`, { tenantSlug }),
  homework: (tenantSlug: string, homeworkId: string) =>
    apiRequest<HomeworkDetail>(`homeworks/${homeworkId}`, { tenantSlug }),
  studentHomework: (tenantSlug: string, homeworkId: string) =>
    apiRequest<StudentHomeworkDetail>(`students/me/homeworks/${homeworkId}`, { tenantSlug }),
  createHomework: (tenantSlug: string, classId: string, input: HomeworkInput) =>
    apiRequest<HomeworkDetail>(`classes/${classId}/homeworks`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
  updateHomework: (tenantSlug: string, homeworkId: string, input: HomeworkUpdateInput) =>
    apiRequest<HomeworkDetail>(`homeworks/${homeworkId}`, {
      tenantSlug,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  publishHomework: (tenantSlug: string, homeworkId: string, version: number) =>
    apiRequest<HomeworkDetail>(`homeworks/${homeworkId}/publish`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ version }),
    }),
  closeHomework: (tenantSlug: string, homeworkId: string, version: number) =>
    apiRequest<HomeworkDetail>(`homeworks/${homeworkId}/close`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ version }),
    }),
  reopenHomework: (tenantSlug: string, homeworkId: string, reason: string, version: number) =>
    apiRequest<HomeworkDetail>(`homeworks/${homeworkId}/reopen`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ reason, version }),
    }),
  submitHomework: (tenantSlug: string, homeworkId: string, note: string, fileTokens: string[]) =>
    apiRequest(`students/me/homeworks/${homeworkId}/submissions`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ note, fileTokens }),
    }),
  reviewSubmission: (
    tenantSlug: string,
    homeworkId: string,
    submissionId: string,
    input: { status: "REVIEWED" | "REVISION_REQUESTED"; comment: string; fileTokens: string[]; submissionVersion: number },
  ) =>
    apiRequest(`homeworks/${homeworkId}/submissions/${submissionId}/reviews`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
  materials: (tenantSlug: string, classId: string, query = {}) =>
    apiRequest<Page<Material>>(`classes/${classId}/materials?${params(query)}`, { tenantSlug }),
  createMaterial: (tenantSlug: string, classId: string, input: MaterialInput) =>
    apiRequest<Material>(`classes/${classId}/materials`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
  updateMaterial: (tenantSlug: string, materialId: string, input: Omit<MaterialInput, "fileToken"> & { fileToken?: string; version: number }) =>
    apiRequest<Material>(`materials/${materialId}`, {
      tenantSlug,
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  removeMaterial: (tenantSlug: string, materialId: string, version: number) =>
    apiRequest<void>(`materials/${materialId}?version=${version}`, { tenantSlug, method: "DELETE" }),
  report: (tenantSlug: string, query = {}) =>
    apiRequest<Page<HomeworkReportRow>>(`homework-reports?${params(query)}`, { tenantSlug }),
  notifications: (tenantSlug: string, query = {}) =>
    apiRequest<Page<AppNotification>>(`notifications?${params(query)}`, { tenantSlug }),
  unreadCount: (tenantSlug: string) =>
    apiRequest<{ unread: number }>("notifications/unread-count", { tenantSlug }),
  markRead: (tenantSlug: string, notificationId: string) =>
    apiRequest<void>(`notifications/${notificationId}/read`, { tenantSlug, method: "PATCH" }),
  markAllRead: (tenantSlug: string) =>
    apiRequest<void>("notifications/read-all", { tenantSlug, method: "PATCH" }),
  timeline: (tenantSlug: string, entityType: string, entityId: string) =>
    apiRequest<AuditTimelineItem[]>(`audit-timeline?${params({ entityType, entityId })}`, { tenantSlug }),
  usage: (tenantSlug: string) => apiRequest<TenantStorageUsage>("storage/usage", { tenantSlug }),
  platformUsage: (tenantId: string) => apiRequest<TenantStorageUsage>(`platform/tenants/${tenantId}/quota`),
  updatePlatformQuota: (tenantId: string, quotaBytes: number, version: number) =>
    apiRequest<TenantStorageUsage>(`platform/tenants/${tenantId}/quota`, {
      method: "PATCH",
      body: JSON.stringify({ quotaBytes, version }),
    }),
};
