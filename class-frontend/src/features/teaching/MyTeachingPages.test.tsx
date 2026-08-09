import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { TenantProvider } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { saveSession } from "../../shared/lib/sessionStorage";
import type { TeacherClassItem, TeacherClassSessions } from "../../shared/types/domain";
import { createTestSession, tenantAnhDuong } from "../../test/fixtures";
import { renderWithProviders } from "../../test/render";
import { MyClassesPage } from "./MyClassesPage";
import { MyClassSessionsPage } from "./MyClassSessionsPage";

const classItem: TeacherClassItem = {
  id: "class-1",
  code: "CLS-001",
  name: "Toán tư duy 4A",
  status: "ACTIVE",
  teacherRole: "PRIMARY",
  startDate: "2026-07-01",
  expectedEndDate: "2026-09-30",
  completedSessions: 4,
  totalSessions: 24,
  latestSessionAt: "2026-07-25T19:00:00+07:00",
};

const classSessions: TeacherClassSessions = {
  learningClass: {
    id: "class-1",
    code: "CLS-001",
    name: "Toán tư duy 4A",
    status: "ACTIVE",
    completedSessions: 4,
    totalSessions: 24,
  },
  sessions: {
    items: [
      {
        id: "session-1",
        ordinal: 4,
        startAt: "2026-07-25T19:00:00+07:00",
        endAt: "2026-07-25T20:30:00+07:00",
        status: "COMPLETED",
        actualTeacherName: "Nguyễn Ngọc Linh Đan",
        actualTeacher: true,
        readOnly: false,
        lessonName: "Phân số",
        participatedStudents: 4,
        rosterStudents: 4,
        missingDocumentation: false,
        hasTest: true,
        testResultCount: 2,
      },
    ],
    page: 2,
    pageSize: 20,
    totalItems: 21,
    totalPages: 2,
  },
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
};

const renderTenantPage = (element: ReactNode, childPath: string, initialEntry: string) =>
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
        <Route
          path={childPath}
          element={
            <>
              {element}
              <LocationProbe />
            </>
          }
        />
      </Route>
    </Routes>,
    [initialEntry],
  );

describe("responsive teaching lists", () => {
  beforeEach(() => {
    saveSession(createTestSession(), false);
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
  });

  it("đồng bộ bộ lọc lớp với URL và đưa phân trang về trang 1", async () => {
    const getClasses = vi.spyOn(teachingRepository, "getClasses").mockResolvedValue({
      items: [classItem],
      page: 2,
      pageSize: 12,
      totalItems: 13,
      totalPages: 2,
    });
    const user = userEvent.setup();

    renderTenantPage(
      <MyClassesPage />,
      "my-classes",
      "/t/anh-duong/app/my-classes?status=ACTIVE&role=PRIMARY&page=2",
    );

    expect(await screen.findByRole("heading", { name: "Lớp của tôi" })).toBeInTheDocument();
    expect(getClasses).toHaveBeenCalledWith(
      "anh-duong",
      expect.objectContaining({ status: "ACTIVE", role: "PRIMARY", page: 2 }),
    );

    await user.selectOptions(screen.getByLabelText("Trạng thái lớp"), "CLOSED");
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "?status=CLOSED&role=PRIMARY&page=1",
      ),
    );
    expect(getClasses).toHaveBeenLastCalledWith(
      "anh-duong",
      expect.objectContaining({ status: "CLOSED", role: "PRIMARY", page: 1 }),
    );
  });

  it("gửi trạng thái buổi cho API và giữ bộ lọc trong query string", async () => {
    const getClassSessions = vi
      .spyOn(teachingRepository, "getClassSessions")
      .mockResolvedValue(classSessions);
    const user = userEvent.setup();

    renderTenantPage(
      <MyClassSessionsPage />,
      "my-classes/:classId",
      "/t/anh-duong/app/my-classes/class-1?status=COMPLETED&page=2",
    );

    expect(await screen.findByRole("heading", { name: "Toán tư duy 4A" })).toBeInTheDocument();
    expect(getClassSessions).toHaveBeenCalledWith("anh-duong", "class-1", {
      status: "COMPLETED",
      page: 2,
      pageSize: 20,
    });

    await user.selectOptions(screen.getByLabelText("Trạng thái buổi"), "CANCELLED");
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent("?status=CANCELLED&page=1"),
    );
    expect(getClassSessions).toHaveBeenLastCalledWith("anh-duong", "class-1", {
      status: "CANCELLED",
      page: 1,
      pageSize: 20,
    });
  });
});
