import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { saveSession } from "../../shared/lib/sessionStorage";
import { authRepository } from "../../services/repositories/authRepository";
import { classRepository } from "../../services/repositories/classRepository";
import { renderWithProviders } from "../../test/render";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import type { ClassListItem } from "../../shared/types/domain";
import { ClassListPage } from "./ClassListPage";

describe("WF-04 danh sách lớp", () => {
  it("lọc lớp theo tên và giữ kết quả đúng tenant", async () => {
    const classes: ClassListItem[] = [
      {
        id: "class-ielts",
        code: "CLS-26001",
        name: "IELTS 6.5",
        teacher: { id: "teacher-lan", name: "Nguyễn Thùy Lan" },
        scheduleSummary: "T2 19:00",
        completedSessions: 2,
        totalSessions: 12,
        expectedEndDate: "2026-09-28",
        status: "Active",
        sessionMonths: ["2026-07"],
      },
      {
        id: "class-math",
        code: "CLS-26002",
        name: "Toán tư duy 4A",
        teacher: { id: "teacher-lan", name: "Nguyễn Thùy Lan" },
        scheduleSummary: "T5 19:00",
        completedSessions: 3,
        totalSessions: 12,
        expectedEndDate: "2026-10-01",
        status: "Scheduled",
        sessionMonths: ["2026-07"],
      },
    ];
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(classRepository, "listTeachers").mockResolvedValue([
      { id: "teacher-lan", name: "Nguyễn Thùy Lan" },
    ]);
    vi.spyOn(classRepository, "listClasses").mockImplementation((_, params) => {
      const normalized = params.search.trim().toLocaleLowerCase("vi");
      const items = normalized
        ? classes.filter((item) => item.name.toLocaleLowerCase("vi").includes(normalized))
        : classes;
      return Promise.resolve({
        items,
        page: 1,
        pageSize: 10,
        totalItems: items.length,
        totalPages: 1,
      });
    });

    const user = userEvent.setup();
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
          <Route path="classes" element={<ClassListPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/classes?month=2026-07"],
    );

    expect(await screen.findByText("IELTS 6.5", {}, { timeout: 3000 })).toBeInTheDocument();

    const search = screen.getByLabelText("Tìm kiếm");
    await user.type(search, "Toán tư duy");
    await waitFor(() => expect(screen.queryByText("IELTS 6.5")).not.toBeInTheDocument());
    expect(screen.getByText("Toán tư duy 4A")).toBeInTheDocument();
  });
});
