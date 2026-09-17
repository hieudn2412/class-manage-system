import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { HomeworkClassDetailPage } from "./HomeworkClassDetailPage";
import { HomeworkDetailPage } from "./HomeworkDetailPage";
import { HomeworkWorkspacePage } from "./HomeworkWorkspacePage";

describe("trang bài tập về nhà theo lớp", () => {
  it("hiển thị bảng lớp và mở trang bài tập riêng của lớp", async () => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    vi.spyOn(learningContentRepository, "report").mockResolvedValue({
      items: [
        {
          classId: "class-1",
          classCode: "TOAN-4A",
          className: "Toán tư duy 4A",
          teacherName: "Cô Lan",
          homeworkCount: 2,
          recipientCount: 10,
          submittedCount: 7,
          reviewedCount: 5,
        },
      ],
      page: 1,
      pageSize: 50,
      totalItems: 1,
      totalPages: 1,
    });
    const classHomeworks = vi.spyOn(learningContentRepository, "classHomeworks").mockResolvedValue({
      items: [
        {
          id: "homework-1",
          classId: "class-1",
          sessionId: "session-3",
          classCode: "TOAN-4A",
          className: "Toán tư duy 4A",
          sessionOrdinal: 3,
          title: "Luyện tập phân số",
          status: "PUBLISHED",
          deadlineAt: "2026-09-20T20:00:00+07:00",
          recipientCount: 10,
          submittedCount: 7,
          reviewedCount: 5,
          version: 0,
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
    });
    vi.spyOn(learningContentRepository, "homework").mockResolvedValue({
      id: "homework-1",
      classId: "class-1",
      sessionId: "session-3",
      classCode: "TOAN-4A",
      className: "Toán tư duy 4A",
      sessionOrdinal: 3,
      title: "Luyện tập phân số",
      description: "Hoàn thành các bài tập phân số trong tài liệu.",
      status: "PUBLISHED",
      deadlineAt: "2026-09-20T20:00:00+07:00",
      recipientCount: 10,
      submittedCount: 7,
      reviewedCount: 5,
      audienceType: "CLASS",
      publishedAt: "2026-09-17T09:00:00+07:00",
      closedAt: null,
      resources: [],
      recipients: [
        {
          studentId: "student-1",
          code: "HS-0001",
          name: "Nguyễn An",
          addedAt: "2026-09-17T09:00:00+07:00",
          submitted: true,
          removed: false,
        },
      ],
      submissions: [
        {
          id: "submission-1",
          homeworkId: "homework-1",
          studentId: "student-1",
          studentCode: "HS-0001",
          studentName: "Nguyễn An",
          attemptNo: 1,
          note: "Em đã hoàn thành bài.",
          submittedAt: "2026-09-18T19:00:00+07:00",
          deadlineSnapshot: "2026-09-20T20:00:00+07:00",
          late: false,
          reviewStatus: "WAITING_REVIEW",
          files: [],
          review: null,
          version: 0,
        },
      ],
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
          <Route path="homeworks" element={<HomeworkWorkspacePage />} />
          <Route path="homeworks/classes/:classId" element={<HomeworkClassDetailPage />} />
          <Route path="homeworks/:homeworkId" element={<HomeworkDetailPage />} />
        </Route>
      </Routes>,
      ["/t/anh-duong/app/homeworks?classId=class-1"],
    );

    expect(await screen.findByText("Toán tư duy 4A")).toBeVisible();
    expect(screen.queryByPlaceholderText("Dán UUID lớp")).not.toBeInTheDocument();
    const classRow = screen.getByRole("row", { name: /Toán tư duy 4A/ });
    expect(within(classRow).getByText("Cô Lan")).toBeVisible();
    expect(within(classRow).getByText("2")).toBeVisible();
    await user.click(
      within(classRow).getByRole("link", { name: "Xem chi tiết lớp Toán tư duy 4A" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Bài tập của lớp Toán tư duy 4A" }),
    ).toBeVisible();
    expect(classHomeworks).toHaveBeenCalledWith("anh-duong", "class-1", {
      page: 1,
      pageSize: 100,
    });
    const homeworkRow = screen.getByRole("row", { name: /Luyện tập phân số/ });
    expect(within(homeworkRow).getByText("7/10 học sinh")).toBeVisible();
    expect(within(homeworkRow).getByText("5/7 bài đã nộp")).toBeVisible();
    const homeworkLink = within(homeworkRow).getByRole("link", {
      name: "Xem chi tiết bài tập Luyện tập phân số",
    });
    expect(homeworkLink).toHaveAttribute("href", "/t/anh-duong/app/homeworks/homework-1");
    await user.click(homeworkLink);

    expect(await screen.findByRole("heading", { name: "Luyện tập phân số" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Học sinh đã nộp bài" })).toBeVisible();
    expect(screen.getByRole("row", { name: /Nguyễn An/ })).toBeVisible();
  });
});
