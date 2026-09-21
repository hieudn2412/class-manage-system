import { expect, test } from "@playwright/test";

const tenant = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "anh-duong",
  name: "Trung tâm Ánh Dương",
  status: "ACTIVE",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((tenantData) => {
    localStorage.setItem(
      "edu-ops:session",
      JSON.stringify({
        token: "pending-confirmations-e2e-token",
        scope: "TENANT",
        tenant: tenantData,
        user: {
          id: "admin-user",
          tenantId: tenantData.id,
          username: "admin.anhduong",
          displayName: "Admin Ánh Dương",
          roles: ["ADMIN"],
          status: "ACTIVE",
          passwordState: "READY",
        },
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
  }, tenant);

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/tenants/anh-duong")) {
      await route.fulfill({ json: tenant });
      return;
    }
    if (url.pathname.endsWith("/dashboard/pending-confirmations")) {
      await route.fulfill({
        json: {
          items: [
            {
              id: "session-1",
              classId: "class-1",
              classCode: "HSK-11",
              className: "HSK 1.1",
              ordinal: 3,
              startAt: "2026-09-17T13:45:00Z",
              endAt: "2026-09-17T15:15:00Z",
              teacherId: "teacher-1",
              teacherName: "Bảo Ngọc",
              mode: "IN_PERSON",
              roomName: "Phòng 101",
            },
          ],
          page: 1,
          pageSize: 15,
          totalItems: 1,
          totalPages: 1,
        },
      });
      return;
    }
    if (url.pathname.endsWith("/dashboard")) {
      await route.fulfill({
        json: {
          date: "2026-09-17",
          greetingName: "Admin Ánh Dương",
          kpis: [
            {
              id: "verify",
              label: "Chờ xác nhận đã dạy",
              value: "01",
              detail: "Chưa xác nhận buổi dạy",
              delta: "!",
            },
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

test("mở danh sách từ Tổng quan, lọc và sắp xếp bằng tiêu đề cột", async ({ page }) => {
  await page.goto("/t/anh-duong/app/dashboard");
  await page.getByRole("button", { name: /Chờ xác nhận đã dạy: 01/ }).click();
  await expect(page).toHaveURL(/dashboard\/pending-confirmations/);
  await expect(page.getByRole("heading", { name: "Buổi chờ xác nhận đã dạy" })).toBeVisible();

  const sortedRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname.endsWith("/dashboard/pending-confirmations") &&
      url.searchParams.get("sort") === "className" &&
      url.searchParams.get("direction") === "asc"
    );
  });
  await page.getByRole("button", { name: /Lớp học: nhấn để sắp xếp/ }).click();
  await sortedRequest;

  await page.getByLabel("Hình thức", { exact: true }).selectOption("IN_PERSON");
  await expect(page).toHaveURL(/mode=IN_PERSON/);
  await page.getByRole("radio", { name: "Chọn HSK 1.1, buổi 3" }).check();
  await expect(page.getByRole("button", { name: "Xử lý buổi đã chọn" })).toBeEnabled();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
