import { env } from "../../shared/config/env";
import type { HomeworkSummary, StoredFile } from "../../shared/types/domain";

export const homeworkStatusLabel: Record<HomeworkSummary["status"], string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đang mở",
  CLOSED: "Đã đóng",
};

export const homeworkStatusTone: Record<
  HomeworkSummary["status"],
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  CLOSED: "warning",
};

export const fileHref = (file: StoredFile): string => {
  if (file.url.startsWith("http")) return file.url;
  const base = env.apiBaseUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  return `${base}${file.url}`;
};

export const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const rate = (count: number, total: number): string =>
  total === 0 ? "0%" : `${Math.round((count / total) * 100)}%`;
