import { z } from "zod";
import type { ClassDraftInput } from "../../shared/types/domain";

const patternSchema = z
  .object({
    id: z.string().min(1),
    weekday: z.number().int().min(1).max(7),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ bắt đầu không hợp lệ."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ kết thúc không hợp lệ."),
    mode: z.enum(["IN_PERSON", "ONLINE"]),
    roomId: z.string().nullable(),
  })
  .superRefine((value, context) => {
    if (value.endTime <= value.startTime) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Giờ kết thúc phải sau giờ bắt đầu.",
      });
    }
    if (value.mode === "IN_PERSON" && !value.roomId) {
      context.addIssue({
        code: "custom",
        path: ["roomId"],
        message: "Hãy chọn phòng học.",
      });
    }
  });

const overrideSchema = z.object({
  sessionKey: z.string().min(1),
  mode: z.enum(["IN_PERSON", "ONLINE"]),
  roomId: z.string().nullable(),
});

export const classDraftSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên lớp."),
  description: z.string(),
  primaryTeacherId: z.string().min(1, "Vui lòng chọn giáo viên chính."),
  startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu."),
  totalSessions: z
    .number()
    .int("Tổng số buổi phải là số nguyên.")
    .positive("Tổng số buổi phải lớn hơn 0."),
  tuitionAmount: z.number().int("Học phí phải là số nguyên.").positive("Học phí phải lớn hơn 0."),
  hourlyRate: z.number().int("Đơn giá phải là số nguyên.").positive("Đơn giá phải lớn hơn 0."),
  capacity: z
    .number()
    .int("Sĩ số tối đa phải là số nguyên.")
    .positive("Sĩ số tối đa phải lớn hơn 0.")
    .nullable(),
  defaultMode: z.enum(["IN_PERSON", "ONLINE"]),
  studentIds: z.array(z.string()),
  patterns: z.array(patternSchema),
  overrides: z.array(overrideSchema),
}) satisfies z.ZodType<ClassDraftInput>;

export const classPublishSchema = classDraftSchema.extend({
  patterns: z.array(patternSchema).min(1, "Cần ít nhất một ca lặp để xem trước lịch."),
});

export type ClassFormValues = ClassDraftInput;
