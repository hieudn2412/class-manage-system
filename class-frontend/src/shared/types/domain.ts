export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ACADEMIC_MANAGER",
  "ACCOUNTANT",
  "TEACHER",
  "STUDENT",
] as const;

export type Role = (typeof ROLES)[number];

export type TenantStatus = "ACTIVE" | "LOCKED";
export type UserStatus = "ACTIVE" | "LOCKED";
export type PasswordState = "READY" | "MUST_CHANGE";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
}

export interface User {
  id: string;
  tenantId: string | null;
  username: string;
  displayName: string;
  roles: Role[];
  status: UserStatus;
  passwordState: PasswordState;
}

export interface AuthSession {
  token: string;
  scope: "PLATFORM" | "TENANT";
  user: User;
  tenant: Tenant | null;
  expiresAt: string;
}

export interface InitialAdministrator {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  status: UserStatus;
  version: number;
}
export interface PlatformTenant extends Tenant {
  initialAdmin: InitialAdministrator | null;
  createdAt: string;
  version: number;
}
export type ProfileType = "STAFF" | "TEACHER" | "STUDENT";
export interface Account {
  id: string;
  profileType: ProfileType;
  code: string | null;
  username: string;
  displayName: string;
  email: string | null;
  roles: Role[];
  status: UserStatus;
  passwordState: PasswordState;
  parentName: string | null;
  parentPhone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  version: number;
}

export const CLASS_STATUSES = [
  "Draft",
  "Scheduled",
  "Active",
  "AwaitingClose",
  "Closed",
  "Cancelled",
] as const;

export type ClassStatus = (typeof CLASS_STATUSES)[number];

export interface TeacherOption {
  id: string;
  name: string;
}

export type DeliveryMode = "IN_PERSON" | "ONLINE";
export type RoomStatus = "ACTIVE" | "INACTIVE";

export interface RoomOption {
  id: string;
  code: string;
  name: string;
  capacity: number;
  status: RoomStatus;
}

export interface StudentOption {
  id: string;
  code: string;
  name: string;
}

