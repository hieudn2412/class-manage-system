import { apiRequest } from "../api/apiClient";
import type {
  Page,
  PedagogicalRecordInput,
  SessionTestInput,
  SessionTestUpdateInput,
  SessionOperationsDetail,
  TeacherClassItem,
  TeacherClassSessions,
  TeacherDashboardData,
  UnconfirmSessionInput,
  VerificationDecision,
} from "../../shared/types/domain";

export interface TeacherClassSearchParams {
  search: string;
  status: string;
  role: string;
  page: number;
  pageSize: number;
}

export interface TeacherSessionSearchParams {
  status: string;
  page: number;
  pageSize: number;
}

const idempotencyKey = (): string => crypto.randomUUID();

export const teachingRepository = {
  getDashboard: (tenantSlug: string) =>
    apiRequest<TeacherDashboardData>("teachers/me/dashboard", { tenantSlug }),

  getClasses: (tenantSlug: string, params: TeacherClassSearchParams) =>
    apiRequest<Page<TeacherClassItem>>(
      `teachers/me/classes?${new URLSearchParams({
        search: params.search,
        status: params.status,
        role: params.role,
        page: String(params.page),
        pageSize: String(params.pageSize),
      }).toString()}`,
      { tenantSlug },
    ),

  getClassSessions: (tenantSlug: string, classId: string, params: TeacherSessionSearchParams) =>
    apiRequest<TeacherClassSessions>(
      `teachers/me/classes/${classId}/sessions?${new URLSearchParams({
        status: params.status,
        page: String(params.page),
        pageSize: String(params.pageSize),
      }).toString()}`,
      { tenantSlug },
    ),

  getSession: (tenantSlug: string, sessionId: string) =>
    apiRequest<SessionOperationsDetail>(`sessions/${sessionId}`, { tenantSlug }),

  checkIn: (tenantSlug: string, sessionId: string, version: number, onlineLink: string | null) =>
    apiRequest<SessionOperationsDetail>(`sessions/${sessionId}/check-ins`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ version, onlineLink }),
    }),

  savePedagogicalRecord: (tenantSlug: string, sessionId: string, input: PedagogicalRecordInput) =>
    apiRequest<SessionOperationsDetail>(`sessions/${sessionId}/pedagogical-record`, {
      tenantSlug,
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),

  createSessionTest: (tenantSlug: string, sessionId: string, input: SessionTestInput) =>
    apiRequest<SessionOperationsDetail>(`sessions/${sessionId}/tests`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),

  updateSessionTest: (
    tenantSlug: string,
    sessionId: string,
    testId: string,
    input: SessionTestUpdateInput,
  ) =>
    apiRequest<SessionOperationsDetail>(`sessions/${sessionId}/tests/${testId}`, {
      tenantSlug,
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),

  decideVerification: (
    tenantSlug: string,
    sessionId: string,
    decision: VerificationDecision,
    reason: string,
    version: number,
  ) =>
    apiRequest<SessionOperationsDetail>(`sessions/${sessionId}/verification-decisions`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ decision, reason, version }),
    }),

  unconfirmSession: (tenantSlug: string, sessionId: string, input: UnconfirmSessionInput) =>
    apiRequest<SessionOperationsDetail>(`sessions/${sessionId}/unconfirm`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
};
