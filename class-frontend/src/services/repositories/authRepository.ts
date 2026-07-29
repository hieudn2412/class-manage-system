import { apiRequest } from "../api/apiClient";
import type { AuthSession, Tenant } from "../../shared/types/domain";

export interface LoginInput {
  tenantSlug: string;
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  tenantSlug: string;
  newPassword: string;
}

export interface AuthRepository {
  getTenant(slug: string): Promise<Tenant>;
  login(input: LoginInput): Promise<AuthSession>;
  forgotPassword(tenantSlug: string, username: string): Promise<{ message: string }>;
  changePassword(input: ChangePasswordInput): Promise<AuthSession>;
}

export const authRepository: AuthRepository = {
  getTenant: (slug) => apiRequest<Tenant>(`tenants/${slug}`),
  login: ({ tenantSlug, username, password }) =>
    apiRequest<AuthSession>("auth/login", {
      method: "POST",
      tenantSlug,
      body: JSON.stringify({ tenantSlug, username, password }),
    }),
  forgotPassword: (tenantSlug, username) =>
    apiRequest<{ message: string }>("auth/forgot-password", {
      method: "POST",
      tenantSlug,
      body: JSON.stringify({ tenantSlug, username }),
    }),
  changePassword: ({ tenantSlug, newPassword }) =>
    apiRequest<AuthSession>("auth/change-password", {
      method: "POST",
      tenantSlug,
      body: JSON.stringify({ newPassword }),
    }),
};