export interface HolidayRange {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface WeeklySchedulePattern {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  mode: DeliveryMode;
  roomId: string | null;
}

export interface SessionScheduleOverride {
  sessionKey: string;
  mode: DeliveryMode;
  roomId: string | null;
}

export interface ClassDraftInput {
  name: string;
  description: string;
  primaryTeacherId: string;
  startDate: string;
  totalSessions: number;
  tuitionAmount: number;
  hourlyRate: number;
  capacity: number | null;
  defaultMode: DeliveryMode;
  studentIds: string[];
  patterns: WeeklySchedulePattern[];
  overrides: SessionScheduleOverride[];
}

export interface ClassDraftRecord extends ClassDraftInput {
  id: string;
  code: string;
  status: "Draft";
}

export type ScheduleConflictCode = "TEACHER_OVERLAP" | "ROOM_OVERLAP" | "STUDENT_OVERLAP";

export type ScheduleConflictSeverity = "BLOCKING" | "WARNING";

export interface ConflictingSessionSummary {
  sessionId: string;
  classCode: string;
  className: string;
  startAt: string;
  endAt: string;
  teacherName: string;
  roomName: string | null;
}

export interface ScheduleConflict {
  id: string;
  code: ScheduleConflictCode;
  severity: ScheduleConflictSeverity;
  proposedSessionKey: string;
  studentNames: string[];
  conflictingSession: ConflictingSessionSummary;
}

export interface SchedulePreviewSession {
  key: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  teacherId: string;
  teacherName: string;
  mode: DeliveryMode;
  roomId: string | null;
  roomName: string | null;
}

export interface SkippedHoliday {
  date: string;
  holidayId: string;
  holidayName: string;
  patternId: string;
}

export interface SchedulePreview {
  previewId: string;
  generatedAt: string;
  expiresAt?: string;
  inputVersion: string;
  sessions: SchedulePreviewSession[];
  skippedHolidays: SkippedHoliday[];
  expectedEndDate: string;
  conflicts: ScheduleConflict[];
}

export interface ClassSchedulingOptions {
  teachers: TeacherOption[];
  rooms: RoomOption[];
}

export interface PublishClassInput {
  previewId: string;
  acknowledgedWarningIds: string[];
}

export interface CalendarSession {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  plannedTeacherId: string;
  actualTeacherId: string;
  teacherName: string;
  mode: DeliveryMode;
  roomId: string | null;
  roomName: string | null;
  onlineUrl: string | null;
  isSubstitution: boolean;
  isMakeup: boolean;
  status: string;
  scheduleState: "UPCOMING" | "TAUGHT" | "MISSING_CHECK_IN" | "CANCELLED";
  makeupRootSessionId: string | null;
  replacesSessionId: string | null;
  replacementSessionId: string | null;
  cancellationReason: string | null;
  allowedActions: SessionAction[];
  version: number;
}

export interface WeekSchedule {
  weekStart: string;
  weekEnd: string;
  sessions: CalendarSession[];
}

export interface SessionSchedulePreviewInput {
  mode: DeliveryMode;
  roomId: string | null;
  version: number;
}

export interface ApplySessionScheduleInput extends SessionSchedulePreviewInput {
  previewId: string;
  acknowledgedWarningIds: string[];
}

export type SessionAction = "SUBSTITUTE_TEACHER" | "CANCEL_SESSION" | "CREATE_MAKEUP";

export interface SubstitutionPreviewInput {
  teacherId: string;
  note: string;
  version: number;
}

export interface ApplySubstitutionInput extends SubstitutionPreviewInput {
  previewId: string;
  acknowledgedWarningIds: string[];
}

export interface MakeupScheduleInput {
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  mode: DeliveryMode;
  roomId: string | null;
}

export interface MakeupPreviewInput {
  makeup: MakeupScheduleInput;
  version: number;
}

export interface CancelSessionInput {
  reason: string;
  version: number;
  makeup?: MakeupScheduleInput | null;
  previewId?: string | null;
  acknowledgedWarningIds: string[];
}

export interface CreateMakeupInput {
  version: number;
  previewId: string;
  makeup: MakeupScheduleInput;
  acknowledgedWarningIds: string[];
}

export interface SessionMutationView {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  plannedTeacherId: string;
  actualTeacherId: string;
  teacherName: string;
  mode: DeliveryMode;
  roomId: string | null;
  roomName: string | null;
  isSubstitution: boolean;
  isMakeup: boolean;
  status: string;
  makeupRootSessionId: string | null;
  replacesSessionId: string | null;
  replacementSessionId: string | null;
  cancellationReason: string | null;
  allowedActions: SessionAction[];
  version: number;
}

export interface SessionMutationResult {
  source: SessionMutationView;
  makeup: SessionMutationView | null;
  conflicts: ScheduleConflict[];
}

export interface ClassListItem {
  id: string;
  code: string;
  name: string;
  teacher: TeacherOption;
  scheduleSummary: string;
  completedSessions: number;
  totalSessions: number;
  expectedEndDate: string | null;
  status: ClassStatus;
  sessionMonths: string[];
}

export interface ClassSessionSummary {
  id: string;
  ordinal: number;
  startAt: string;
  lessonName: string;
  teacherName: string;
  attendanceRate: number | null;
  recordStatus: "COMPLETE" | "MISSING";
  recordUrl: string | null;
}

export interface ClassDetail extends ClassListItem {
  hourlyRate: number;
  attendanceRate: number;
  homeworkCompletionRate: number;
  currentLesson: string;
  room: string;
  deliveryMode: "Tại lớp" | "Online";
  studentCount: number;
  outstandingItems: string[];
  sessions: ClassSessionSummary[];
  version: number;
  allowedTransitions: ("Closed" | "AwaitingClose" | "Cancelled")[];
  closeReadiness: {
    missingAttendanceCount: number;
    missingRecordCount: number;
    warnings: LifecycleWarning[];
  };
  futureSessionCount: number;
}

export interface LifecycleWarning {
  id: string;
  code: string;
  message: string;
  studentIds?: string[];
}

export type EnrollmentStatus = "Active" | "Left" | "Transferred";

export interface EnrollmentStudent {
  id: string;
  code: string;
  name: string;
  parentName: string | null;
  parentPhone: string | null;
}

export interface EnrollmentItem {
  id: string;
  student: EnrollmentStudent;
  status: EnrollmentStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  endReason: string | null;
  tuitionChargeId: string | null;
  originalTuitionAmount: number | null;
  tuitionStatus: string | null;
  version: number;
}

export interface EnrollmentCandidate {
  id: string;
  code: string;
  name: string;
  parentName: string | null;
  parentPhone: string | null;
}

export interface EnrollmentMutationResult {
  enrollments: EnrollmentItem[];
  classVersion: number;
}

export interface EndEnrollmentResult {
  enrollment: EnrollmentItem;
  classVersion: number;
}

export interface ClassStatusMutationResult {
  classId: string;
  status: ClassStatus;
  version: number;
  cancelledFutureSessions: number;
  acknowledgedWarnings: LifecycleWarning[];
}

export type StudentClassAccess = "Accessible" | "Locked";

export interface StudentClassItem {
  id: string;
  code: string;
  name: string;
  teacherName: string;
  scheduleSummary: string;
  status: ClassStatus;
  access: StudentClassAccess;
  effectiveFrom: string;
  effectiveTo: string | null;
  completedSessions: number;
  totalSessions: number;
  expectedEndDate: string | null;
}

export interface StudentClassDetail {
  id: string;
  code: string;
  name: string;
  description: string;
  teacherName: string;
  scheduleSummary: string;
  status: ClassStatus;
  completedSessions: number;
  totalSessions: number;
  expectedEndDate: string | null;
}

export interface StudentSessionItem {
  id: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  status: string;
  teacherName: string;
  lessonName: string;
  lessonContent: string;
  attendanceStatus: AttendanceStatus | null;
  attendanceNote: string | null;
  recordUrl: string | null;
  comment: string | null;
  testResult: StudentTestResult | null;
}

export interface StudentTestResult {
  id: string;
  testName: string;
  score: number | null;
  maxScore: number;
  testDate: string;
  comment: string;
  testComment: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  detail: string;
  delta?: string;
}

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  severity: "warning" | "danger" | "info";
  targetSessionId: string | null;
}

