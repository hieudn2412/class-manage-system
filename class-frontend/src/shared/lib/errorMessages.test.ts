import { describe, expect, it } from "vitest";
import { getApiErrorMessage, normalizeUserFacingText } from "./errorMessages";

describe("friendly API messages", () => {
  it("maps technical error codes to an actionable message", () => {
    expect(
      getApiErrorMessage({
        code: "CHECK_IN_WINDOW_CLOSED",
        message: "Check-in window has closed",
      }),
    ).toBe("Đã hết thời gian xác nhận buổi dạy. Vui lòng liên hệ quản lý học vụ.");
  });

  it("normalizes technical terms in messages from unknown error codes", () => {
    expect(normalizeUserFacingText("Tenant quota exceeded after upload.")).toBe(
      "trung tâm hạn mức dung lượng exceeded after tải lên.",
    );
  });
});
