import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
import { SalaryDetailSections } from "./SalaryDetailSections";
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
    items: [
      {
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
        emailAvailable: true,
        lastNotificationStatus: null,
        lastNotificationAt: null,
      },
    ],
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
  accruals: [
    {
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
    },
  ],
  adjustments: [],
  payments: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const useMobileViewport = () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

const tenantRoutes = (element: React.ReactNode) => (
  <Routes>
    <Route
      path="/t/:tenantSlug/app"
      element={
        <TenantProvider>
          <Outlet />
        </TenantProvider>
      }
    >
      <Route path="salary-test" element={element} />
    </Route>
  </Routes>
);

const textEqualsIgnoringCurrencySpaces =
  (expected: string) => (_content: string, element: Element | null) =>
    element?.textContent?.replace(/[\s\u00a0\u202f]+/g, " ").trim() === expected;

describe("FL-12 salary pages", () => {
  it("tìm kiếm realtime khi người dùng nhập", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const list = vi.spyOn(salaryRepository, "payroll").mockResolvedValue(payroll);

    renderWithProviders(tenantRoutes(<SalaryPayrollPage />), [
      "/t/anh-duong/app/salary-test?month=2026-08",
    ]);

    await screen.findByRole("heading", { name: "Lương phát sinh và đã trả" });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Tìm giáo viên"), { target: { value: "C" } });
    fireEvent.change(screen.getByLabelText("Tìm giáo viên"), { target: { value: "Cô" } });
    fireEvent.change(screen.getByLabelText("Tìm giáo viên"), { target: { value: "Cô Lan" } });

    await waitFor(() => expect(list).toHaveBeenCalledTimes(4), { timeout: 1000 });
    expect(list).toHaveBeenLastCalledWith(
      "anh-duong",
      expect.objectContaining({ search: "Cô Lan", page: 1 }),
    );
  });

  it("hiển thị bảng lương mobile ba cột, chọn cả trang và mở tóm tắt", async () => {
    useMobileViewport();
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(salaryRepository, "payroll").mockResolvedValue({
      ...payroll,
      teachers: {
        ...payroll.teachers,
        items: [
          payroll.teachers.items[0]!,
          {
            ...payroll.teachers.items[0]!,
            teacherId: "teacher-owed",
            teacherName: "Cô Mai",
            due: 500000,
            paid: 0,
            outstanding: 500000,
            status: "OWED",
            emailAvailable: false,
          },
          {
            ...payroll.teachers.items[0]!,
            teacherId: "teacher-settled",
            teacherName: "Cô An",
            due: 300000,
            paid: 300000,
            outstanding: 0,
            status: "SETTLED",
          },
        ],
        totalItems: 3,
      },
    });
    const user = userEvent.setup();

    renderWithProviders(tenantRoutes(<SalaryPayrollPage />), [
      "/t/anh-duong/app/salary-test?month=2026-08",
    ]);

    const table = await screen.findByRole("table", { name: "Danh sách lương giáo viên" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getByRole("columnheader", { name: "Giáo viên" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Tổng lương" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Xem" })).toBeVisible();
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).queryByText("Có thể gửi email")).not.toBeInTheDocument();
    expect(within(table).getAllByText(textEqualsIgnoringCurrencySpaces("300.000 ₫")).length)
      .toBeGreaterThan(0);

    const missingEmailCheckbox = screen.getByRole("checkbox", {
      name: "Chọn Cô Mai để gửi thông báo lương",
    });
    expect(missingEmailCheckbox).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Chọn tất cả (2)" }));
    expect(screen.getByRole("checkbox", {
      name: "Chọn Cô Lan để gửi thông báo lương",
    })).toBeChecked();
    expect(screen.getByRole("checkbox", {
      name: "Chọn Cô An để gửi thông báo lương",
    })).toBeChecked();
    expect(screen.getByRole("button", {
      name: "Gửi thông báo lương cho 2 giáo viên đã chọn",
    })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Bỏ chọn trang này" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Xem lương của Cô Lan" }));
    let dialog = await screen.findByRole("dialog", { name: "Tóm tắt lương" });
    expect(within(dialog).getByText("Cô Lan")).toBeVisible();
    expect(within(dialog).getByText("Trả thừa")).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Xem chi tiết đầy đủ" })).toHaveAttribute(
      "href",
      "/t/anh-duong/app/finance/salaries/teacher-fl12?month=2026-08",
    );
    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));

    await user.click(screen.getByRole("button", { name: "Xem lương của Cô Mai" }));
    dialog = await screen.findByRole("dialog", { name: "Tóm tắt lương" });
    expect(within(dialog).getByText("Còn phải trả")).toBeVisible();
    expect(within(dialog).getByText("Chưa có email")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));

    await user.click(screen.getByRole("button", { name: "Xem lương của Cô An" }));
    dialog = await screen.findByRole("dialog", { name: "Tóm tắt lương" });
    expect(within(dialog).getByText("Đã cân bằng")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));

    await user.click(screen.getByRole("button", { name: "Bỏ chọn trang này" }));
    expect(screen.getByRole("checkbox", {
      name: "Chọn Cô Lan để gửi thông báo lương",
    })).not.toBeChecked();
  });

  it("WF-15 hiển thị trả thừa và giữ kỳ trên URL", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const list = vi.spyOn(salaryRepository, "payroll").mockResolvedValue(payroll);
    renderWithProviders(tenantRoutes(<SalaryPayrollPage />), [
      "/t/anh-duong/app/salary-test?month=2026-08",
    ]);

    expect(await screen.findByRole("heading", { name: "Lương phát sinh và đã trả" })).toBeVisible();
    expect(screen.getAllByText("Trả thừa").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(textEqualsIgnoringCurrencySpaces("-100.000 ₫")).length,
    ).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: "Bảng lương giáo viên" });
    expect(within(table).queryByRole("columnheader", { name: "Cộng hoặc trừ" }))
      .not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Còn lại" }))
      .not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Email thông báo" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chọn tất cả (1)" })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Bộ lọc/ }));
    await user.selectOptions(screen.getByLabelText("Lọc trạng thái"), "OVERPAID");
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "anh-duong",
        expect.objectContaining({ month: "2026-08", status: "OVERPAID" }),
      ),
    );
  });

  it("cho Admin chọn giáo viên, xem trước và đưa email vào hàng đợi", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(salaryRepository, "payroll").mockResolvedValue(payroll);
    const send = vi.spyOn(salaryRepository, "sendNotifications").mockResolvedValue({
      queuedCount: 1,
      queued: [
        {
          teacherId: "teacher-fl12",
          teacherName: "Cô Lan",
          notificationId: "notification-1",
        },
      ],
      skipped: [],
    });
    renderWithProviders(tenantRoutes(<SalaryPayrollPage />), [
      "/t/anh-duong/app/salary-test?month=2026-08",
    ]);

    await screen.findByRole("heading", { name: "Lương phát sinh và đã trả" });
    const bulkSendButton = screen.getByRole("button", {
      name: "Gửi thông báo lương — hãy chọn ít nhất một giáo viên có email trong bảng",
    });
    expect(bulkSendButton).toBeDisabled();
    expect(bulkSendButton.parentElement).toHaveAttribute(
      "title",
      "Chọn ít nhất một giáo viên có email trong bảng để gửi thông báo.",
    );
    await userEvent.setup().click(screen.getByLabelText("Chọn Cô Lan để gửi thông báo lương"));
    expect(bulkSendButton).toBeEnabled();
    await userEvent.setup().click(bulkSendButton);
    expect(screen.getByRole("heading", { name: "Gửi thông báo lương" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Xem trước nội dung email" })).toHaveTextContent(
      "Cô Lan",
    );
    const previewTable = screen.getByRole("table", { name: "Số liệu bảng lương trong email" });
    expect(previewTable).toHaveTextContent("Số buổi");
    expect(previewTable).toHaveTextContent("Còn lại");
    expect(within(previewTable).getAllByRole("row")).toHaveLength(2);

    await userEvent.setup().click(screen.getByRole("button", { name: "Gửi thông báo" }));
    expect(screen.getByText("Vui lòng chọn ngày dự kiến thanh toán.")).toBeVisible();
    await userEvent.setup().type(screen.getByLabelText(/Ngày dự kiến thanh toán/), "2026-09-15");
    await userEvent
      .setup()
      .type(screen.getByLabelText(/Ghi chú liên hệ/), "Liên hệ phòng kế toán.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Gửi thông báo" }));

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith("anh-duong", {
        month: "2026-08",
        teacherIds: ["teacher-fl12"],
        paymentDate: "2026-09-15",
        contactNote: "Liên hệ phòng kế toán.",
        confirmResend: false,
      }),
    );
  });

  it("không hiển thị thao tác gửi email cho Kế toán", async () => {
    const accountant: User = {
      ...createTestSession().user,
      id: "accountant-user",
      username: "ketoan",
      roles: ["ACCOUNTANT"],
    };
    saveSession(createTestSession(accountant), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(salaryRepository, "payroll").mockResolvedValue(payroll);
    renderWithProviders(tenantRoutes(<SalaryPayrollPage />), [
      "/t/anh-duong/app/salary-test?month=2026-08",
    ]);

    await screen.findByRole("heading", { name: "Lương phát sinh và đã trả" });
    expect(screen.queryByRole("button", { name: /Gửi thông báo lương/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi email" })).not.toBeInTheDocument();
  });

  it("cảnh báo và gửi với xác nhận khi kỳ lương đã được thông báo", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(salaryRepository, "payroll").mockResolvedValue({
      ...payroll,
      teachers: {
        ...payroll.teachers,
        items: [
          {
            ...payroll.teachers.items[0]!,
            lastNotificationStatus: "SENT",
            lastNotificationAt: "2026-09-01T08:00:00Z",
          },
        ],
      },
    });
    const send = vi.spyOn(salaryRepository, "sendNotifications").mockResolvedValue({
      queuedCount: 1,
      queued: [
        {
          teacherId: "teacher-fl12",
          teacherName: "Cô Lan",
          notificationId: "notification-2",
        },
      ],
      skipped: [],
    });
    renderWithProviders(tenantRoutes(<SalaryPayrollPage />), [
      "/t/anh-duong/app/salary-test?month=2026-08",
    ]);

    await screen.findByRole("heading", { name: "Lương phát sinh và đã trả" });
    await userEvent.setup().click(screen.getByLabelText("Chọn Cô Lan để gửi thông báo lương"));
    await userEvent.setup().click(screen.getByRole("button", {
      name: "Gửi thông báo lương cho 1 giáo viên đã chọn",
    }));
    expect(screen.getByText("Thông báo của kỳ này đã được tạo trước đó")).toBeVisible();
    await userEvent.setup().type(screen.getByLabelText(/Ngày dự kiến thanh toán/), "2026-09-15");
    await userEvent.setup().click(screen.getByRole("button", { name: "Xác nhận gửi lại" }));

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "anh-duong",
        expect.objectContaining({
          teacherIds: ["teacher-fl12"],
          confirmResend: true,
        }),
      ),
    );
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

    expect(await screen.findByRole("heading", { name: "Giờ dạy và lương của tôi" })).toBeVisible();
    expect(screen.getByText("Toán tư duy 4A")).toBeVisible();
    expect(screen.getByText(/lần cập nhật 1/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Toán tư duy 4A" })).toHaveAttribute(
      "href",
      "/t/anh-duong/app/sessions/session-1",
    );
    expect(document.querySelector(".salary-ledger-personal")).toBeInTheDocument();
    expect(own).toHaveBeenCalledWith("anh-duong", expect.stringMatching(/^\d{4}-\d{2}$/));
  });

  it.each([
    ["OWED", 125000, "Còn được thanh toán", "Chưa thanh toán hết"],
    ["OVERPAID", -125000, "Đã thanh toán vượt", "Đã trả vượt"],
    ["SETTLED", 0, "Số tiền còn lại", "Đã cân bằng"],
  ] as const)(
    "hiển thị phiếu lương đúng cho trạng thái %s",
    async (status, outstanding, balanceLabel, badgeLabel) => {
      saveSession(createTestSession(), false);
      vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
      vi.spyOn(salaryRepository, "ownPayroll").mockResolvedValue({
        ...ownSalary,
        metrics: { ...ownSalary.metrics, status, outstanding },
      });
      renderWithProviders(tenantRoutes(<MySalaryPage />), ["/t/anh-duong/app/salary-test"]);

      await screen.findByRole("heading", { name: "Giờ dạy và lương của tôi" });
      const balance = document.querySelector(".my-salary-balance");
      expect(balance).not.toBeNull();
      expect(within(balance as HTMLElement).getByText(balanceLabel)).toBeVisible();
      expect(balance).toHaveTextContent(
        new Intl.NumberFormat("vi-VN").format(Math.abs(outstanding)),
      );
      expect(screen.getByText(badgeLabel)).toBeVisible();
    },
  );

  it("hiển thị trạng thái rỗng gọn và tải lại khi đổi kỳ", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const own = vi.spyOn(salaryRepository, "ownPayroll").mockResolvedValue({
      ...ownSalary,
      metrics: {
        sessionCount: 0,
        totalMinutes: 0,
        accrued: 0,
        adjustments: 0,
        due: 0,
        paid: 0,
        outstanding: 0,
        status: "SETTLED",
      },
      accruals: [],
      adjustments: [],
      payments: [],
    });
    renderWithProviders(tenantRoutes(<MySalaryPage />), ["/t/anh-duong/app/salary-test"]);

    expect(await screen.findByText("Chưa có buổi phát sinh lương")).toBeVisible();
    expect(screen.getByText("Không có điều chỉnh trong kỳ.")).toBeVisible();
    expect(screen.getByText("Chưa ghi thanh toán trong kỳ.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Kỳ lương"), { target: { value: "2026-07" } });
    await waitFor(() => expect(own).toHaveBeenLastCalledWith("anh-duong", "2026-07"));
  });

  it("giữ nguyên biến thể mặc định và thao tác sửa cho trang quản trị", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const onEditAdjustment = vi.fn();
    const adjustment = {
      id: "adjustment-1",
      teacherId: ownSalary.teacherId,
      teacherName: ownSalary.teacherName,
      salaryMonth: ownSalary.month,
      amount: 50000,
      reason: "Thưởng chuyên cần",
      version: 1,
      createdAt: "2026-08-31T08:00:00Z",
      updatedAt: "2026-08-31T08:00:00Z",
    };
    renderWithProviders(
      tenantRoutes(
        <SalaryDetailSections
          detail={{ ...ownSalary, adjustments: [adjustment] }}
          basePath="/t/anh-duong/app"
          editable
          onEditAdjustment={onEditAdjustment}
        />,
      ),
      ["/t/anh-duong/app/salary-test"],
    );

    await screen.findByRole("heading", { name: "Phát sinh theo buổi" });
    expect(document.querySelector(".salary-ledger-default")).toBeInTheDocument();
    expect(document.querySelector(".salary-ledger-personal")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sửa" }));
    expect(onEditAdjustment).toHaveBeenCalledWith(adjustment);
  });
});
