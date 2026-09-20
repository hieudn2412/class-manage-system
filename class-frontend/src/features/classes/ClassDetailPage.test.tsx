import { screen } from "@testing-library/react";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { classRepository } from "../../services/repositories/classRepository";
import { saveSession } from "../../shared/lib/sessionStorage";
import type { ClassDetail } from "../../shared/types/domain";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { ClassDetailPage } from "./ClassDetailPage";

vi.mock("./components/HourlyRatePanel", () => ({
  HourlyRatePanel: () => (
    <section aria-labelledby="hourly-rate-title">
      <h2 id="hourly-rate-title">Lịch sử đơn giá dạy</h2>
    </section>
  ),
}));

const detail: ClassDetail = {
  id: "class-1",
  code: "TOAN-01",
  name: "Toán nâng cao",
  teacher: { id: "teacher-1", name: "Nguyễn Ngọc Linh Đan" },
  scheduleSummary: "Thứ 2, Thứ 4, Thứ 6",
  completedSessions: 2,
  totalSessions: 24,
  expectedEndDate: "2099-12-31",
  status: "Active",
  sessionMonths: ["2099-12"],
  hourlyRate: 200000,
  attendanceRate: 0.95,
  homeworkCompletionRate: 0.8,
  currentLesson: "Phân số",
  room: "Phòng 201",
  deliveryMode: "Tại lớp",
  studentCount: 4,
  outstandingItems: [],
  sessions: [
    {
      id: "session-complete",
      ordinal: 1,
      startAt: "2020-01-01T12:00:00Z",
      lessonName: "Phân số",
      teacherName: "Nguyễn Ngọc Linh Đan",
      attendanceRate: 1,
      recordStatus: "COMPLETE",
      recordUrl: "https://example.com/record-1",
    },
    {
      id: "session-missing",
      ordinal: 2,
      startAt: "2020-01-03T12:00:00Z",
      lessonName: "",
      teacherName: "Nguyễn Ngọc Linh Đan",
      attendanceRate: null,
      recordStatus: "MISSING",
      recordUrl: null,
    },
    {
      id: "session-upcoming",
      ordinal: 3,
      startAt: "2099-12-20T12:00:00Z",
      lessonName: "",
      teacherName: "Nguyễn Ngọc Linh Đan",
      attendanceRate: null,
      recordStatus: "MISSING",
      recordUrl: null,
    },
  ],
  version: 1,
  allowedTransitions: [],
  closeReadiness: {
    missingAttendanceCount: 1,
    missingRecordCount: 1,
    warnings: [],
  },
  futureSessionCount: 1,
};

describe("Chi tiết lớp", () => {
  it("xếp các khối theo hàng và hiển thị đúng trạng thái hồ sơ buổi học", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(classRepository, "getClass").mockResolvedValue(detail);

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
          <Route path="classes/:classId" element={<ClassDetailPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/classes/class-1"],
    );

    const operations = await screen.findByRole("heading", { name: "Thông tin vận hành" });
    const rates = screen.getByRole("heading", { name: "Lịch sử đơn giá dạy" });
    const records = screen.getByRole("heading", { name: "Hồ sơ buổi học" });
    expect(
      operations.compareDocumentPosition(rates) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(rates.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText("Đủ hồ sơ")).toBeInTheDocument();
    expect(screen.getByText("Thiếu bản ghi buổi học")).toBeInTheDocument();
    expect(screen.getByText("Sắp tới")).toBeInTheDocument();
    expect(screen.getByText("Buổi 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Danh sách hồ sơ buổi học, có thể cuộn")).toBeInTheDocument();
  });
});
