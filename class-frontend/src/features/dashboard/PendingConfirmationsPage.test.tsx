import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { dashboardRepository } from "../../services/repositories/dashboardRepository";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { DashboardPage } from "./DashboardPage";
import { PendingConfirmationsPage } from "./PendingConfirmationsPage";

const SessionTarget = () => {
  const location = useLocation();
  return <div>Đã mở buổi{location.search}</div>;
};

const routes = (dashboardElement: React.ReactNode) => (
  <Routes>
    <Route
      path="/t/:tenantSlug/app"
      element={
        <TenantProvider>
          <Outlet />
        </TenantProvider>
      }
    >
      <Route path="dashboard" element={dashboardElement} />
      <Route path="dashboard/pending-confirmations" element={<PendingConfirmationsPage />} />
      <Route path="sessions/:sessionId" element={<SessionTarget />} />
    </Route>
  </Routes>
);

afterEach(() => vi.restoreAllMocks());

describe("các buổi chờ xác nhận đã dạy", () => {
  it("mở danh sách khi nhấn vào ô thống kê trên Tổng quan", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(dashboardRepository, "getManagementDashboard").mockResolvedValue({
      date: "2026-09-17",
      greetingName: "Admin Ánh Dương",
      kpis: [
        {
          id: "verify",
          label: "Chờ xác nhận đã dạy",
          value: "04",
          detail: "Chưa xác nhận buổi dạy",
          delta: "!",
        },
      ],
      attentionItems: [],
      classStates: [],
    });
    vi.spyOn(dashboardRepository, "getPendingConfirmations").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 15,
      totalItems: 0,
      totalPages: 0,
    });

    renderWithProviders(routes(<DashboardPage />), ["/t/anh-duong/app/dashboard"]);
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: /Chờ xác nhận đã dạy: 04/ }));

    expect(await screen.findByRole("heading", { name: "Buổi chờ xác nhận đã dạy" })).toBeVisible();
  });

  it("sắp xếp bằng nút cạnh tên cột và mở buổi đã chọn", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const list = vi.spyOn(dashboardRepository, "getPendingConfirmations").mockResolvedValue({
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
    });

    renderWithProviders(routes(<DashboardPage />), [
      "/t/anh-duong/app/dashboard/pending-confirmations",
    ]);
    const user = userEvent.setup();

    expect(await screen.findByText("HSK 1.1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Lớp học: nhấn để sắp xếp/ }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "anh-duong",
        expect.objectContaining({ sort: "className", direction: "asc" }),
      ),
    );

    await user.click(screen.getByRole("radio", { name: "Chọn HSK 1.1, buổi 3" }));
    await user.click(screen.getByRole("button", { name: "Xử lý buổi đã chọn" }));
    expect(await screen.findByText("Đã mở buổi?action=verify")).toBeVisible();
  });
});