export interface ClassStateMetric {
  status: ClassStatus;
  label: string;
  count: number;
}

export interface DashboardData {
  date: string;
  greetingName: string;
  kpis: DashboardKpi[];
  attentionItems: AttentionItem[];
  classStates: ClassStateMetric[];
}

export type AttendanceStatus =
  "PRESENT" | "LATE" | "LEFT_EARLY" | "ABSENT_EXCUSED" | "ABSENT_UNEXCUSED";

export type CheckInState =
  "TOO_EARLY" | "OPEN" | "CHECKED_IN" | "WINDOW_CLOSED" | "COMPLETED" | "CANCELLED";

export interface TeacherDashboardMetrics {
  todaySessions: number;
  checkInAvailable: number;
  missingDocumentation: number;
  monthTeachingHours: number;
  monthAccruedSalary: number;
}

export interface TodayTeachingSession {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  mode: DeliveryMode;
  roomId: string | null;
  roomName: string | null;
  status: string;
  checkInState: CheckInState;
  checkInOpensAt: string;
  substitution: boolean;
}

export interface TeacherDashboardData {
  date: string;
  teacherName: string;
  metrics: TeacherDashboardMetrics;
  sessions: TodayTeachingSession[];
}

export type SalaryBalanceStatus = "OWED" | "SETTLED" | "OVERPAID";
export type SalaryAccrualStatus = "ACTIVE" | "REVERSED";
export type SalaryPaymentMethod = "CASH" | "BANK_TRANSFER";

