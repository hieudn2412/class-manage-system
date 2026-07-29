import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const login = async (page: Page) => {
  await page.goto("/t/anh-duong/login");
  await page.getByRole("button", { name: /Đăng nhập/i }).click();
  await expect(page.getByRole("heading", { name: /Chào buổi sáng/ })).toBeVisible();
};

test("đăng nhập và xem dashboard ở desktop", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("desktop"),
    "Chỉ chạy kiểm tra desktop ở project desktop.",
  );
  await login(page);
  await expect(page.getByRole("heading", { name: "Việc cần xử lý" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trạng thái lớp" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

test("dashboard và menu hoạt động tại viewport mobile 390px", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("mobile"),
    "Chỉ chạy kiểm tra mobile ở project mobile.",
  );
  await login(page);
  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(page.getByRole("complementary", { name: "Điều hướng chính" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("danh sách lớp chuyển thành card tại viewport mobile 390px", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Card lớp được kiểm tra ở project mobile.");
  await login(page);
  await page.goto("/t/anh-duong/app/classes?month=2026-08");
  await expect(page.getByText("Tiếng Anh nền tảng A1")).toBeVisible();

  const firstClass = page.locator(".class-list-table tbody tr").first();
  await expect(firstClass).toBeVisible();
  expect(await firstClass.evaluate((element) => getComputedStyle(element).display)).toBe("grid");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("lọc lớp và mở chi tiết", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("desktop"),
    "Bảng lớp chi tiết được kiểm tra ở project desktop.",
  );
  await login(page);
  await page.goto("/t/anh-duong/app/classes?month=2026-08");
  await page.getByLabel("Tìm kiếm").fill("Tiếng Anh nền tảng");
  await expect(page.getByText("Tiếng Anh nền tảng A1")).toBeVisible();
  await page.getByRole("link", { name: "Xem chi tiết lớp Tiếng Anh nền tảng A1" }).click();
  await expect(page.getByRole("heading", { name: "Tiếng Anh nền tảng A1" })).toBeVisible();
  await expect(page.getByText("Thông tin vận hành")).toBeVisible();
});

test("quên mật khẩu không tiết lộ tài khoản", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Luồng auth chạy một lần ở desktop.");
  await page.goto("/t/anh-duong/forgot-password");
  await page.getByLabel("Tên đăng nhập").fill("tai-khoan-khong-ton-tai");
  await page.getByRole("button", { name: "Gửi hướng dẫn đặt lại" }).click();
  await expect(page.getByText(/Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu/)).toBeVisible();
});

test("tài khoản mật khẩu tạm phải đổi trước khi vào ứng dụng", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Luồng auth chạy một lần ở desktop.");
  await page.goto("/t/anh-duong/login");
  await page.getByLabel("Tên đăng nhập").fill("first.login");
  await page.getByLabel("Mật khẩu").fill("Demo@123");
  await page.getByRole("button", { name: /^Đăng nhập/ }).click();
  await expect(page.getByRole("heading", { name: "Tạo mật khẩu của bạn" })).toBeVisible();
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("NewDemo@123");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("NewDemo@123");
  await page.getByRole("button", { name: "Đổi mật khẩu và tiếp tục" }).click();
  await expect(page.getByRole("heading", { name: /Chào buổi sáng/ })).toBeVisible();
});
