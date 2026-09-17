import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
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
  roomId: "room-101",
  roomName: "Phòng 101",
  onlineLink: null,
  status: "IN_PROGRESS",
  plannedTeacherId: "teacher-lan",
  actualTeacherId: "teacher-lan",
  actualTeacherName: "Nguyễn Thùy Lan",
  substitution: false,
  makeup: false,
  makeupRootSessionId: null,
  replacesSessionId: null,
  replacementSessionId: null,
  cancellationReason: null,
  allowedActions: [],
  actualTeacher: true,
  canEdit: true,
  canCreateHomework: true,
  homework: null,
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
    lessonContent: "Nội dung đã lưu trước đó",
    recordUrl: null,
    version: 0,
  },
  sessionTest: null,
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
      testResult: null,
    },
  ],
  participatedStudents: 0,
};

describe("WF-20 workspace buổi dạy", () => {
  it("không mặc định có mặt, lưu explicit và kiểm tra điểm tối đa", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(learningContentRepository, "classHomeworks").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      totalItems: 0,
      totalPages: 0,
    });
    const getSession = vi.spyOn(teachingRepository, "getSession").mockResolvedValue(detail);
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
    const detailWithTest: SessionOperationsDetail = {
      ...detail,
      sessionTest: {
        id: "test-1",
        testName: "Kiểm tra nhanh",
        maxScore: 10,
        testDate: "2026-07-25",
        comment: "Ôn tập nội dung trong buổi",
        version: 0,
      },
      students: [
        {
          ...detail.students[0]!,
          testResult: { id: "result-1", score: null, comment: "", version: 0 },
        },
      ],
    };
    const createTest = vi
      .spyOn(teachingRepository, "createSessionTest")
      .mockResolvedValue(detailWithTest);
    const updateTest = vi.spyOn(teachingRepository, "updateSessionTest").mockResolvedValue({
      ...detailWithTest,
      students: [
        {
          ...detailWithTest.students[0]!,
          testResult: {
            ...detailWithTest.students[0]!.testResult!,
            score: 8.5,
            comment: "Nắm kiến thức tốt",
            version: 1,
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
          <Route path="sessions/:sessionId" element={<SessionOperationsPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/sessions/session-1"],
    );

    expect(
      await screen.findByRole("heading", { name: "Toán tư duy 4A · Buổi 3" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/bài tập về nhà/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nội dung thực dạy")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Trạng thái đi học")).toHaveValue("");

    await user.type(screen.getByLabelText("Tên bài học"), "Phân số");
    await user.selectOptions(screen.getByLabelText("Trạng thái đi học"), "LATE");
    await user.type(screen.getByLabelText("Đánh giá buổi học"), "Cần chuẩn bị bài kỹ hơn");
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
    expect(save.mock.calls[0]?.[2].lessonReport.lessonContent).toBe(
      "Nội dung đã lưu trước đó",
    );

    expect(screen.queryByLabelText(/Điểm \/ 10/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tạo bài kiểm tra" }));
    const testDialog = screen.getByRole("dialog", { name: "Tạo bài kiểm tra cho buổi" });
    const testDialogView = within(testDialog);
    await user.type(testDialogView.getByLabelText("Tên bài kiểm tra"), "Kiểm tra nhanh");
    await user.type(
      testDialogView.getByLabelText("Nhận xét chung bài kiểm tra"),
      "Ôn tập nội dung trong buổi",
    );
    getSession.mockResolvedValue(detailWithTest);
    await user.click(testDialogView.getByRole("button", { name: "Tạo bài kiểm tra" }));
    expect(createTest).toHaveBeenCalledWith(
      "anh-duong",
      "session-1",
      expect.objectContaining({ testName: "Kiểm tra nhanh", maxScore: 10 }),
    );

    const score = await screen.findByLabelText("Điểm / 10");
    await user.type(score, "11");
    await user.click(screen.getByRole("button", { name: "Lưu điểm kiểm tra" }));
    expect(await screen.findByText("Điểm không được vượt quá 10.")).toBeInTheDocument();
    await user.clear(score);
    await user.type(score, "8.5");
    await user.type(screen.getByLabelText("Nhận xét bài kiểm tra"), "Nắm kiến thức tốt");
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ và điểm" }));
    await waitFor(() =>
      expect(updateTest).toHaveBeenCalledWith(
        "anh-duong",
        "session-1",
        "test-1",
        expect.objectContaining({
          results: [
            expect.objectContaining({
              studentId: "student-1",
              score: 8.5,
              comment: "Nắm kiến thức tốt",
            }),
          ],
        }),
      ),
    );
    expect(save).toHaveBeenCalledTimes(2);
  });
});
