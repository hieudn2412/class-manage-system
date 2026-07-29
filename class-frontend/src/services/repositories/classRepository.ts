import { apiRequest } from "../api/apiClient";
import type {
  ClassDraftInput,
  ClassDraftRecord,
  ClassDetail,
  ClassListItem,
  ClassSchedulingOptions,
  ClassStatus,
  Page,
  PublishClassInput,
  SchedulePreview,
  StudentOption,
  TeacherOption,
} from "../../shared/types/domain";

export interface ClassListParams {
  search: string;
  month: string;
  status: ClassStatus | "";
  teacherId: string;
  page: number;
  pageSize: number;
  sort: "name" | "progress" | "expectedEndDate";
}

export interface ClassRepository {
  listClasses(tenantSlug: string, params: ClassListParams): Promise<Page<ClassListItem>>;
  getClass(tenantSlug: string, classId: string): Promise<ClassDetail>;
  getDraft(tenantSlug: string, classId: string): Promise<ClassDraftRecord>;
  listTeachers(tenantSlug: string): Promise<TeacherOption[]>;
  getSchedulingOptions(tenantSlug: string): Promise<ClassSchedulingOptions>;
  listStudents(
    tenantSlug: string,
    search: string,
    page: number,
    pageSize: number,
  ): Promise<Page<StudentOption>>;
  previewSchedule(tenantSlug: string, input: ClassDraftInput): Promise<SchedulePreview>;
  createDraft(tenantSlug: string, input: ClassDraftInput): Promise<ClassDraftRecord>;
  updateDraft(
    tenantSlug: string,
    classId: string,
    input: ClassDraftInput,
  ): Promise<ClassDraftRecord>;
  publishClass(
    tenantSlug: string,
    classId: string,
    input: PublishClassInput,
    idempotencyKey: string,
  ): Promise<ClassDetail>;
}

const toSearchParams = (params: ClassListParams): string => {
  const searchParams = new URLSearchParams({
    search: params.search,
    month: params.month,
    status: params.status,
    teacherId: params.teacherId,
    page: String(params.page),
    pageSize: String(params.pageSize),
    sort: params.sort,
  });
  return searchParams.toString();
};

export const classRepository: ClassRepository = {
  listClasses: (tenantSlug, params) =>
    apiRequest<Page<ClassListItem>>(`classes?${toSearchParams(params)}`, { tenantSlug }),
  getClass: (tenantSlug, classId) => apiRequest<ClassDetail>(`classes/${classId}`, { tenantSlug }),
  getDraft: (tenantSlug, classId) =>
    apiRequest<ClassDraftRecord>(`classes/${classId}/draft`, { tenantSlug }),
  listTeachers: (tenantSlug) => apiRequest<TeacherOption[]>("classes/teachers", { tenantSlug }),
  getSchedulingOptions: (tenantSlug) =>
    apiRequest<ClassSchedulingOptions>("class-scheduling/options", { tenantSlug }),
  listStudents: (tenantSlug, search, page, pageSize) =>
    apiRequest<Page<StudentOption>>(
      `students?${new URLSearchParams({
        search,
        page: String(page),
        pageSize: String(pageSize),
      }).toString()}`,
      { tenantSlug },
    ),
  previewSchedule: (tenantSlug, input) =>
    apiRequest<SchedulePreview>("class-scheduling/previews", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify(input),
    }),
  createDraft: (tenantSlug, input) =>
    apiRequest<ClassDraftRecord>("classes", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateDraft: (tenantSlug, classId, input) =>
    apiRequest<ClassDraftRecord>(`classes/${classId}`, {
      tenantSlug,
      method: "PUT",
      body: JSON.stringify(input),
    }),
  publishClass: (tenantSlug, classId, input, idempotencyKey) =>
    apiRequest<ClassDetail>(`classes/${classId}/publish`, {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    }),
};
