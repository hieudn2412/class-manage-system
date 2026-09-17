import AxeBuilder from "@axe-core/playwright";
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
        token: "student-e2e-token",
        scope: "TENANT",
        tenant: tenantData,
        user: {
          id: "student-user",
          tenantId: tenantData.id,
          username: "hs.fl06",
          displayName: "Học sinh FL06",
          roles: ["STUDENT"],
          status: "ACTIVE",
          passwordState: "READY",
        },
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
  }, tenant);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/tenants/anh-duong")) {
      await route.fulfill({ json: tenant });
      return;
    }
    if (path.endsWith("/students/me/classes/accessible-class/sessions")) {
      await route.fulfill({
        json: {
          items: [
            {
              id: "session-1",
              ordinal: 1,
              startAt: "2026-08-04T19:00:00+07:00",
              endAt: "2026-08-04T20:30:00+07:00",
              status: "COMPLETED",
              teacherName: "Cô Lan",
              lessonName: "Phân số",
              lessonContent: "Ôn tập và luyện tập phân số.",
              attendanceStatus: "PRESENT",
              attendanceNote: "Đúng giờ",
              recordUrl: "https://record.example/session-1",
              comment: "Tham gia tích cực.",
              testResult: {
                id: "result-1",
                testName: "Kiểm tra phân số",
                score: 8.5,
                maxScore: 10,
                testDate: "2026-08-04",
                comment: "Nắm bài tốt",
                testComment: "Ôn lại phần quy đồng mẫu số",
              },
            },
          ],
          page: 1,
          pageSize: 100,
          totalItems: 1,
          totalPages: 1,
        },
      });
      return;
    }
    if (path.endsWith("/students/me/classes/accessible-class")) {
      await route.fulfill({
        json: {
          id: "accessible-class",
          code: "CLS-001",
          name: "Toán đang học",
          description: "Lớp luyện tư duy",
          teacherName: "Cô Lan",
          scheduleSummary: "Thứ 3 19:00",
          status: "Active",
          completedSessions: 1,
          totalSessions: 12,
          expectedEndDate: "2026-10-01",
        },
      });
      return;
    }
    if (path.endsWith("/students/me/classes")) {
      await route.fulfill({
        json: {
          items: [
            {
              id: "accessible-class",
              code: "CLS-001",
              name: "Toán đang học",
              teacherName: "Cô Lan",
              scheduleSummary: "Thứ 3 19:00",
              status: "Active",
              access: "Accessible",
              effectiveFrom: "2026-08-01",
              effectiveTo: null,
              completedSessions: 1,
              totalSessions: 12,
              expectedEndDate: "2026-10-01",
            },
            {
              id: "locked-class",
              code: "CLS-002",
              name: "Văn lịch sử",
              teacherName: "Thầy Nam",
              scheduleSummary: "Thứ 5 19:00",
              status: "Closed",
              access: "Locked",
              effectiveFrom: "2026-05-01",
              effectiveTo: "2026-07-01",
              completedSessions: 12,
              totalSessions: 12,
              expectedEndDate: "2026-07-01",
            },
          ],
          page: 1,
          pageSize: 12,
          totalItems: 2,
          totalPages: 1,
        },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND", message: "Not found" } });
  });
});

test("Lớp của tôi tách lớp mở/khóa và không lộ link nội dung", async ({ page }) => {
  await page.goto("/t/anh-duong/app/learning-classes");
  await expect(page.getByRole("heading", { name: "Lớp của tôi" })).toBeVisible();
  const accessibleLink = page.getByRole("link", { name: "Mở lớp Toán đang học" });
  await expect(accessibleLink).toHaveAttribute(
    "href",
    "/t/anh-duong/app/learning-classes/accessible-class",
  );
  const lockedCard = page
    .locator(".learning-class-card.is-locked")
    .filter({ hasText: "Văn lịch sử" });
  await expect(lockedCard).toBeVisible();
  await expect(lockedCard.getByRole("link")).toHaveCount(0);

  const listA11y = await new AxeBuilder({ page }).analyze();
  expect(
    listA11y.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);

  await accessibleLink.click();
  await expect(page.getByRole("heading", { name: "Toán đang học" })).toBeVisible();
  await expect(page.getByText("Ôn tập và luyện tập phân số.")).toBeVisible();
  await expect(page.getByText("Có mặt")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kiểm tra phân số" })).toBeVisible();
  await expect(page.getByText("8,5")).toBeVisible();
  await expect(page.getByText("Nắm bài tốt")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mở bản ghi buổi học/ })).toHaveAttribute(
    "href",
    "https://record.example/session-1",
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const detailA11y = await new AxeBuilder({ page }).analyze();
  expect(
    detailA11y.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
});
