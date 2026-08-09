import { screen } from "@testing-library/react";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { lifecycleRepository } from "../../services/repositories/lifecycleRepository";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession, studentUser, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { MyLearningClassesPage } from "./MyLearningClassesPage";

describe("Lớp của tôi", () => {
  it("chỉ tạo link nội dung cho lớp còn quyền", async () => {
    saveSession(createTestSession(studentUser), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(lifecycleRepository, "studentClasses").mockResolvedValue({
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
          completedSessions: 2,
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
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/t/:tenantSlug/app"
          element={
            <TenantProvider>
              <Outlet />
            </TenantProvider>
          }
        >
          <Route path="learning-classes" element={<MyLearningClassesPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/learning-classes"],
    );

    expect(await screen.findByText("Toán đang học")).toBeInTheDocument();
    expect(screen.getByText("Toán đang học").closest("a")).toHaveAttribute(
      "href",
      "/t/anh-duong/app/learning-classes/accessible-class",
    );
    expect(screen.getByText("Văn lịch sử").closest("a")).toBeNull();
    expect(screen.getByText(/chỉ giữ thông tin lịch sử/i)).toBeInTheDocument();
  });
});
