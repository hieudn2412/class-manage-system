import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TenantProvider } from "../../../app/providers/TenantProvider";
import { scheduleRepository } from "../../../services/repositories/scheduleRepository";
import { authRepository } from "../../../services/repositories/authRepository";
import { tenantAnhDuong } from "../../../test/fixtures";
import { renderWithProviders } from "../../../test/render";
import type { ClassSchedulingOptions, SchedulePreview } from "../../../shared/types/domain";
import { SessionMutationModal } from "./SessionMutationModal";

const options: ClassSchedulingOptions = {
  teachers: [
    { id: "teacher-current", name: "Cô Lan" },
    { id: "teacher-replacement", name: "Cô Hà" },
  ],
  rooms: [{ id: "room-101", code: "P101", name: "Phòng 101", capacity: 20, status: "ACTIVE" }],
};

const preview: SchedulePreview = {
  previewId: "preview-substitution",
  generatedAt: "2026-08-05T07:00:00Z",
  inputVersion: "v1",
  sessions: [],
  skippedHolidays: [],
  expectedEndDate: "2026-08-31",
  conflicts: [],
};

const ModalRoutes = () => (
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
        path="schedules"
        element={
          <SessionMutationModal
            action="SUBSTITUTE_TEACHER"
            session={{
              id: "session-1",
              className: "Toán tư duy 4A",
              classCode: "CLS-001",
              ordinal: 2,
              startAt: "2026-08-10T09:00:00+07:00",
              endAt: "2026-08-10T10:30:00+07:00",
              actualTeacherId: "teacher-current",
              actualTeacherName: "Cô Lan",
              mode: "IN_PERSON",
              roomId: "room-101",
              version: 3,
            }}
            options={options}
            onClose={vi.fn()}
            onSaved={vi.fn()}
          />
        }
      />
    </Route>
  </Routes>
);

describe("SessionMutationModal", () => {
  it("gọi preview khi chọn giáo viên thay thế và nhấn kiểm tra lịch", async () => {
    vi.spyOn(authRepository, "getTenant").mockResolvedValue(tenantAnhDuong);
    const previewSubstitution = vi
      .spyOn(scheduleRepository, "previewSubstitution")
      .mockResolvedValue(preview);
    const user = userEvent.setup();

    renderWithProviders(<ModalRoutes />, ["/t/anh-duong/app/schedules"]);

    await screen.findByRole("dialog", { name: "Thay giáo viên" });
    await user.selectOptions(screen.getByLabelText("Giáo viên thay thế"), "teacher-replacement");
    await user.click(screen.getByRole("button", { name: "Kiểm tra lịch" }));

    await waitFor(() =>
      expect(previewSubstitution).toHaveBeenCalledWith("anh-duong", "session-1", {
        teacherId: "teacher-replacement",
        note: "",
        version: 3,
      }),
    );
    expect(await screen.findByText("Không có xung đột. Có thể xác nhận thao tác.")).toBeVisible();
  });
});
