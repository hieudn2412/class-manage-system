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
