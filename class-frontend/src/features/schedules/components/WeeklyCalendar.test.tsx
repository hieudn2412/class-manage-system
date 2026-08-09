import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarSession, WeekSchedule } from "../../../shared/types/domain";
import { WeeklyCalendar } from "./WeeklyCalendar";

const session = (
  id: string,
  scheduleState: CalendarSession["scheduleState"],
  startAt: string,
): CalendarSession => ({
  id,
  classId: `class-${id}`,
  classCode: `CLS-${id}`,
  className: `Lớp ${id}`,
  ordinal: 1,
  startAt,
  endAt: new Date(Date.parse(startAt) + 90 * 60 * 1000).toISOString(),
  plannedTeacherId: "teacher-1",
  actualTeacherId: "teacher-1",
  teacherName: "Nguyễn Ngọc Linh Đan",
  mode: "IN_PERSON",
  roomId: "room-1",
  roomName: "Phòng A1",
  onlineUrl: null,
  isSubstitution: false,
  isMakeup: false,
  status: scheduleState === "CANCELLED" ? "CANCELLED" : "SCHEDULED",
  scheduleState,
  makeupRootSessionId: null,
  replacesSessionId: null,
  replacementSessionId: null,
  cancellationReason: null,
  allowedActions: [],
  version: 0,
});

describe("WeeklyCalendar", () => {
  it("renders aggregate state tags for concurrent sessions and individual state tags", () => {
    const sessions = [
      session("1", "UPCOMING", "2026-08-03T12:00:00Z"),
      session("2", "TAUGHT", "2026-08-03T12:00:00Z"),
      session("3", "MISSING_CHECK_IN", "2026-08-04T12:00:00Z"),
    ];
    const schedule: WeekSchedule = {
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      sessions,
    };
    const onSelectSessions = vi.fn();

    render(<WeeklyCalendar schedule={schedule} onSelectSessions={onSelectSessions} />);

    expect(screen.getByText("2 lớp cùng ca")).toBeInTheDocument();
    expect(screen.getByText("1 sắp tới")).toBeInTheDocument();
    expect(screen.getByText("1 đã dạy")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa check-in")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Mở 2 lớp cùng ca/ }));
    expect(onSelectSessions).toHaveBeenCalledWith(sessions.slice(0, 2));
  });
});
