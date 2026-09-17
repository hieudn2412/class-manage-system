import { Clock3, Layers3, MapPin, Video } from "lucide-react";
import {
  dateKeyFromIso,
  getTodayInBusinessTimezone,
  getWeekDateKeys,
  timeFromIso,
} from "../../../shared/lib/calendar";
import { cn } from "../../../shared/lib/cn";
import { formatDate } from "../../../shared/lib/format";
import type { CalendarSession, WeekSchedule } from "../../../shared/types/domain";
import { ScheduleStateBadge } from "./ScheduleStateBadge";

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
const stateOrder: Array<CalendarSession["scheduleState"]> = [
  "UPCOMING",
  "TAUGHT",
  "MISSING_CHECK_IN",
  "CANCELLED",
];

export const WeeklyCalendar = ({ schedule, onSelectSessions }: WeeklyCalendarProps) => {
  const dates = getWeekDateKeys(schedule.weekStart);
  const today = getTodayInBusinessTimezone();
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
  const groupsByDate = dates.map((date) => ({
    date,
    groups: [...groups.values()]
      .filter((group) => group.date === date)
      .sort((left, right) => left.time.localeCompare(right.time)),
  }));

  return (
    <section className="calendar-board" aria-label="Thời khóa biểu và chú giải trạng thái">
      <div className="calendar-legend" aria-label="Chú giải trạng thái buổi học">
        <strong>Trạng thái buổi</strong>
        {stateOrder.map((state) => (
          <ScheduleStateBadge state={state} key={state} />
        ))}
      </div>
      <div
        className="calendar-scroll calendar-week-view"
        tabIndex={0}
        aria-label="Thời khóa biểu tuần, có thể cuộn ngang"
      >
        <div className="weekly-calendar" role="grid" aria-label="Các buổi học trong tuần">
          <div className="calendar-header-row" role="row">
            <div className="calendar-corner" role="columnheader">
              <Clock3 size={17} aria-hidden="true" />
              <span>Giờ học</span>
            </div>
            {dates.map((date, index) => (
              <div
                className={cn("calendar-day-head", date === today && "is-today")}
                role="columnheader"
                key={date}
              >
                <strong>{weekdayNames[index]}</strong>
                <span>{formatDate(date).slice(0, 5)}</span>
                {date === today ? <small>Hôm nay</small> : null}
              </div>
            ))}
          </div>
          {times.map((time) => {
            const [startTime, endTime] = time.split("–");
            return (
              <div className="calendar-row" role="row" key={time}>
                <div className="calendar-time" role="rowheader">
                  <strong>{startTime}</strong>
                  <small>đến</small>
                  <span>{endTime}</span>
                </div>
                {dates.map((date) => {
                  const group = groups.get(`${date}:${time}`);
                  const stateCounts = group?.sessions.reduce<
                    Partial<Record<CalendarSession["scheduleState"], number>>
                  >((counts, session) => {
                    counts[session.scheduleState] = (counts[session.scheduleState] ?? 0) + 1;
                    return counts;
                  }, {});
                  const session = group?.sessions[0];
                  return (
                    <div className="calendar-cell" role="gridcell" key={`${date}-${time}`}>
                      {group && session ? (
                        <button
                          type="button"
                          className={`calendar-event${session.status === "CANCELLED" ? " is-cancelled" : ""}`}
                          onClick={() => onSelectSessions(group.sessions)}
                          aria-label={
                            group.sessions.length > 1
                              ? `Mở ${group.sessions.length} lớp cùng ca ${time}`
                              : `Mở buổi ${session.className}`
                          }
                        >
                          {group.sessions.length > 1 ? (
                            <>
                              <span className="calendar-event-heading">
                                <Layers3 size={16} aria-hidden="true" />
                                <strong>{group.sessions.length} lớp cùng ca</strong>
                              </span>
                              <span className="calendar-event-statuses">
                                {stateOrder.map((state) =>
                                  stateCounts?.[state] ? (
                                    <ScheduleStateBadge
                                      state={state}
                                      count={stateCounts[state]}
                                      key={state}
                                    />
                                  ) : null,
                                )}
                              </span>
                              <small>Nhấn để xem từng buổi</small>
                            </>
                          ) : (
                            <>
                              <span className="calendar-event-heading">
                                <small>Buổi {session.ordinal}</small>
                                <ScheduleStateBadge state={session.scheduleState} />
                              </span>
                              <strong>{session.className}</strong>
                              {session.isMakeup || session.isSubstitution ? (
                                <span className="calendar-event-tags">
                                  {session.isMakeup ? <span>Buổi bù</span> : null}
                                  {session.isSubstitution ? <span>Dạy thay</span> : null}
                                </span>
                              ) : null}
                              <small>
                                {session.mode === "ONLINE" ? (
                                  <Video size={12} aria-hidden="true" />
                                ) : (
                                  <MapPin size={12} aria-hidden="true" />
                                )}
                                {session.roomName ?? "Trực tuyến"}
                              </small>
                              <small>{session.teacherName}</small>
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="calendar-agenda" aria-label="Danh sách buổi học theo ngày">
        {groupsByDate.map(({ date, groups: dayGroups }, index) => (
          <section className={cn("calendar-agenda-day", date === today && "is-today")} key={date}>
            <header className="calendar-agenda-day-heading">
              <span>
                <strong>{date === today ? "Hôm nay" : weekdayNames[index]}</strong>
                <small>{formatDate(date)}</small>
              </span>
              <span>{dayGroups.length ? `${dayGroups.length} ca học` : "Không có lịch"}</span>
            </header>
            {dayGroups.length ? (
              <div className="calendar-agenda-events">
                {dayGroups.map((group) => {
                  const session = group.sessions[0];
                  const stateCounts = group.sessions.reduce<
                    Partial<Record<CalendarSession["scheduleState"], number>>
                  >((counts, item) => {
                    counts[item.scheduleState] = (counts[item.scheduleState] ?? 0) + 1;
                    return counts;
                  }, {});
                  return (
                    <button
                      type="button"
                      className="calendar-agenda-event"
                      onClick={() => onSelectSessions(group.sessions)}
                      key={group.key}
                    >
                      <span className="calendar-agenda-time">
                        <Clock3 size={16} aria-hidden="true" />
                        <strong>{group.time}</strong>
                      </span>
                      {group.sessions.length > 1 ? (
                        <span className="calendar-agenda-summary">
                          <span className="calendar-event-heading">
                            <Layers3 size={16} aria-hidden="true" />
                            <strong>{group.sessions.length} lớp cùng ca</strong>
                          </span>
                          <span className="calendar-event-statuses">
                            {stateOrder.map((state) =>
                              stateCounts[state] ? (
                                <ScheduleStateBadge
                                  state={state}
                                  count={stateCounts[state]}
                                  key={state}
                                />
                              ) : null,
                            )}
                          </span>
                        </span>
                      ) : session ? (
                        <span className="calendar-agenda-summary">
                          <span className="calendar-event-heading">
                            <strong>{session.className}</strong>
                            <ScheduleStateBadge state={session.scheduleState} />
                          </span>
                          <small>
                            Buổi {session.ordinal} · {session.teacherName}
                          </small>
                          <small>
                            {session.mode === "ONLINE" ? (
                              <Video size={13} aria-hidden="true" />
                            ) : (
                              <MapPin size={13} aria-hidden="true" />
                            )}
                            {session.roomName ?? "Trực tuyến"}
                            {session.isMakeup ? " · Buổi bù" : ""}
                            {session.isSubstitution ? " · Dạy thay" : ""}
                          </small>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="calendar-agenda-empty">Không có buổi học trong ngày này.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
};
