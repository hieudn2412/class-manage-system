import { apiDownload, apiRequest } from "../api/apiClient";
import type {
  HourlyRate,
  PayrollPage,
  SalaryAdjustment,
  SalaryPayment,
  SalaryPaymentMethod,
  SalaryYearSummary,
  SendSalaryNotificationsInput,
  SendSalaryNotificationsResult,
  TeacherPayrollDetail,
} from "../../shared/types/domain";

export interface PayrollQuery {
  month: string;
  search: string;
  status: string;
  page: number;
  pageSize: number;
  sort: string;
}

export interface AdjustmentInput {
  teacherId: string;
  salaryMonth: string;
  amount: number;
  reason: string;
}

export interface PaymentInput {
  teacherId: string;
  salaryMonth: string;
  paidAt: string;
  amount: number;
  method: SalaryPaymentMethod;
  reference?: string;
  confirmOverpayment: boolean;
  overpaymentReason?: string;
}

export interface CompletionCorrectionInput {
  startAt: string;
  endAt: string;
  actualTeacherId: string;
  reason: string;
  version: number;
}

export interface CompletionCorrectionResult {
  sessionId: string;
  startAt: string;
  endAt: string;
  actualTeacherId: string;
  version: number;
  salaryAmount: number;
  salaryRevision: number;
}

const idempotencyKey = () => crypto.randomUUID();
const payrollParams = (query: PayrollQuery) => new URLSearchParams({
  month: query.month,
  search: query.search,
  status: query.status,
  page: String(query.page),
  pageSize: String(query.pageSize),
  sort: query.sort,
});

export const salaryRepository = {
  payroll: (tenantSlug: string, query: PayrollQuery) =>
    apiRequest<PayrollPage>(`salary/payroll?${payrollParams(query)}`, { tenantSlug }),
  teacherPayroll: (tenantSlug: string, teacherId: string, month: string) =>
    apiRequest<TeacherPayrollDetail>(
      `salary/payroll/${teacherId}?${new URLSearchParams({ month })}`,
      { tenantSlug },
    ),
  ownPayroll: (tenantSlug: string, month: string) =>
    apiRequest<TeacherPayrollDetail>(
      `teachers/me/salary?${new URLSearchParams({ month })}`,
      { tenantSlug },
    ),
  correctCompletion: (
    tenantSlug: string,
    sessionId: string,
    input: CompletionCorrectionInput,
  ) => apiRequest<CompletionCorrectionResult>(`sessions/${sessionId}/completion-correction`, {
    tenantSlug,
    method: "PATCH",
    body: JSON.stringify(input),
  }),
  createAdjustment: (tenantSlug: string, input: AdjustmentInput) =>
    apiRequest<SalaryAdjustment>("salary/adjustments", {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
  updateAdjustment: (
    tenantSlug: string,
    id: string,
    input: AdjustmentInput & { editReason: string; version: number },
  ) => apiRequest<SalaryAdjustment>(`salary/adjustments/${id}`, {
    tenantSlug,
    method: "PATCH",
    body: JSON.stringify(input),
  }),
  createPayment: (tenantSlug: string, input: PaymentInput) =>
    apiRequest<SalaryPayment>("salary/payments", {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
  updatePayment: (
    tenantSlug: string,
    id: string,
    input: PaymentInput & { editReason: string; version: number },
  ) => apiRequest<SalaryPayment>(`salary/payments/${id}`, {
    tenantSlug,
    method: "PATCH",
    body: JSON.stringify(input),
  }),
  hourlyRates: (tenantSlug: string, classId: string) =>
    apiRequest<HourlyRate[]>(`classes/${classId}/hourly-rates`, { tenantSlug }),
  createHourlyRate: (
    tenantSlug: string,
    classId: string,
    input: { effectiveDate: string; hourlyRate: number; reason: string },
  ) => apiRequest<HourlyRate>(`classes/${classId}/hourly-rates`, {
    tenantSlug,
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey() },
    body: JSON.stringify(input),
  }),
  updateHourlyRate: (
    tenantSlug: string,
    classId: string,
    rateId: string,
    input: { effectiveDate: string; hourlyRate: number; reason: string; version: number },
  ) => apiRequest<HourlyRate>(`classes/${classId}/hourly-rates/${rateId}`, {
    tenantSlug,
    method: "PATCH",
    body: JSON.stringify(input),
  }),
  salarySummary: (tenantSlug: string, year: number) =>
    apiRequest<SalaryYearSummary>(`finance/salary-summary?year=${year}`, { tenantSlug }),
  exportPayroll: (tenantSlug: string, query: Omit<PayrollQuery, "page" | "pageSize">) =>
    apiDownload(`salary/payroll/export?${new URLSearchParams({
      month: query.month,
      search: query.search,
      status: query.status,
      sort: query.sort,
    })}`, { tenantSlug }),
  sendNotifications: (tenantSlug: string, input: SendSalaryNotificationsInput) =>
    apiRequest<SendSalaryNotificationsResult>("salary/payroll-notifications", {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(input),
    }),
};
