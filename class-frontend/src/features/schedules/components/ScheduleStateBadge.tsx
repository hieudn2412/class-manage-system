import type { CalendarSession } from "../../../shared/types/domain";
import { Badge, type BadgeTone } from "../../../shared/ui/Badge";

type ScheduleState = CalendarSession["scheduleState"];

export const scheduleStatePresentation: Record<ScheduleState, { label: string; tone: BadgeTone }> =
  {
    UPCOMING: { label: "Sắp tới", tone: "neutral" },
    TAUGHT: { label: "Đã dạy", tone: "success" },
    MISSING_CHECK_IN: { label: "Chưa xác nhận", tone: "danger" },
    CANCELLED: { label: "Đã hủy", tone: "danger" },
  };

interface ScheduleStateBadgeProps {
  state: ScheduleState;
  count?: number;
}

export const ScheduleStateBadge = ({ state, count }: ScheduleStateBadgeProps) => {
  const presentation = scheduleStatePresentation[state];
  return (
    <Badge tone={presentation.tone}>
      {count === undefined ? presentation.label : `${count} ${presentation.label.toLowerCase()}`}
    </Badge>
  );
};
