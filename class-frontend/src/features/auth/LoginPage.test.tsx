import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { renderWithProviders } from "../../test/render";
import { authRepository } from "../../services/repositories/authRepository";
import { ApiError } from "../../shared/types/api";
import { adminUser, createTestSession, firstLoginUser, tenantAnhDuong } from "../../test/fixtures";
import { ChangePasswordPage } from "./ChangePasswordPage";
import { LoginPage } from "./LoginPage";

const AuthTestRoutes = () => (
  <Routes>
    <Route
      path="/t/:tenantSlug"
      element={
        <TenantProvider>
          <Outlet />
        </TenantProvider>
      }
    >
      <Route path="login" element={<LoginPage />} />
      <Route path="change-password" element={<ChangePasswordPage />} />
      <Route path="app" element={<div>Trang ứng dụng đã đăng nhập</div>} />
    </Route>
  </Routes>
);

describe("WF-01 đăng nhập", () => {
  beforeEach(() => {
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(authRepository, "login").mockImplementation(({ username, password }) => {
      if (password !== "Demo@123") {
        return Promise.reject(
          new ApiError(401, {
            code: "INVALID_CREDENTIALS",
            message: "Tên đăng nhập hoặc mật khẩu không đúng.",
          }),
        );
      }
      return Promise.resolve(
        createTestSession(username === "first.login" ? firstLoginUser : adminUser),
      );
    });
  });

  it("đăng nhập thành công và chuyển vào ứng dụng", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthTestRoutes />, ["/t/anh-duong/login"]);

    await screen.findByRole("heading", { name: "Đăng nhập an toàn" });
    await user.click(screen.getByRole("button", { name: /Đăng nhập/i }));

    expect(await screen.findByText("Trang ứng dụng đã đăng nhập")).toBeInTheDocument();
  });

  it("hiển thị lỗi đăng nhập mà không tiết lộ tài khoản", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthTestRoutes />, ["/t/anh-duong/login"]);

    const password = await screen.findByLabelText("Mật khẩu");
    await user.clear(password);
    await user.type(password, "SaiMatKhau");
    await user.click(screen.getByRole("button", { name: /Đăng nhập/i }));

    expect(await screen.findByText("Tên đăng nhập hoặc mật khẩu không đúng.")).toBeInTheDocument();
  });

  it("bắt buộc đổi mật khẩu tạm trước khi vào ứng dụng", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthTestRoutes />, ["/t/anh-duong/login"]);

    const username = await screen.findByLabelText("Tên đăng nhập");
    await user.clear(username);
    await user.type(username, "first.login");
    await user.click(screen.getByRole("button", { name: /Đăng nhập/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Tạo mật khẩu của bạn" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Phiên hiện tại chỉ có quyền đổi mật khẩu.")).toBeInTheDocument();
  });
});
