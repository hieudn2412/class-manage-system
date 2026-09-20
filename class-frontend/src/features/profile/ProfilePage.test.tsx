import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { profileRepository } from "../../services/repositories/profileRepository";
import type { SelfProfile } from "../../shared/types/domain";
import { ApiError } from "../../shared/types/api";
import { createTestSession, studentUser } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { ProfilePage } from "./ProfilePage";

const studentProfile: SelfProfile = {
  scope: "TENANT",
  id: "student-1",
  tenant: { id: "tenant-1", slug: "anh-duong", name: "Trung tâm Ánh Dương" },
  profileType: "STUDENT",
  code: "HS-0001",
  username: "hoc.sinh",
  displayName: "Nguyễn Minh Anh",
  email: "minhanh@example.vn",
  roles: ["STUDENT"],
  status: "ACTIVE",
  parentName: "Nguyễn Văn An",
  parentPhone: "0909000000",
  lastLoginAt: "2026-09-19T08:00:00Z",
  createdAt: "2026-09-01T08:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("hồ sơ cá nhân", () => {
  it("hiển thị dữ liệu theo vai trò và đổi mật khẩu thành công", async () => {
    vi.spyOn(profileRepository, "me").mockResolvedValue(studentProfile);
    vi.spyOn(profileRepository, "updateEmail").mockResolvedValue({
      ...studentProfile,
      email: "minh.anh@example.vn",
    });
    vi.spyOn(profileRepository, "changePassword").mockResolvedValue(createTestSession(studentUser));
    const user = userEvent.setup();

    renderWithProviders(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Nguyễn Minh Anh" })).toBeVisible();
    expect(screen.getByText("HS-0001")).toBeVisible();
    expect(screen.getByText("Nguyễn Văn An")).toBeVisible();
    expect(screen.getByText("0909000000")).toBeVisible();

    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "minh.anh@example.vn");
    await user.click(screen.getByRole("button", { name: "Lưu email" }));

    expect(profileRepository.updateEmail).toHaveBeenCalledWith({
      email: "minh.anh@example.vn",
    });
    expect(await screen.findByText("Đã cập nhật email liên hệ.")).toBeVisible();

    await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "123456");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "Student@2026");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "Student@2026");
    await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    expect(profileRepository.changePassword).toHaveBeenCalledWith({
      currentPassword: "123456",
      newPassword: "Student@2026",
    });
    expect(
      await screen.findByText("Đã đổi mật khẩu. Các phiên đăng nhập cũ đã được đăng xuất."),
    ).toBeVisible();
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveValue("");
  });

  it("đưa lỗi mật khẩu hiện tại về đúng trường nhập", async () => {
    vi.spyOn(profileRepository, "me").mockResolvedValue(studentProfile);
    vi.spyOn(profileRepository, "changePassword").mockRejectedValue(
      new ApiError(400, {
        code: "CURRENT_PASSWORD_INVALID",
        message: "Mật khẩu hiện tại chưa đúng.",
        fieldErrors: { currentPassword: "Mật khẩu hiện tại chưa đúng." },
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<ProfilePage />);
    await screen.findByRole("heading", { name: "Hồ sơ cá nhân" });
    await user.type(screen.getByLabelText("Mật khẩu hiện tại"), "mat-khau-sai");
    await user.type(screen.getByLabelText("Mật khẩu mới"), "Student@2026");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "Student@2026");
    await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    expect(await screen.findByText("Mật khẩu hiện tại chưa đúng.")).toBeVisible();
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveAttribute("aria-invalid", "true");
  });
});
