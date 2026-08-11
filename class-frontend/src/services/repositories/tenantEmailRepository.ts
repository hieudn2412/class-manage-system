import type {
  GmailAuthorization,
  TenantEmailConnection,
  TestGmailResult,
} from "../../shared/types/domain";
import { apiRequest } from "../api/apiClient";

const idempotencyKey = (): string => crypto.randomUUID();

export const tenantEmailRepository = {
  status: (tenantSlug: string) =>
    apiRequest<TenantEmailConnection>("tenant-email-connection", { tenantSlug }),

  authorize: (tenantSlug: string) =>
    apiRequest<GmailAuthorization>("tenant-email-connection/oauth-authorizations", {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
    }),

  test: (tenantSlug: string, recipientEmail: string) =>
    apiRequest<TestGmailResult>("tenant-email-connection/test-messages", {
      tenantSlug,
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ recipientEmail }),
    }),

  disconnect: (tenantSlug: string, version: number) =>
    apiRequest<void>(`tenant-email-connection?version=${version}`, {
      tenantSlug,
      method: "DELETE",
    }),
};
