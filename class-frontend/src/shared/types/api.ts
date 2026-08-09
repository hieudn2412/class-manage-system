export type ApiErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "TENANT_LOCKED"
  | "RATE_LIMITED"
  | "UNAUTHENTICATED"
  | "TENANT_REQUIRED"
  | "FORBIDDEN"
  | "PASSWORD_CHANGE_REQUIRED"
  | "PASSWORD_CHANGE_NOT_REQUIRED"
  | "PASSWORD_STATE_CHANGED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SCHEDULE_CONFLICT"
  | "SCHEDULE_PREVIEW_STALE"
  | "WARNING_CONFIRMATION_REQUIRED"
  | "PREVIEW_STALE"
  | "OPTIMISTIC_LOCK_CONFLICT"
  | "TEACHER_OVERLAP"
  | "ROOM_OVERLAP"
  | "STUDENT_OVERLAP"
  | "SAME_TEACHER"
  | "MAKEUP_ALREADY_EXISTS"
  | "MAKEUP_START_IN_PAST"
  | "PREVIEW_REQUIRED"
  | "INVALID_TIME_RANGE"
  | "ROOM_REQUIRED"
  | "ONLINE_ROOM_NOT_ALLOWED"
  | "CHECK_IN_TOO_EARLY"
  | "CHECK_IN_WINDOW_CLOSED"
  | "ONLINE_LINK_REQUIRED"
  | "NOT_ACTUAL_TEACHER"
  | "SESSION_NOT_IN_SCOPE"
  | "ROSTER_CHANGED"
  | "SESSION_STATE_CONFLICT"
  | "TEST_SCORE_INVALID"
  | "DUPLICATE_TENANT_SLUG"
  | "DUPLICATE_USERNAME"
  | "INVALID_ROLE_COMBINATION"
  | "LAST_ACTIVE_ADMIN"
  | "SELF_MANAGEMENT_FORBIDDEN"
  | "INITIAL_ADMIN_NOT_FOUND"
  | "VERSION_CONFLICT"
  | "CLASS_STATE_CONFLICT"
  | "CLASS_VERSION_CONFLICT"
  | "ENROLLMENT_VERSION_CONFLICT"
  | "ACTIVE_ENROLLMENT_EXISTS"
  | "ENROLLMENT_NOT_ACTIVE"
  | "ENROLLMENT_BATCH_INVALID"
  | "WARNINGS_NOT_ACKNOWLEDGED"
  | "OVERPAYMENT_CONFIRMATION_REQUIRED"
  | "PAYMENT_REFERENCE_REQUIRED"
  | "ADJUSTMENT_AMOUNT_REQUIRED"
  | "HOURLY_RATE_NOT_FOUND"
  | "STUDENT_CLASS_ACCESS_REVOKED"
  | "SERVER_ERROR";

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  detail?: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  readonly retryAfterSeconds?: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = status;
    this.fieldErrors = payload.fieldErrors;
    this.retryAfterSeconds = payload.retryAfterSeconds;
    this.details = payload.details;
  }
}
