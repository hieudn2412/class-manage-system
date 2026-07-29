import { apiRequest } from "../api/apiClient";
import type {
  Page,
  PedagogicalRecordInput,
  SessionOperationsDetail,
  TeacherClassItem,
  TeacherClassSessions,
  TeacherDashboardData,
  TestResult,
  TestResultInput,
  VerificationDecision,
} from "../../shared/types/domain";

export interface TeacherClassSearchParams {
  search: string;
  status: string;
  role: string;
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

  getClassSessions: (tenantSlug: string, classId: string, page: number, pageSize: number) =>
    apiRequest<TeacherClassSessions>(
      `teachers/me/classes/${classId}/sessions?${new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
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

  createTestResult: (
    tenantSlug: string,
    sessionId: string,
    studentId: string,
    input: TestResultInput,
  ) =>
    apiRequest<TestResult>(`sessions/${sessionId}/students/${studentId}/test-results`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),

  updateTestResult: (
    tenantSlug: string,
    sessionId: string,
    studentId: string,
    resultId: string,
    input: TestResultInput,
  ) =>
    apiRequest<TestResult>(`sessions/${sessionId}/students/${studentId}/test-results/${resultId}`, {
      tenantSlug,
      method: "PUT",
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
};
