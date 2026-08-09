import { env } from "../../shared/config/env";
import { loadSession } from "../../shared/lib/sessionStorage";
import { ApiError, type ApiErrorPayload } from "../../shared/types/api";

interface RequestOptions extends RequestInit {
  tenantSlug?: string;
}

const joinUrl = (path: string): string =>
  `${env.apiBaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const session = loadSession();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  if (options.tenantSlug) headers.set("X-Tenant-Slug", options.tenantSlug);

  const response = await fetch(joinUrl(path), { ...options, headers });
  if (!response.ok) {
    const fallback: ApiErrorPayload = {
      code: response.status === 403 ? "FORBIDDEN" : "SERVER_ERROR",
      message: "Không thể xử lý yêu cầu. Vui lòng thử lại.",
    };
    const problem = (await response.json().catch(() => fallback)) as Partial<ApiErrorPayload>;
    const retryAfterHeader = Number(response.headers.get("Retry-After"));
    const payload: ApiErrorPayload = {
      code: problem.code ?? fallback.code,
      message: problem.message ?? problem.detail ?? fallback.message,
      fieldErrors: problem.fieldErrors,
      retryAfterSeconds:
        problem.retryAfterSeconds ??
        (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : undefined),
      details: problem.details,
    };
    if (response.status === 401 && session) {
      window.dispatchEvent(new CustomEvent("edu-ops:unauthenticated"));
    }
    throw new ApiError(response.status, payload);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const apiDownload = async (path: string, options: RequestOptions = {}): Promise<Blob> => {
  const session = loadSession();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  if (options.tenantSlug) headers.set("X-Tenant-Slug", options.tenantSlug);
  const response = await fetch(joinUrl(path), { ...options, headers });
  if (!response.ok) {
    const fallback: ApiErrorPayload = {
      code: response.status === 403 ? "FORBIDDEN" : "SERVER_ERROR",
      message: "Không thể xuất file. Vui lòng thử lại.",
    };
    const problem = (await response.json().catch(() => fallback)) as Partial<ApiErrorPayload>;
    throw new ApiError(response.status, {
      code: problem.code ?? fallback.code,
      message: problem.message ?? problem.detail ?? fallback.message,
      fieldErrors: problem.fieldErrors,
      details: problem.details,
    });
  }
  return response.blob();
};
