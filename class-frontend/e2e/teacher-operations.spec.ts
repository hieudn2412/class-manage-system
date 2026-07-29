import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const loginTeacher = async (page: Page) => {
  await page.goto("/t/anh-duong/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.lan");
  await page.getByLabel("Mật khẩu").fill("Demo@123");
  await page.getByRole("button", { name: /^Đăng nhập/ }).click();
  await expect(page).toHaveURL(/\/t\/anh-duong\/app\/teacher-dashboard$/);
};

test("Giáo viên đi từ dashboard đến check-in và lưu hồ sơ bằng API thật", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Luồng ghi dữ liệu chỉ chạy ở desktop.");
  await loginTeacher(page);

  await expect(page.getByRole("heading", { name: /Chào Cô Nguyễn Ngọc Lan/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Buổi dạy hôm nay" })).toBeVisible();
  await page.getByRole("button", { name: "Vào check-in" }).click();

  await expect(page.getByRole("heading", { name: /Toán tư duy 4A · Buổi/ })).toBeVisible();
  const checkInButton = page.getByRole("button", { name: "Check-in dạy" });
  if (await checkInButton.isVisible()) {
    await checkInButton.click();
    const dialog = page.getByRole("dialog", { name: "Check-in buổi dạy" });
    await expect(dialog.getByLabel("Link dạy Online")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Xác nhận check-in" }).click();
    await expect(page.getByText("Check-in thành công.")).toBeVisible();
  }

  await page.getByLabel("Tên bài học").fill("Phân số và so sánh");
  await page.getByLabel("Nội dung thực dạy").fill("Ôn tập quy đồng và so sánh phân số.");
  await page.getByLabel("Link record").fill("https://youtube.com/watch?v=demo");
  const firstStudent = page.locator(".student-record-card").first();
  await firstStudent.getByLabel("Trạng thái đi học").selectOption("PRESENT");
  await firstStudent.getByLabel("Nhận xét buổi học").fill("Tập trung và hoàn thành bài trên lớp.");
  await page.getByRole("button", { name: "Lưu hồ sơ buổi" }).click();
  await expect(page.getByText("Đã lưu điểm danh và hồ sơ buổi học.")).toBeVisible();

  await firstStudent.getByRole("button", { name: "Thêm điểm kiểm tra" }).click();
  const testDialog = page.getByRole("dialog", { name: /Thêm điểm kiểm tra/ });
  await testDialog.getByLabel("Tên bài kiểm tra").fill("Kiểm tra nhanh phân số");
  await testDialog.getByLabel("Điểm đạt").fill("8.5");
  await testDialog.getByLabel("Điểm tối đa").fill("10");
  await testDialog.getByRole("button", { name: "Lưu điểm" }).click();
  await expect(page.getByText("Đã lưu điểm kiểm tra.")).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
});

test("Lớp của tôi và workspace buổi không overflow ở mobile 390px", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Kiểm tra ở viewport mobile.");
  await loginTeacher(page);
  await page.getByRole("button", { name: "Lớp của tôi" }).click();
  await expect(page.getByRole("heading", { name: "Lớp của tôi" })).toBeVisible();
  await page.getByLabel("Tìm theo tên hoặc mã lớp").fill("Toán tư duy 4A");
  await page.getByRole("button", { name: "Xem lịch sử buổi" }).click();
  await expect(page.getByRole("heading", { name: "Toán tư duy 4A" })).toBeVisible();
  await page.getByRole("button", { name: "Xem buổi" }).first().click();
  await expect(page.getByRole("heading", { name: /Toán tư duy 4A · Buổi/ })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
