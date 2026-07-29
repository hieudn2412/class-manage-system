import type { AuthSession, Tenant, User } from "../shared/types/domain";

export const tenantAnhDuong: Tenant = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "anh-duong",
  name: "Trung tâm Ánh Dương",
  status: "ACTIVE",
};

export const adminUser: User = {
  id: "a0000000-0000-0000-0000-000000000001",
  tenantId: tenantAnhDuong.id,
  username: "admin.anhduong",
  displayName: "Nguyễn Minh Admin",
  roles: ["ADMIN"],
  status: "ACTIVE",
  passwordState: "READY",
};

export const studentUser: User = {
  id: "a0000000-0000-0000-0000-000000000006",
  tenantId: tenantAnhDuong.id,
  username: "hs.minhanh",
  displayName: "Lê Minh Anh",
  roles: ["STUDENT"],
  status: "ACTIVE",
  passwordState: "READY",
};

export const firstLoginUser: User = {
  ...adminUser,
  id: "a0000000-0000-0000-0000-000000000009",
  username: "first.login",
  displayName: "Bùi Gia Hân",
  roles: ["ACADEMIC_MANAGER"],
  passwordState: "MUST_CHANGE",
};

export const createTestSession = (user: User = adminUser): AuthSession => ({
  token: `test-token-${user.username}`,
  user,
  tenant: tenantAnhDuong,
  expiresAt: "2026-07-26T00:00:00Z",
});
