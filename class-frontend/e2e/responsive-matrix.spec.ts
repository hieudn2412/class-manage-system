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
    if (path.endsWith("/accounts") && route.request().method() === "GET") {
      await route.fulfill({
        json: {
          items: [
            {
              id: "account-responsive-1",
              profileType: "TEACHER",
              code: "GV-0099",
              username: "nguyen.huyen.thuc",
              displayName: "Nguyễn Hồng Huyền Thục có tên rất dài",
              email: "huyenthuc@example.com",
              roles: ["TEACHER"],
              status: "ACTIVE",
              passwordState: "READY",
              parentName: null,
              parentPhone: null,
              lastLoginAt: "2026-09-19T08:00:00Z",
              createdAt: "2026-01-01T08:00:00Z",
              version: 0,
            },
            {
              id: "account-responsive-2",
              profileType: "STUDENT",
              code: "HS-0012",
              username: "hoc.sinh.12",
              displayName: "Trần Minh Anh",
              email: null,
              roles: ["STUDENT"],
              status: "ACTIVE",
              passwordState: "READY",
              parentName: "Trần Thu Hà",
              parentPhone: "0900000000",
              lastLoginAt: null,
              createdAt: "2026-02-01T08:00:00Z",
              version: 0,
            },
          ],
          page: 1,
          pageSize: 20,
          totalItems: 2,
          totalPages: 1,
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
              {
                teacherId: "a2000000-0000-0000-0000-000000000002",
                teacherName: "Giáo viên chưa cập nhật email",
                sessionCount: 4,
                totalMinutes: 360,
                accrued: 1600000,
                adjustments: 0,
                due: 1600000,
                paid: 1600000,
                outstanding: 0,
                status: "SETTLED",
                emailAvailable: false,
                lastNotificationStatus: null,
                lastNotificationAt: null,
              },
            ],
            page: 1,
            pageSize: 20,
            totalItems: 2,
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
    if (path.endsWith("/class-scheduling/options") && route.request().method() === "GET") {
      await route.fulfill({
        json: {
          teachers: [{ id: "teacher-responsive-1", name: "Bảo Ngọc", status: "ACTIVE" }],
          rooms: [{ id: "room-responsive-1", code: "P.201", status: "ACTIVE" }],
        },
      });
      return;
    }
    if (path.endsWith("/schedules/management") && route.request().method() === "GET") {
      const createSession = (
        id: string,
        className: string,
        ordinal: number,
        startAt: string,
        scheduleState: "UPCOMING" | "TAUGHT" | "MISSING_CHECK_IN",
      ) => ({
        id,
        classId: `class-${id}`,
        classCode: `HSK-${ordinal}`,
        className,
        ordinal,
        startAt,
        endAt: new Date(Date.parse(startAt) + 90 * 60 * 1000).toISOString(),
        plannedTeacherId: "teacher-responsive-1",
        actualTeacherId: "teacher-responsive-1",
        teacherName: "Bảo Ngọc",
        mode: "ONLINE",
        roomId: null,
        roomName: null,
        onlineUrl: null,
        isSubstitution: false,
        isMakeup: false,
        status: "SCHEDULED",
        scheduleState,
        makeupRootSessionId: null,
        replacesSessionId: null,
        replacementSessionId: null,
        cancellationReason: null,
        allowedActions: [],
        version: 0,
      });
      await route.fulfill({
        json: {
          weekStart: "2026-09-14",
          weekEnd: "2026-09-20",
          sessions: [
            createSession(
              "schedule-responsive-1",
              "HSK 1.1",
              10,
              "2026-09-16T13:45:00.000Z",
              "MISSING_CHECK_IN",
            ),
            createSession(
              "schedule-responsive-2",
              "Giao tiếp sơ cấp",
              6,
              "2026-09-18T11:30:00.000Z",
              "UPCOMING",
            ),
            createSession(
              "schedule-responsive-3",
              "HSK 1.1",
              11,
              "2026-09-19T13:45:00.000Z",
              "TAUGHT",
            ),
          ],
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
  await expect(page.getByText("admin@anhduong.vn").first()).toBeVisible();

  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  const passwordDialog = page.getByRole("dialog", { name: "Đổi mật khẩu" });
  await expect(passwordDialog).toBeVisible();
  await page.getByLabel("Mật khẩu hiện tại").fill("Demo@123");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("NewDemo@2026");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("NewDemo@2026");
  await passwordDialog.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByText(/Các phiên đăng nhập cũ đã được đăng xuất/)).toBeVisible();

  await checkResponsiveShell(page);
});

test("danh sách người dùng giữ bảng ba cột trên mobile", async ({ page }, testInfo) => {
  await page.goto("/t/anh-duong/app/accounts");

  const table = page.getByRole("table", { name: "Danh sách người dùng của trung tâm" });
  await expect(table).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await expect(table.getByRole("columnheader")).toHaveCount(4);
    await expect(table.getByRole("columnheader", { name: /Tên/ })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Chức vụ/ })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Ngày tạo/ })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Xem" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    return;
  }

  await expect(table.getByRole("columnheader")).toHaveCount(3);
  await expect(table.getByRole("columnheader", { name: /Tên/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Chức vụ/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Xem" })).toBeVisible();
  await expect(table.getByText("Giáo viên")).toBeVisible();
  await expect(table.getByText("Học sinh")).toBeVisible();
  await expect(table.getByText("GV-0099")).toHaveCount(0);

  const firstRow = table.locator("tbody tr").first();
  expect(await firstRow.evaluate((element) => getComputedStyle(element).display)).toBe("table-row");
  await table.getByRole("button", { name: /Xem chi tiết Nguyễn Hồng Huyền Thục/ }).click();
  await expect(page.getByRole("dialog", { name: "Thông tin người dùng" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("thời khóa biểu mobile giữ lưới tuần ngang trong vùng cuộn riêng", async ({
  page,
}, testInfo) => {
  await page.goto("/t/anh-duong/app/schedule?week=2026-09-14");
  await expect(page.getByRole("heading", { name: "Thời khóa biểu toàn trung tâm" })).toBeVisible();

  const calendar = page.getByLabel("Thời khóa biểu tuần, có thể cuộn ngang");
  await expect(calendar).toBeVisible();
  await expect(page.getByLabel("Danh sách buổi học theo ngày")).toHaveCount(0);

  if (testInfo.project.name.includes("mobile")) {
    await expect(page.getByText("Vuốt ngang để xem đủ các ngày trong tuần")).toBeVisible();
    const dimensions = await calendar.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    expect(await calendar.evaluate((element) => element.scrollLeft)).toBe(0);
    expect(
      await page
        .locator(".calendar-time")
        .first()
        .evaluate((element) => getComputedStyle(element).position),
    ).toBe("sticky");
    await expect(
      calendar.locator(".calendar-event-mobile-state", { hasText: "Chưa xác nhận" }).first(),
    ).toBeVisible();
    expect(
      await calendar
        .locator(".calendar-event-teacher")
        .evaluateAll((elements) =>
          elements.every((element) => getComputedStyle(element).display === "none"),
        ),
    ).toBe(true);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("chọn giáo viên và gửi thông báo lương trên desktop lẫn mobile", async ({
  page,
}, testInfo) => {
  await page.goto("/t/anh-duong/app/finance/salaries?month=2026-09");
  await expect(page.getByRole("heading", { name: "Lương phát sinh và đã trả" })).toBeVisible();

  if (testInfo.project.name.includes("mobile")) {
    const table = page.getByRole("table", { name: "Danh sách lương giáo viên" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveCount(3);
    await expect(table.getByRole("columnheader", { name: "Giáo viên" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Tổng lương" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Xem" })).toBeVisible();
    expect(
      await table
        .locator("tbody tr")
        .first()
        .evaluate((element) => getComputedStyle(element).display),
    ).toBe("table-row");
    await expect(
      page.getByLabel("Chọn Giáo viên chưa cập nhật email để gửi thông báo lương"),
    ).toBeDisabled();

    await page.getByRole("button", { name: "Chọn tất cả (1)" }).click();
    await expect(
      page.getByLabel("Chọn Nguyễn Thị Huyền có tên rất dài để gửi thông báo lương"),
    ).toBeChecked();

    await table
      .getByRole("button", {
        name: "Xem lương của Nguyễn Thị Huyền có tên rất dài",
      })
      .click();
    const summary = page.getByRole("dialog", { name: "Tóm tắt lương" });
    await expect(summary).toBeVisible();
    await expect(summary.getByText("Còn phải trả")).toBeVisible();
    await expect(summary.getByRole("link", { name: "Xem chi tiết đầy đủ" })).toHaveAttribute(
      "href",
      "/t/anh-duong/app/finance/salaries/a2000000-0000-0000-0000-000000000001?month=2026-09",
    );
    await summary.getByRole("button", { name: "Đóng" }).click();
  } else {
    await page.getByLabel("Chọn Nguyễn Thị Huyền có tên rất dài để gửi thông báo lương").check();
    const desktopTable = page.getByRole("table", { name: "Bảng lương giáo viên" });
    await expect(desktopTable).toBeVisible();
    await expect(desktopTable.getByRole("columnheader", { name: "Cộng hoặc trừ" })).toHaveCount(0);
    await expect(desktopTable.getByRole("columnheader", { name: "Còn lại" })).toHaveCount(0);
    await expect(desktopTable.getByRole("columnheader", { name: "Email thông báo" })).toHaveCount(
      0,
    );
    expect(
      await desktopTable
        .locator("th")
        .evaluateAll((headers) =>
          headers.every((header) => getComputedStyle(header).whiteSpace === "nowrap"),
        ),
    ).toBe(true);
    expect(
      await desktopTable
        .locator(".salary-row-actions")
        .first()
        .evaluate((actions) => getComputedStyle(actions).flexWrap),
    ).toBe("nowrap");

    const toolbarBox = await page.locator(".salary-bulk-toolbar").boundingBox();
    const tableBox = await desktopTable.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(tableBox).not.toBeNull();
    expect((toolbarBox?.y ?? 0) + (toolbarBox?.height ?? 0)).toBeLessThanOrEqual(tableBox?.y ?? 0);
  }

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
