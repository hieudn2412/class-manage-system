import type { BadgeTone } from "../../shared/ui/Badge";
import type { ClassStatus } from "../../shared/types/domain";

export const classStatusLabels: Record<ClassStatus, string> = {
  Draft: "Nháp",
  Scheduled: "Đã xếp lịch",
  Active: "Đang học",
  AwaitingClose: "Chờ kết thúc",
  Closed: "Đã đóng",
  Cancelled: "Đã hủy",
};

export const classStatusTones: Record<ClassStatus, BadgeTone> = {
  Draft: "neutral",
  Scheduled: "info",
  Active: "success",
  AwaitingClose: "warning",
  Closed: "neutral",
  Cancelled: "danger",
};
