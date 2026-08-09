import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addCalendarDays,
  getTodayInBusinessTimezone,
  getWeekEnd,
  getWeekStart,
} from "../../../shared/lib/calendar";
import { formatDate } from "../../../shared/lib/format";
import { Button } from "../../../shared/ui/Button";

interface WeekNavigatorProps {
  weekStart: string;
  onChange: (weekStart: string) => void;
}

export const WeekNavigator = ({ weekStart, onChange }: WeekNavigatorProps) => {
  const weekEnd = getWeekEnd(weekStart);
  return (
    <div className="week-navigator" aria-label="Điều hướng tuần">
      <div className="week-range-highlight" aria-live="polite">
        <CalendarDays size={19} aria-hidden="true" />
        <span>
          <small>Khoảng thời gian của tuần</small>
          <strong>
            {formatDate(weekStart).slice(0, 5)} – {formatDate(weekEnd)}
          </strong>
        </span>
      </div>
      <div className="week-navigation-controls">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange(addCalendarDays(weekStart, -7))}
        >
          <ChevronLeft size={17} aria-hidden="true" />
          Tuần trước
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange(getWeekStart(getTodayInBusinessTimezone()))}
        >
          Hôm nay
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange(addCalendarDays(weekStart, 7))}
        >
          Tuần sau
          <ChevronRight size={17} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};
