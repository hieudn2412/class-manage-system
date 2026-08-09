import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { salaryRepository } from "../../services/repositories/salaryRepository";
import { saveSession } from "../../shared/lib/sessionStorage";
import type { PayrollPage, TeacherPayrollDetail, User } from "../../shared/types/domain";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { MySalaryPage } from "./MySalaryPage";
import { SalaryPayrollPage } from "./SalaryPayrollPage";

const payroll: PayrollPage = {
  month: "2026-08",
  metrics: {
    teacherCount: 1,
    sessionCount: 1,
    totalMinutes: 90,
    accrued: 300000,
    adjustments: 0,
    due: 300000,
    paid: 400000,
    outstanding: -100000,
    overpaidTeachers: 1,
  },
  teachers: {
    items: [{
      teacherId: "teacher-fl12",
      teacherName: "Cô Lan",
      sessionCount: 1,
      totalMinutes: 90,
      accrued: 300000,
      adjustments: 0,
      due: 300000,
      paid: 400000,
      outstanding: -100000,
      status: "OVERPAID",
    }],
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  },
};

const ownSalary: TeacherPayrollDetail = {
  month: "2026-08",
  teacherId: "teacher-fl12",
  teacherName: "Cô Lan",
  metrics: {
    sessionCount: 1,
    totalMinutes: 90,
    accrued: 300000,
    adjustments: 0,
    due: 300000,
    paid: 400000,
    outstanding: -100000,
    status: "OVERPAID",
  },
  accruals: [{
    id: "accrual-1",
    sessionId: "session-1",
    classCode: "TOAN-4A",
    className: "Toán tư duy 4A",
    ordinal: 3,
    sessionDate: "2026-08-05",
    scheduledMinutes: 90,
    hourlyRate: 200000,
    amount: 300000,
    revision: 1,
    status: "ACTIVE",
    substitution: false,
  }],
  adjustments: [],
  payments: [],
};

afterEach(() => vi.restoreAllMocks());

const tenantRoutes = (element: React.ReactNode) => (
  <Routes>
    <Route path="/t/:tenantSlug/app" element={<TenantProvider><Outlet /></TenantProvider>}>
      <Route path="salary-test" element={element} />
    </Route>
  </Routes>
);

describe("FL-12 salary pages", () => {
  it("WF-15 hiển thị trả thừa và giữ kỳ trên URL", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const list = vi.spyOn(salaryRepository, "payroll").mockResolvedValue(payroll);
    renderWithProviders(tenantRoutes(<SalaryPayrollPage />), [
      "/t/anh-duong/app/salary-test?month=2026-08",
    ]);

    expect(await screen.findByRole("heading", { name: "Lương phát sinh & đã trả" })).toBeVisible();
    expect(screen.getAllByText("Trả thừa").length).toBeGreaterThan(0);
    expect(screen.getByText("-100.000 ₫")).toBeVisible();
    await userEvent.setup().selectOptions(screen.getByLabelText("Lọc trạng thái"), "OVERPAID");
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(
      "anh-duong",
      expect.objectContaining({ month: "2026-08", status: "OVERPAID" }),
    ));
  });

  it("WF-22 chỉ gọi endpoint lương cá nhân và hiển thị revision buổi", async () => {
    const teacher: User = {
      ...createTestSession().user,
      id: "teacher-user",
      username: "gv.lan",
      roles: ["TEACHER"],
    };
    saveSession(createTestSession(teacher), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const own = vi.spyOn(salaryRepository, "ownPayroll").mockResolvedValue(ownSalary);
    renderWithProviders(tenantRoutes(<MySalaryPage />), ["/t/anh-duong/app/salary-test"]);

    expect(await screen.findByRole("heading", { name: "Giờ dạy & lương của tôi" })).toBeVisible();
    expect(screen.getByText("Toán tư duy 4A")).toBeVisible();
    expect(screen.getByText(/revision 1/i)).toBeVisible();
    expect(own).toHaveBeenCalledWith("anh-duong", expect.stringMatching(/^\d{4}-\d{2}$/));
  });
});
