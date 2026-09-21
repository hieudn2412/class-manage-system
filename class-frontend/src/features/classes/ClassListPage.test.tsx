import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { saveSession } from "../../shared/lib/sessionStorage";
import { authRepository } from "../../services/repositories/authRepository";
import { classRepository } from "../../services/repositories/classRepository";
import { renderWithProviders } from "../../test/render";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import type { ClassListItem } from "../../shared/types/domain";
import { ClassListPage } from "./ClassListPage";

const originalMatchMedia = window.matchMedia?.bind(window);

const mockMobileViewport = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
});

describe("WF-04 danh sách lớp", () => {
  it("lọc lớp theo tên và giữ kết quả đúng tenant", async () => {
    const classes: ClassListItem[] = [
      {
        id: "class-ielts",
        code: "CLS-26001",
        name: "IELTS 6.5",
        teacher: { id: "teacher-lan", name: "Nguyễn Thùy Lan" },
        scheduleSummary: "Thứ 2 19:00–21:00, Thứ 4 19:00–21:00",
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
    const table = screen.getByRole("table", { name: "Danh sách lớp của Trung tâm Ánh Dương" });
    expect(within(table).getByRole("button", { name: "Tên lớp: đang tăng dần" })).toBeVisible();
    expect(within(table).getByRole("button", { name: "Tiến độ: nhấn để sắp xếp" })).toBeVisible();
    expect(
      within(table).getByRole("button", { name: "Kết thúc dự kiến: nhấn để sắp xếp" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Sắp xếp")).not.toBeInTheDocument();
    expect(within(table).queryByText("CLS-26001")).not.toBeInTheDocument();
    expect(table.querySelectorAll(".class-schedule-lines > span")).toHaveLength(3);
    expect(within(table).getAllByRole("link", { name: /Xem chi tiết lớp/ })[0]).toHaveClass(
      "class-detail-button",
    );

    await user.click(within(table).getByRole("button", { name: "Tên lớp: đang tăng dần" }));
    await waitFor(() => {
      expect(vi.mocked(classRepository).listClasses.mock.calls.at(-1)).toEqual([
        "anh-duong",
        expect.objectContaining({ sort: "name,desc" }),
      ]);
    });

    await user.click(within(table).getByRole("button", { name: "Tiến độ: nhấn để sắp xếp" }));
    await waitFor(() => {
      expect(vi.mocked(classRepository).listClasses.mock.calls.at(-1)).toEqual([
        "anh-duong",
        expect.objectContaining({ sort: "progress,asc" }),
      ]);
    });
    await user.click(
      within(table).getByRole("button", { name: "Kết thúc dự kiến: nhấn để sắp xếp" }),
    );
    await waitFor(() => {
      expect(vi.mocked(classRepository).listClasses.mock.calls.at(-1)).toEqual([
        "anh-duong",
        expect.objectContaining({ sort: "expectedEndDate,asc" }),
      ]);
    });

    const search = screen.getByLabelText("Tìm kiếm");
    await user.type(search, "Toán tư duy");
    await waitFor(() => expect(screen.queryByText("IELTS 6.5")).not.toBeInTheDocument());
    expect(screen.getByText("Toán tư duy 4A")).toBeInTheDocument();
  });

  it("mở popup tóm tắt lớp trên giao diện mobile", async () => {
    mockMobileViewport();
    const classes: ClassListItem[] = [
      {
        id: "class-ielts",
        code: "CLS-26001",
        name: "IELTS 6.5",
        teacher: { id: "teacher-lan", name: "Nguyễn Thùy Lan" },
        scheduleSummary: "Thứ 2 19:00–21:00, Thứ 4 19:00–21:00",
        completedSessions: 2,
        totalSessions: 12,
        expectedEndDate: "2026-09-28",
        status: "Active",
        sessionMonths: ["2026-07"],
      },
    ];
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(classRepository, "listTeachers").mockResolvedValue([]);
    vi.spyOn(classRepository, "listClasses").mockResolvedValue({
      items: classes,
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
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

    const table = await screen.findByRole("table", {
      name: "Danh sách lớp của Trung tâm Ánh Dương",
    });
    expect(within(table).getByRole("columnheader", { name: "Lớp" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xem chi tiết lớp IELTS 6.5" }));
    const dialog = await screen.findByRole("dialog", { name: "Thông tin lớp" });
    expect(within(dialog).getByRole("rowheader", { name: "Tên lớp" })).toBeVisible();
    expect(within(dialog).getByText("IELTS 6.5")).toBeVisible();
    expect(within(dialog).getByRole("rowheader", { name: "Giáo viên chính" })).toBeVisible();
    expect(within(dialog).getByText("Nguyễn Thùy Lan")).toBeVisible();
    expect(within(dialog).getByRole("rowheader", { name: "Lịch định kỳ" })).toBeVisible();
    expect(within(dialog).getByText("Thứ 2 19:00–21:00")).toBeVisible();
    expect(within(dialog).getByRole("rowheader", { name: "Tiến độ" })).toBeVisible();
    expect(within(dialog).getByText("2/12")).toBeVisible();
    expect(within(dialog).getByRole("rowheader", { name: "Kết thúc dự kiến" })).toBeVisible();
    expect(within(dialog).getByText("28/09/2026")).toBeVisible();
    expect(within(dialog).getByRole("rowheader", { name: "Trạng thái" })).toBeVisible();
    expect(within(dialog).getByText("Đang học")).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Xem chi tiết đầy đủ" })).toHaveAttribute(
      "href",
      "/t/anh-duong/app/classes/class-ielts",
    );
  });
});
