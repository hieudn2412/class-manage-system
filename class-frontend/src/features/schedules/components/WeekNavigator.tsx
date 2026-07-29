import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addCalendarDays,
  getTodayInBusinessTimezone,
  getWeekStart,
} from "../../../shared/lib/calendar";
import { Button } from "../../../shared/ui/Button";

interface WeekNavigatorProps {
  weekStart: string;
  onChange: (weekStart: string) => void;
}

export const WeekNavigator = ({ weekStart, onChange }: WeekNavigatorProps) => (
  <div className="week-navigator" aria-label="Điều hướng tuần">
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
      <CalendarDays size={17} aria-hidden="true" />
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
);
