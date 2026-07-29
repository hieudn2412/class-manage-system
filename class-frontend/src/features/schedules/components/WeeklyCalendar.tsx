import { Clock3, Layers3, MapPin, Video } from "lucide-react";
import { dateKeyFromIso, getWeekDateKeys, timeFromIso } from "../../../shared/lib/calendar";
import { formatDate } from "../../../shared/lib/format";
import type { CalendarSession, WeekSchedule } from "../../../shared/types/domain";

interface WeeklyCalendarProps {
  schedule: WeekSchedule;
  onSelectSessions: (sessions: CalendarSession[]) => void;
}

interface SessionGroup {
  key: string;
  time: string;
  date: string;
  sessions: CalendarSession[];
}

const weekdayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

export const WeeklyCalendar = ({ schedule, onSelectSessions }: WeeklyCalendarProps) => {
  const dates = getWeekDateKeys(schedule.weekStart);
  const groups = new Map<string, SessionGroup>();
  schedule.sessions.forEach((session) => {
    const date = dateKeyFromIso(session.startAt);
    const time = `${timeFromIso(session.startAt)}–${timeFromIso(session.endAt)}`;
    const key = `${date}:${time}`;
    const current = groups.get(key) ?? { key, date, time, sessions: [] };
    current.sessions.push(session);
    groups.set(key, current);
  });
  const times = [...new Set([...groups.values()].map((group) => group.time))].sort();

  return (
    <div
      className="calendar-scroll"
      tabIndex={0}
      aria-label="Thời khóa biểu tuần, có thể cuộn ngang"
    >
      <div className="weekly-calendar" role="grid" aria-label="Các buổi học trong tuần">
        <div className="calendar-header-row" role="row">
          <div className="calendar-corner" role="columnheader">
            <Clock3 size={16} aria-hidden="true" />
          </div>
          {dates.map((date, index) => (
            <div className="calendar-day-head" role="columnheader" key={date}>
              <strong>{weekdayNames[index]}</strong>
              <span>{formatDate(date).slice(0, 5)}</span>
            </div>
          ))}
        </div>
        {times.map((time) => (
          <div className="calendar-row" role="row" key={time}>
            <div className="calendar-time" role="rowheader">
              {time}
            </div>
            {dates.map((date) => {
              const group = groups.get(`${date}:${time}`);
              return (
                <div className="calendar-cell" role="gridcell" key={`${date}-${time}`}>
                  {group ? (
                    <button
                      type="button"
                      className="calendar-event"
                      onClick={() => onSelectSessions(group.sessions)}
                      aria-label={
                        group.sessions.length > 1
                          ? `Mở ${group.sessions.length} lớp cùng ca ${time}`
                          : `Mở buổi ${group.sessions[0]?.className ?? ""}`
                      }
                    >
                      {group.sessions.length > 1 ? (
                        <>
                          <Layers3 size={16} aria-hidden="true" />
                          <strong>{group.sessions.length} lớp cùng ca</strong>
                          <small>Nhấn để xem chi tiết</small>
                        </>
                      ) : (
                        <>
                          <strong>{group.sessions[0]?.className}</strong>
                          <small>
                            {group.sessions[0]?.mode === "ONLINE" ? (
                              <Video size={12} aria-hidden="true" />
                            ) : (
                              <MapPin size={12} aria-hidden="true" />
                            )}
                            {group.sessions[0]?.roomName ?? "Online"}
                          </small>
                          <small>{group.sessions[0]?.teacherName}</small>
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