export interface HourlyRate {
  id: string;
  classId: string;
  effectiveDate: string;
  effectiveTo: string | null;
  hourlyRate: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollMetrics {
  teacherCount: number;
  sessionCount: number;
  totalMinutes: number;
  accrued: number;
  adjustments: number;
  due: number;
  paid: number;
  outstanding: number;
  overpaidTeachers: number;
}

export interface PayrollTeacherRow {
  teacherId: string;
  teacherName: string;
  sessionCount: number;
  totalMinutes: number;
  accrued: number;
  adjustments: number;
  due: number;
  paid: number;
  outstanding: number;
  status: SalaryBalanceStatus;
}

export interface PayrollPage {
  month: string;
  metrics: PayrollMetrics;
  teachers: Page<PayrollTeacherRow>;
}

export interface SalaryAccrualLine {
  id: string;
  sessionId: string;
  classCode: string;
  className: string;
  ordinal: number;
  sessionDate: string;
  scheduledMinutes: number;
  hourlyRate: number;
  amount: number;
  revision: number;
  status: SalaryAccrualStatus;
  substitution: boolean;
}

export interface SalaryAdjustment {
  id: string;
  teacherId: string;
  teacherName: string;
  salaryMonth: string;
  amount: number;
  reason: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryPayment {
  id: string;
  teacherId: string;
  teacherName: string;
  salaryMonth: string;
  paidAt: string;
  amount: number;
  method: SalaryPaymentMethod;
  reference: string | null;
  overpaymentReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherPayrollMetrics {
  sessionCount: number;
  totalMinutes: number;
  accrued: number;
  adjustments: number;
  due: number;
  paid: number;
  outstanding: number;
  status: SalaryBalanceStatus;
}

export interface TeacherPayrollDetail {
  month: string;
  teacherId: string;
  teacherName: string;
  metrics: TeacherPayrollMetrics;
  accruals: SalaryAccrualLine[];
  adjustments: SalaryAdjustment[];
  payments: SalaryPayment[];
}

export interface SalaryMonthSummary {
  month: string;
  accrued: number;
  adjustments: number;
  due: number;
  paidBySalaryMonth: number;
  paidCashFlow: number;
  outstanding: number;
}

export interface SalaryYearSummary {
  year: number;
  months: SalaryMonthSummary[];
}

export interface TeacherClassItem {
  id: string;
  code: string;
  name: string;
  status: string;
  teacherRole: string;
  startDate: string;
  expectedEndDate: string | null;
  completedSessions: number;
  totalSessions: number;
  latestSessionAt: string | null;
}

export interface TeacherClassHeader {
  id: string;
  code: string;
  name: string;
  status: string;
  completedSessions: number;
  totalSessions: number;
}

export interface TeacherSessionSummary {
  id: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  status: string;
  actualTeacherName: string;
  actualTeacher: boolean;
  readOnly: boolean;
  lessonName: string;
  participatedStudents: number;
  rosterStudents: number;
  missingDocumentation: boolean;
  hasTest: boolean;
  testResultCount: number;
}

export interface TeacherClassSessions {
  learningClass: TeacherClassHeader;
  sessions: Page<TeacherSessionSummary>;
}

export interface CheckInRecord {
  checkedInAt: string;
  onlineLink: string | null;
}

export interface LessonReport {
  lessonName: string;
  lessonContent: string;
  recordUrl: string | null;
  version: number;
}

export interface SessionTest {
  id: string;
  testName: string;
  maxScore: number;
  testDate: string;
  comment: string;
  version: number;
}

export interface TestResult {
  id: string;
  score: number | null;
  comment: string;
  version: number;
}

export interface RosterStudent {
  studentId: string;
  code: string;
  name: string;
  attendanceStatus: AttendanceStatus | null;
  attendanceNote: string;
  attendanceVersion: number;
  sessionComment: string;
  commentVersion: number;
  testResult: TestResult | null;
}

export interface SessionOperationsDetail {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  ordinal: number;
  startAt: string;
  endAt: string;
  mode: DeliveryMode;
  roomId: string | null;
  roomName: string | null;
  onlineLink: string | null;
  status: string;
  plannedTeacherId: string;
  actualTeacherId: string;
  actualTeacherName: string;
  substitution: boolean;
  makeup: boolean;
  makeupRootSessionId: string | null;
  replacesSessionId: string | null;
  replacementSessionId: string | null;
  cancellationReason: string | null;
  allowedActions: SessionAction[];
  actualTeacher: boolean;
  canEdit: boolean;
  canVerify: boolean;
  checkInState: CheckInState;
  checkInOpensAt: string;
  checkIn: CheckInRecord | null;
  rosterFrozen: boolean;
  rosterRevision: string;
  missingDocumentation: boolean;
  version: number;
  lessonReport: LessonReport;
  sessionTest: SessionTest | null;
  students: RosterStudent[];
  participatedStudents: number;
}

export interface PedagogicalRecordInput {
  rosterRevision: string;
  lessonReport: {
    lessonName: string;
    lessonContent: string;
    recordUrl: string | null;
    version: number;
  };
  students: Array<{
    studentId: string;
    attendanceStatus: AttendanceStatus | null;
    attendanceNote: string;
    attendanceVersion: number;
    sessionComment: string;
    commentVersion: number;
  }>;
}

export interface SessionTestInput {
  testName: string;
  maxScore: number;
  testDate: string;
  comment: string;
}

export interface SessionTestUpdateInput extends SessionTestInput {
  version: number;
  rosterRevision: string;
  results: Array<{
    studentId: string;
    score: number | null;
    comment: string;
    version: number;
  }>;
}

export type VerificationDecision = "CONFIRM_TAUGHT" | "CANCEL";
