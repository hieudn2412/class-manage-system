import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { saveSession } from "../../shared/lib/sessionStorage";
import { authRepository } from "../../services/repositories/authRepository";
import { classRepository } from "../../services/repositories/classRepository";
import { renderWithProviders } from "../../test/render";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import { ClassWizardPage } from "./ClassWizardPage";

describe("WF-05 wizard tạo lớp", () => {
  it("giữ dữ liệu qua các bước và chặn công bố khi giáo viên/phòng trùng", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(classRepository, "getSchedulingOptions").mockResolvedValue({
      teachers: [{ id: "teacher-lan", name: "Nguyễn Thùy Lan" }],
      rooms: [{ id: "room-101", code: "P101", name: "Phòng 101", capacity: 20, status: "ACTIVE" }],
    });
    vi.spyOn(classRepository, "listStudents").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 8,
      totalItems: 0,
      totalPages: 0,
    });
    vi.spyOn(classRepository, "previewSchedule").mockResolvedValue({
      previewId: "preview-conflict",
      generatedAt: "2026-07-25T10:00:00Z",
      inputVersion: "v1",
      expectedEndDate: "2026-08-17",
      skippedHolidays: [],
      sessions: [
        {
          key: "slot@2026-08-03",
          ordinal: 1,
          startAt: "2026-08-03T19:00:00+07:00",
          endAt: "2026-08-03T20:30:00+07:00",
          teacherId: "teacher-lan",
          teacherName: "Nguyễn Thùy Lan",
          mode: "IN_PERSON",
          roomId: "room-101",
          roomName: "P101",
        },
      ],
      conflicts: [
        {
          id: "teacher-conflict",
          code: "TEACHER_OVERLAP",
          severity: "BLOCKING",
          proposedSessionKey: "slot@2026-08-03",
          studentNames: [],
          conflictingSession: {
            sessionId: "existing-session",
            classCode: "CLS-001",
            className: "Lớp đang học",
            startAt: "2026-08-03T19:00:00+07:00",
            endAt: "2026-08-03T20:30:00+07:00",
            teacherName: "Nguyễn Thùy Lan",
            roomName: "P101",
          },
        },
      ],
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
          <Route path="classes/new" element={<ClassWizardPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/classes/new"],
    );

    expect(await screen.findByRole("heading", { name: "Tạo lớp học mới" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tên lớp *"), "Lớp kiểm tra xung đột");
    await user.selectOptions(screen.getByLabelText("Giáo viên chính *"), "teacher-lan");
    await user.clear(screen.getByLabelText("Ngày bắt đầu *"));
    await user.type(screen.getByLabelText("Ngày bắt đầu *"), "2026-08-03");
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(
      await screen.findByRole("heading", { name: "Chọn học sinh tham gia" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));

    await user.click(screen.getByRole("button", { name: /^Thêm ca$/ }));
    await user.click(screen.getByRole("button", { name: "Xem trước lịch" }));

    expect(
      await screen.findByRole("heading", {
        name: /xung đột giáo viên\/phòng phải sửa/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Công bố lớp" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Thông tin lớp/ }));
    expect(screen.getByLabelText("Tên lớp *")).toHaveValue("Lớp kiểm tra xung đột");
  });
});
