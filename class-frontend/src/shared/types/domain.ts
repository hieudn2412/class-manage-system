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
  user: User;
  tenant: Tenant | null;
  expiresAt: string;
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

export interface TestResult {
  id: string;
  testName: string;
  score: number;
  maxScore: number;
  testDate: string;
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
  testResults: TestResult[];
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
  roomName: string | null;
  onlineLink: string | null;
  status: string;
  actualTeacherName: string;
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

export interface TestResultInput {
  testName: string;
  score: number;
  maxScore: number;
  testDate: string;
  comment: string;
  version: number;
}

export type VerificationDecision = "CONFIRM_TAUGHT" | "CANCEL";
