import { env } from "../../shared/config/env";
import { loadSession } from "../../shared/lib/sessionStorage";
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

const absoluteFileUrl = (value: string): string => {
  if (value.startsWith("http") || value.startsWith("blob:")) return value;
  const base = env.apiBaseUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  return `${base}${value}`;
};

export const fileHref = (file: StoredFile): string => absoluteFileUrl(file.url);

export const filePreviewHref = (file: StoredFile): string =>
  absoluteFileUrl(file.previewUrl || file.url);

export const downloadPrivateFile = async (file: StoredFile, tenantSlug: string): Promise<void> => {
  const token = loadSession()?.token;
  if (!token) throw new Error("Phiên đăng nhập không hợp lệ.");
  const response = await fetch(fileHref(file), {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Slug": tenantSlug,
      Accept: file.contentType || "application/octet-stream",
    },
  });
  if (!response.ok) throw new Error("Không tải được file.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.originalFilename || "download";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

export const isPreviewableImageFile = (file: StoredFile): boolean => {
  const contentType = file.contentType.toLowerCase();
  const filename = file.originalFilename.toLowerCase();
  const hasGeneratedPreview = Boolean(file.previewUrl && file.previewUrl !== file.url);
  return (
    /^image\/(png|jpe?g|gif|webp|bmp)$/.test(contentType) ||
    /\.(png|jpe?g|gif|webp|bmp)$/.test(filename) ||
    (contentType.startsWith("image/") && hasGeneratedPreview)
  );
};

export const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const rate = (count: number, total: number): string =>
  total === 0 ? "0%" : `${Math.round((count / total) * 100)}%`;
