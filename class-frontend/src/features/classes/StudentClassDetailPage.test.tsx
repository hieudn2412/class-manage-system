import { screen } from "@testing-library/react";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { lifecycleRepository } from "../../services/repositories/lifecycleRepository";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession, studentUser, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { StudentClassDetailPage } from "./StudentClassDetailPage";

describe("Chi tiết lớp của học sinh", () => {
  it("hiển thị đúng điểm và nhận xét bài kiểm tra của học sinh", async () => {
    saveSession(createTestSession(studentUser), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(lifecycleRepository, "studentClass").mockResolvedValue({
      id: "class-1",
      code: "CLS-001",
      name: "Toán đang học",
      description: "Lớp luyện tư duy",
      teacherName: "Cô Lan",
      scheduleSummary: "Thứ 3 19:00",
      status: "Active",
      completedSessions: 1,
      totalSessions: 12,
      expectedEndDate: "2026-10-01",
    });
    vi.spyOn(lifecycleRepository, "studentSessions").mockResolvedValue({
      items: [
        {
          id: "session-1",
          ordinal: 1,
          startAt: "2026-08-04T19:00:00+07:00",
          endAt: "2026-08-04T20:30:00+07:00",
          status: "COMPLETED",
          teacherName: "Cô Lan",
          lessonName: "Phân số",
          lessonContent: "Ôn tập phân số.",
          attendanceStatus: "PRESENT",
          attendanceNote: "Đúng giờ",
          recordUrl: null,
          comment: "Tham gia tích cực.",
          testResult: {
            id: "result-1",
            testName: "Kiểm tra phân số",
            score: 8.5,
            maxScore: 10,
            testDate: "2026-08-04",
            comment: "Nắm bài tốt",
            testComment: "Ôn lại phần quy đồng mẫu số",
          },
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
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
          <Route path="learning-classes/:classId" element={<StudentClassDetailPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/learning-classes/class-1"],
    );

    expect(await screen.findByRole("heading", { name: "Kiểm tra phân số" })).toBeVisible();
    expect(screen.getByText("8,5")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Điểm 8,5 trên 10" })).toHaveAttribute(
      "aria-valuenow",
      "8.5",
    );
    expect(screen.getByText("Nắm bài tốt")).toBeVisible();
    expect(screen.getByText("Ôn lại phần quy đồng mẫu số")).toBeVisible();
  });
});
