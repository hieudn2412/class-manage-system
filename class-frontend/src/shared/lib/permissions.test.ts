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
});
