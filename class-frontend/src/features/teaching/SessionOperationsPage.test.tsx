import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import type { SessionOperationsDetail } from "../../shared/types/domain";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { SessionOperationsPage } from "./SessionOperationsPage";

const detail: SessionOperationsDetail = {
  id: "session-1",
  classId: "class-1",
  classCode: "CLS-001",
  className: "Toán tư duy 4A",
  ordinal: 3,
  startAt: "2026-07-25T19:00:00+07:00",
  endAt: "2026-07-25T20:30:00+07:00",
  mode: "IN_PERSON",
  roomName: "Phòng 101",
  onlineLink: null,
  status: "IN_PROGRESS",
  actualTeacherName: "Nguyễn Thùy Lan",
  actualTeacher: true,
  canEdit: true,
  canVerify: false,
  checkInState: "CHECKED_IN",
  checkInOpensAt: "2026-07-25T18:30:00+07:00",
  checkIn: {
    checkedInAt: "2026-07-25T18:45:00+07:00",
    onlineLink: null,
  },
  rosterFrozen: false,
  rosterRevision: "roster-v1",
  missingDocumentation: false,
  version: 1,
  lessonReport: {
    lessonName: "",
    lessonContent: "",
    recordUrl: null,
    version: 0,
  },
  students: [
    {
      studentId: "student-1",
      code: "HS001",
      name: "Lê Minh Anh",
      attendanceStatus: null,
      attendanceNote: "",
      attendanceVersion: 0,
      sessionComment: "",
      commentVersion: 0,
      testResults: [],
    },
  ],
  participatedStudents: 0,
};

describe("WF-20 workspace buổi dạy", () => {
  it("không mặc định có mặt, lưu explicit và kiểm tra điểm tối đa", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(teachingRepository, "getSession").mockResolvedValue(detail);
    const save = vi.spyOn(teachingRepository, "savePedagogicalRecord").mockResolvedValue({
      ...detail,
      lessonReport: { ...detail.lessonReport, lessonName: "Phân số" },
      students: [
        {
          ...detail.students[0]!,
          attendanceStatus: "LATE",
          sessionComment: "Cần chuẩn bị bài kỹ hơn",
        },
      ],
    });
    vi.spyOn(teachingRepository, "createTestResult").mockResolvedValue({
      id: "result-1",
      testName: "Kiểm tra nhanh",
      score: 8.5,
      maxScore: 10,
      testDate: "2026-07-25",
      comment: "",
      version: 0,
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
          <Route path="sessions/:sessionId" element={<SessionOperationsPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/sessions/session-1"],
    );

    expect(
      await screen.findByRole("heading", { name: "Toán tư duy 4A · Buổi 3" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/bài tập về nhà/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Trạng thái đi học")).toHaveValue("");

    await user.type(screen.getByLabelText("Tên bài học"), "Phân số");
    await user.selectOptions(screen.getByLabelText("Trạng thái đi học"), "LATE");
    await user.type(screen.getByLabelText("Nhận xét buổi học"), "Cần chuẩn bị bài kỹ hơn");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ buổi" }));

    expect(save).toHaveBeenCalledWith(
      "anh-duong",
      "session-1",
      expect.objectContaining({
        rosterRevision: "roster-v1",
        students: [
          expect.objectContaining({
            studentId: "student-1",
            attendanceStatus: "LATE",
          }),
        ],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Thêm điểm kiểm tra" }));
    await user.type(screen.getByLabelText("Tên bài kiểm tra"), "Kiểm tra nhanh");
    await user.clear(screen.getByLabelText("Điểm đạt"));
    await user.type(screen.getByLabelText("Điểm đạt"), "11");
    await user.click(screen.getByRole("button", { name: "Lưu điểm" }));
    expect(await screen.findByText("Điểm đạt không được lớn hơn điểm tối đa.")).toBeInTheDocument();
  });
});
