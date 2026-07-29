import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { saveSession } from "../shared/lib/sessionStorage";
import { PERMISSIONS } from "../shared/lib/permissions";
import { renderWithProviders } from "../test/render";
import { RequireAuth, RequirePermission } from "./guards";
import { createTestSession, studentUser } from "../test/fixtures";

describe("auth và role guards", () => {
  it("chuyển người chưa đăng nhập về trang đăng nhập", async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/t/:tenantSlug/app"
          element={
            <RequireAuth>
              <div>Dữ liệu riêng tư</div>
            </RequireAuth>
          }
        />
        <Route path="/t/:tenantSlug/login" element={<div>Màn đăng nhập</div>} />
      </Routes>,
      ["/t/anh-duong/app"],
    );

    expect(await screen.findByText("Màn đăng nhập")).toBeInTheDocument();
    expect(screen.queryByText("Dữ liệu riêng tư")).not.toBeInTheDocument();
  });

  it("chuyển vai trò không đúng sang 403", async () => {
    saveSession(createTestSession(studentUser), false);

    renderWithProviders(
      <Routes>
        <Route
          path="/t/:tenantSlug/app/classes"
          element={
            <RequirePermission permission={PERMISSIONS.VIEW_CLASSES}>
              <div>Danh sách lớp quản lý</div>
            </RequirePermission>
          }
        />
        <Route path="/t/:tenantSlug/403" element={<div>Không có quyền</div>} />
      </Routes>,
      ["/t/anh-duong/app/classes"],
    );

    expect(await screen.findByText("Không có quyền")).toBeInTheDocument();
  });
});
