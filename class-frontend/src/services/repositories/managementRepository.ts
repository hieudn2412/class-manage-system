import { apiRequest } from "../api/apiClient";
import type { Account, Page, PlatformTenant, ProfileType, Role } from "../../shared/types/domain";

export interface TenantCreateInput {
  name: string;
  slug: string;
  initialAdmin: { username: string; displayName: string; email?: string };
}
export interface AccountInput {
  profileType: ProfileType;
  username: string;
  displayName: string;
  email?: string;
  roles: Role[];
  parentName?: string;
  parentPhone?: string;
}
export const managementRepository = {
  tenants: (query: string) => apiRequest<Page<PlatformTenant>>(`platform/tenants?${query}`),
  createTenant: (input: TenantCreateInput) =>
    apiRequest<{ tenant: PlatformTenant; temporaryPassword: string }>("platform/tenants", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  tenantStatus: (id: string, status: string, reason: string, version: number) =>
    apiRequest<PlatformTenant>(`platform/tenants/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason, version }),
    }),
  initialAdminStatus: (tenantId: string, status: string, reason: string, version: number) =>
    apiRequest(`platform/tenants/${tenantId}/initial-administrator/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason, version }),
    }),
  resetInitialAdmin: (tenantId: string, reason: string, version: number) =>
    apiRequest<{ temporaryPassword: string }>(
      `platform/tenants/${tenantId}/initial-administrator/credential-resets`,
      { method: "POST", body: JSON.stringify({ reason, version }) },
    ),
  accounts: (query: string) => apiRequest<Page<Account>>(`accounts?${query}`),
  account: (id: string) => apiRequest<Account>(`accounts/${id}`),
  createAccount: (input: AccountInput) =>
    apiRequest<{ account: Account; temporaryPassword: string }>("accounts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateAccount: (
    id: string,
    input: Omit<AccountInput, "profileType" | "username"> & { version: number },
  ) => apiRequest<Account>(`accounts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  accountStatus: (id: string, status: string, reason: string, version: number) =>
    apiRequest<Account>(`accounts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason, version }),
    }),
  resetAccount: (id: string, reason: string, version: number) =>
    apiRequest<{ temporaryPassword: string }>(`accounts/${id}/credential-resets`, {
      method: "POST",
      body: JSON.stringify({ reason, version }),
    }),
};
