import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const login = async (
  page: Page,
  username = "admin.anhduong",
  password = "Demo@123",
  navigate = true,
) => {
  if (navigate) await page.goto("/t/anh-duong/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: /^Đăng nhập/ }).click();
  await page.waitForFunction(() => Boolean(sessionStorage.getItem("edu-ops:session")));
  const storedUsername = await page.evaluate(() => {
    const raw = sessionStorage.getItem("edu-ops:session");
    return raw ? (JSON.parse(raw) as { user: { username: string } }).user.username : "";
  });
  expect(storedUsername).toBe(username);
  await expect(page).toHaveURL(/\/t\/anh-duong\/app(?:\/|$)/);
};

test("Admin tạo lớp, công bố, override và giáo viên thấy lịch mới", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Luồng đầy đủ chạy ở desktop.");
  await login(page);
  await page.getByRole("link", { name: "Danh sách lớp" }).click();
  await page.getByRole("link", { name: "Tạo lớp" }).click();

  await page.getByLabel("Tên lớp *").fill("Kỹ năng giải toán 6");
  await page.getByLabel("Giáo viên chính *").selectOption({ label: "Cô Nguyễn Ngọc Lan" });
  await page.getByLabel("Ngày bắt đầu *").fill("2026-08-04");
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("heading", { name: "Chọn học sinh tham gia" })).toBeVisible();
  await page
    .getByRole("list", { name: "Học sinh có thể chọn" })
    .locator(".student-option")
    .filter({ hasText: "Lê Minh Anh" })
    .getByRole("button", { name: "Chọn" })
    .click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await page.getByRole("button", { name: "Thêm ca", exact: true }).click();
  await page.getByLabel("Thứ *").selectOption("2");
  await page.getByLabel("Bắt đầu *").fill("17:00");
  await page.getByLabel("Kết thúc *").fill("18:30");
  await page.getByLabel("Hình thức *").selectOption("ONLINE");
  await expect(page.getByLabel("Link online *")).toHaveCount(0);
  await page.getByLabel("Hình thức *").selectOption("IN_PERSON");
  await page.getByLabel("Phòng *").selectOption({ label: "P102 · 18 chỗ" });
  await page.getByRole("button", { name: "Xem trước lịch" }).click();

  await expect(page.getByText("Số buổi đã sinh")).toBeVisible();
  await expect(page.getByText("Không xung đột")).toBeVisible();
  await page.getByRole("button", { name: "Công bố lớp" }).click();
  const publishDialog = page.getByRole("dialog", { name: "Xác nhận công bố lớp" });
  await publishDialog.getByRole("button", { name: "Công bố lớp" }).click();

  await expect(page.getByRole("heading", { name: "Thời khóa biểu toàn trung tâm" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mở buổi Kỹ năng giải toán 6/ })).toBeVisible();
  await page.getByRole("button", { name: /Mở buổi Kỹ năng giải toán 6/ }).click();
  await page.getByRole("button", { name: "Điều chỉnh hình thức / phòng" }).click();
  const overrideDialog = page.getByRole("dialog", {
    name: "Điều chỉnh một buổi đã công bố",
  });
  await overrideDialog.getByLabel("Hình thức").selectOption("ONLINE");
  await expect(overrideDialog.getByLabel("Link online")).toHaveCount(0);
  await overrideDialog.getByRole("button", { name: "Kiểm tra thay đổi" }).click();
  await expect(overrideDialog.getByText("Không có xung đột. Có thể lưu thay đổi.")).toBeVisible();
  await overrideDialog.getByRole("button", { name: "Lưu thay đổi" }).click();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await login(page, "gv.lan", "Demo@123", false);
  await page.getByRole("button", { name: /Tuần sau/ }).click();
  await page.getByRole("button", { name: /Tuần sau/ }).click();
  await expect(page.getByRole("button", { name: /Mở buổi Kỹ năng giải toán 6/ })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
});

test("Giáo viên không thể truy cập tạo lớp và lịch mobile không overflow toàn trang", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Kiểm tra ở viewport mobile.");
  await login(page, "gv.lan");
  await page.goto("/t/anh-duong/app/classes/new");
  await expect(page.getByRole("heading", { name: "Bạn không có quyền truy cập" })).toBeVisible();

  await page.goto("/t/anh-duong/app/teaching-schedule?week=2026-07-20");
  await expect(page.getByRole("heading", { name: "Lịch dạy của tôi" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
