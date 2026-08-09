import { hasPermission, PERMISSIONS } from "./permissions";

describe("quyền vertical slice lịch lớp", () => {
  it("giới hạn thao tác tạo lớp và override cho Admin/Học vụ", () => {
    expect(hasPermission(["ADMIN"], PERMISSIONS.MANAGE_CLASSES)).toBe(true);
    expect(hasPermission(["ACADEMIC_MANAGER"], PERMISSIONS.MANAGE_SESSION_SCHEDULE)).toBe(true);
    expect(hasPermission(["ACCOUNTANT"], PERMISSIONS.MANAGE_CLASSES)).toBe(false);
    expect(hasPermission(["TEACHER"], PERMISSIONS.MANAGE_SESSION_SCHEDULE)).toBe(false);
  });

  it("cộng quyền cho tài khoản nhiều vai trò nhưng vẫn tách lịch cá nhân", () => {
    expect(hasPermission(["ADMIN", "ACCOUNTANT"], PERMISSIONS.VIEW_MANAGEMENT_SCHEDULE)).toBe(true);
    expect(hasPermission(["TEACHER"], PERMISSIONS.VIEW_OWN_SCHEDULE)).toBe(true);
    expect(hasPermission(["ACCOUNTANT"], PERMISSIONS.VIEW_OWN_SCHEDULE)).toBe(false);
  });

  it("phân quyền quản lý tài khoản theo vai trò", () => {
    expect(hasPermission(["ADMIN"], PERMISSIONS.MANAGE_TENANT_ACCOUNTS)).toBe(true);
    expect(hasPermission(["ACADEMIC_MANAGER"], PERMISSIONS.MANAGE_LEARNING_ACCOUNTS)).toBe(true);
    expect(hasPermission(["ACADEMIC_MANAGER"], PERMISSIONS.MANAGE_TENANT_ACCOUNTS)).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], PERMISSIONS.MANAGE_PLATFORM_TENANTS)).toBe(true);
  });

  it("chỉ cấp không gian học tập của chính học sinh", () => {
    expect(hasPermission(["STUDENT"], PERMISSIONS.VIEW_OWN_LEARNING)).toBe(true);
    expect(hasPermission(["STUDENT"], PERMISSIONS.VIEW_CLASSES)).toBe(false);
    expect(hasPermission(["TEACHER"], PERMISSIONS.VIEW_OWN_LEARNING)).toBe(false);
  });

  it("tách quyền đơn giá, sổ lương và lương cá nhân", () => {
    expect(hasPermission(["ADMIN"], PERMISSIONS.MANAGE_CLASS_RATES)).toBe(true);
    expect(hasPermission(["ACADEMIC_MANAGER"], PERMISSIONS.MANAGE_CLASS_RATES)).toBe(true);
    expect(hasPermission(["ACADEMIC_MANAGER"], PERMISSIONS.VIEW_SALARY)).toBe(false);
    expect(hasPermission(["ACCOUNTANT"], PERMISSIONS.MANAGE_SALARY)).toBe(true);
    expect(hasPermission(["TEACHER"], PERMISSIONS.VIEW_OWN_SALARY)).toBe(true);
    expect(hasPermission(["TEACHER"], PERMISSIONS.VIEW_SALARY)).toBe(false);
  });
});
