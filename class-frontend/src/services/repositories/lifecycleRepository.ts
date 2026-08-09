import { apiRequest } from "../api/apiClient";
import type {
  ClassStatusMutationResult,
  EndEnrollmentResult,
  EnrollmentCandidate,
  EnrollmentItem,
  EnrollmentMutationResult,
  Page,
  StudentClassDetail,
  StudentClassItem,
  StudentSessionItem,
} from "../../shared/types/domain";

const key = (): string => crypto.randomUUID();

export const lifecycleRepository = {
  enrollments: (
    tenantSlug: string,
    classId: string,
    scope: "Active" | "History",
    search: string,
    page: number,
    pageSize: number,
  ) =>
    apiRequest<Page<EnrollmentItem>>(
      `classes/${classId}/enrollments?${new URLSearchParams({
        scope,
        search,
        page: String(page),
        pageSize: String(pageSize),
      })}`,
      { tenantSlug },
    ),

  candidates: (tenantSlug: string, classId: string, search: string, page = 1, pageSize = 50) =>
    apiRequest<Page<EnrollmentCandidate>>(
      `classes/${classId}/enrollment-candidates?${new URLSearchParams({
        search,
        page: String(page),
        pageSize: String(pageSize),
      })}`,
      { tenantSlug },
    ),

  addEnrollments: (
    tenantSlug: string,
    classId: string,
    studentIds: string[],
    classVersion: number,
    acknowledgedWarningIds: string[],
    idempotencyKey = key(),
  ) =>
    apiRequest<EnrollmentMutationResult>(`classes/${classId}/enrollments`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ studentIds, classVersion, acknowledgedWarningIds }),
    }),

  endEnrollment: (
    tenantSlug: string,
    classId: string,
    enrollmentId: string,
    targetStatus: "Left" | "Transferred",
    reason: string,
    classVersion: number,
    enrollmentVersion: number,
    idempotencyKey = key(),
  ) =>
    apiRequest<EndEnrollmentResult>(`classes/${classId}/enrollments/${enrollmentId}`, {
      tenantSlug,
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        targetStatus,
        reason,
        classVersion,
        enrollmentVersion,
      }),
    }),

  changeStatus: (
    tenantSlug: string,
    classId: string,
    targetStatus: "Closed" | "AwaitingClose" | "Cancelled",
    reason: string,
    version: number,
    acknowledgedWarningIds: string[],
    idempotencyKey = key(),
  ) =>
    apiRequest<ClassStatusMutationResult>(`classes/${classId}/status`, {
      tenantSlug,
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ targetStatus, reason, version, acknowledgedWarningIds }),
    }),

  studentClasses: (
    tenantSlug: string,
    access: "All" | "Accessible" | "Locked",
    page: number,
    pageSize: number,
  ) =>
    apiRequest<Page<StudentClassItem>>(
      `students/me/classes?${new URLSearchParams({
        access,
        page: String(page),
        pageSize: String(pageSize),
      })}`,
      { tenantSlug },
    ),

  studentClass: (tenantSlug: string, classId: string) =>
    apiRequest<StudentClassDetail>(`students/me/classes/${classId}`, { tenantSlug }),

  studentSessions: (tenantSlug: string, classId: string, page: number, pageSize: number) =>
    apiRequest<Page<StudentSessionItem>>(
      `students/me/classes/${classId}/sessions?${new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })}`,
      { tenantSlug },
    ),
};
