import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const tenant = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "anh-duong",
  name: "Trung tâm Ánh Dương có tên dài để kiểm tra giao diện",
  status: "ACTIVE",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((tenantData) => {
    if (localStorage.getItem("edu-ops:session")) return;
    localStorage.setItem(
      "edu-ops:session",
      JSON.stringify({
        token: "responsive-e2e-token",
        scope: "TENANT",
        tenant: tenantData,
        user: {
          id: "admin-user",
          tenantId: tenantData.id,
          username: "admin.anhduong",
          displayName: "Quản trị viên Ánh Dương có tên rất dài",
          roles: ["ADMIN"],
          status: "ACTIVE",
          passwordState: "READY",
        },
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
  }, tenant);

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/tenants/anh-duong")) {
      await route.fulfill({ json: tenant });
      return;
    }
    if (path.endsWith("/dashboard")) {
      await route.fulfill({
        json: {
          date: "2026-09-17",
          greetingName: "Quản trị viên Ánh Dương có tên rất dài",
          kpis: [
            { id: "classes", label: "Lớp có buổi hôm nay", value: "12", detail: "12 buổi" },
            {
              id: "verify",
              label: "Chờ xác nhận đã dạy",
              value: "04",
              detail: "Chưa xác nhận buổi dạy",
            },
            { id: "records", label: "Buổi thiếu hồ sơ", value: "02", detail: "Cần bổ sung" },
            { id: "attendance", label: "Chuyên cần tháng", value: "96%", detail: "Ổn định" },
          ],
          attentionItems: [],
          classStates: [],
        },
      });
      return;
    }
    if (path.endsWith("/profile/me/password") && route.request().method() === "PUT") {
      await route.fulfill({
        json: {
          token: "responsive-e2e-token-new",
          scope: "TENANT",
          tenant,
          user: {
            id: "admin-user",
            tenantId: tenant.id,
            username: "admin.anhduong",
            displayName: "Quản trị viên Ánh Dương có tên rất dài",
            roles: ["ADMIN"],
            status: "ACTIVE",
            passwordState: "READY",
          },
          expiresAt: "2099-01-01T00:00:00Z",
        },
      });
      return;
    }
    if (path.endsWith("/profile/me")) {
      await route.fulfill({
        json: {
          scope: "TENANT",
          id: "admin-user",
          tenant,
          profileType: "STAFF",
          code: null,
          username: "admin.anhduong",
          displayName: "Quản trị viên Ánh Dương có tên rất dài",
          email: "admin@anhduong.vn",
          roles: ["ADMIN"],
          status: "ACTIVE",
          parentName: null,
          parentPhone: null,
          lastLoginAt: "2026-09-19T08:00:00Z",
          createdAt: "2026-01-01T08:00:00Z",
        },
      });
      return;
    }
    if (path.endsWith("/salary/payroll") && route.request().method() === "GET") {
      await route.fulfill({
        json: {
          month: "2026-09",
          metrics: {
            teacherCount: 1,
            sessionCount: 8,
            totalMinutes: 720,
            accrued: 3200000,
            adjustments: 200000,
            due: 3400000,
            paid: 0,
            outstanding: 3400000,
            overpaidTeachers: 0,
          },
          teachers: {
            items: [
              {
                teacherId: "a2000000-0000-0000-0000-000000000001",
                teacherName: "Nguyễn Thị Huyền có tên rất dài",
                sessionCount: 8,
                totalMinutes: 720,
                accrued: 3200000,
                adjustments: 200000,
                due: 3400000,
                paid: 0,
                outstanding: 3400000,
                status: "OWED",
                emailAvailable: true,
                lastNotificationStatus: null,
                lastNotificationAt: null,
              },
            ],
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
          },
        },
      });
      return;
    }
    if (path.endsWith("/salary/payroll-notifications") && route.request().method() === "POST") {
      await route.fulfill({
        status: 202,
        json: {
          queuedCount: 1,
          queued: [
            {
              teacherId: "a2000000-0000-0000-0000-000000000001",
              teacherName: "Nguyễn Thị Huyền có tên rất dài",
              notificationId: "b2000000-0000-0000-0000-000000000001",
            },
          ],
          skipped: [],
        },
      });
      return;
    }
    if (path.endsWith("/teachers/me/salary") && route.request().method() === "GET") {
      await route.fulfill({
        json: {
          month: "2026-09",
          teacherId: "a2000000-0000-0000-0000-000000000001",
          teacherName: "Nguyễn Thị Huyền có tên rất dài",
          metrics: {
            sessionCount: 8,
            totalMinutes: 720,
            accrued: 3200000,
            adjustments: 200000,
            due: 3400000,
            paid: 1000000,
            outstanding: 2400000,
            status: "OWED",
          },
          accruals: [
            {
              id: "accrual-responsive-1",
              sessionId: "session-responsive-1",
              classCode: "TOAN-RESPONSIVE",
              className: "Lớp Toán tư duy nâng cao có tên rất dài",
              ordinal: 8,
              sessionDate: "2026-09-17",
              scheduledMinutes: 90,
              hourlyRate: 266667,
              amount: 400000,
              revision: 2,
              status: "ACTIVE",
              substitution: false,
            },
          ],
          adjustments: [],
          payments: [],
        },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND", message: "Không tìm thấy." } });
  });
});

const checkResponsiveShell = async (page: Page) => {
  const viewportWidth = page.viewportSize()?.width ?? 1440;
  const menuButton = page.getByRole("button", { name: "Mở menu" });
  if (viewportWidth < 1024) {
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("complementary", { name: "Điều hướng chính" })).toBeInViewport();
    await page.keyboard.press("Escape");
  } else {
    await expect(menuButton).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Điều hướng chính" })).toBeInViewport();
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
};

test("không tràn ngang, menu thích ứng và không có lỗi accessibility nghiêm trọng", async ({
  page,
}) => {
  await page.goto("/t/anh-duong/app/dashboard");
  await expect(page.getByRole("heading", { name: /Chào buổi/ })).toBeVisible();
  await checkResponsiveShell(page);
});

test("menu quản trị hệ thống thích ứng ở mọi kích thước", async ({ page }) => {
  await page.goto("/platform/login");
  await page.evaluate(() => {
    localStorage.setItem(
      "edu-ops:session",
      JSON.stringify({
        token: "platform-responsive-e2e-token",
        scope: "PLATFORM",
        tenant: null,
        user: {
          id: "platform-admin",
          tenantId: null,
          username: "superadmin",
          displayName: "Quản trị viên hệ thống có tên dài",
          roles: ["SUPER_ADMIN"],
          status: "ACTIVE",
          passwordState: "READY",
        },
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
  });
  await page.route("**/api/v1/platform/tenants**", async (route) => {
    await route.fulfill({
      json: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });
  await page.goto("/platform/app/tenants");
  await expect(page.getByRole("heading", { name: "Trung tâm trên hệ thống" })).toBeVisible();
  await checkResponsiveShell(page);
});

test("hồ sơ cá nhân và biểu mẫu đổi mật khẩu thích ứng ở mọi kích thước", async ({ page }) => {
  await page.goto("/t/anh-duong/app/profile");
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
  await expect(page.getByText("admin@anhduong.vn")).toBeVisible();

  await page.getByLabel("Mật khẩu hiện tại").fill("Demo@123");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("NewDemo@2026");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("NewDemo@2026");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByText(/Các phiên đăng nhập cũ đã được đăng xuất/)).toBeVisible();

  await checkResponsiveShell(page);
});

test("chọn giáo viên và gửi thông báo lương trên desktop lẫn mobile", async ({ page }) => {
  await page.goto("/t/anh-duong/app/finance/salaries?month=2026-09");
  await expect(page.getByRole("heading", { name: "Lương phát sinh và đã trả" })).toBeVisible();
  await page.getByLabel("Chọn Nguyễn Thị Huyền có tên rất dài để gửi thông báo lương").check();
  await page.getByRole("button", { name: /Gửi thông báo lương/ }).click();
  await expect(page.getByRole("heading", { name: "Gửi thông báo lương" })).toBeVisible();
  await page.getByLabel(/Ngày dự kiến thanh toán/).fill("2026-10-15");
  await page.getByLabel(/Ghi chú liên hệ/).fill("Vui lòng liên hệ phòng kế toán nếu cần hỗ trợ.");
  await page.getByRole("button", { name: "Gửi thông báo", exact: true }).click();
  await expect(page.getByText("Đã đưa 1 email vào hàng đợi.")).toBeVisible();

  await checkResponsiveShell(page);
});

test("phiếu lương cá nhân thích ứng và không tràn ngang", async ({ page }) => {
  await page.goto("/t/anh-duong/login");
  await page.evaluate((tenantData) => {
    localStorage.setItem(
      "edu-ops:session",
      JSON.stringify({
        token: "teacher-responsive-e2e-token",
        scope: "TENANT",
        tenant: tenantData,
        user: {
          id: "teacher-responsive-user",
          tenantId: tenantData.id,
          username: "teacher.responsive",
          displayName: "Nguyễn Thị Huyền có tên rất dài",
          roles: ["TEACHER"],
          status: "ACTIVE",
          passwordState: "READY",
        },
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
  }, tenant);
  await page.goto("/t/anh-duong/app/my-salary");

  await expect(page.getByRole("heading", { name: "Giờ dạy và lương của tôi" })).toBeVisible();
  await expect(page.getByText("Còn được thanh toán")).toBeVisible();
  await expect(page.locator(".my-salary-metrics > div")).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: "Lớp Toán tư duy nâng cao có tên rất dài" }),
  ).toBeVisible();

  const salaryCardOverflow = await page.locator(".salary-line").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return Math.max(0, rect.right - document.documentElement.clientWidth);
  });
  expect(salaryCardOverflow).toBeLessThanOrEqual(1);
  await checkResponsiveShell(page);
});
