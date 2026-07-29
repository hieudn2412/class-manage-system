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
  | "WARNING_CONFIRMATION_REQUIRED"
  | "PREVIEW_STALE"
  | "CHECK_IN_TOO_EARLY"
  | "CHECK_IN_WINDOW_CLOSED"
  | "ONLINE_LINK_REQUIRED"
  | "NOT_ACTUAL_TEACHER"
  | "SESSION_NOT_IN_SCOPE"
  | "ROSTER_CHANGED"
  | "SESSION_STATE_CONFLICT"
  | "TEST_SCORE_INVALID"
  | "SERVER_ERROR";

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  detail?: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  readonly retryAfterSeconds?: number;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = status;
    this.fieldErrors = payload.fieldErrors;
    this.retryAfterSeconds = payload.retryAfterSeconds;
  }
}
