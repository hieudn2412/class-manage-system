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

    expect(
      getApiErrorMessage({
        code: "CURRENT_PASSWORD_INVALID",
        message: "Bad current password",
      }),
    ).toBe("Mật khẩu hiện tại chưa đúng. Vui lòng kiểm tra và thử lại.");
    expect(
      getApiErrorMessage({
        code: "PASSWORD_REUSE_NOT_ALLOWED",
        message: "Password reused",
      }),
    ).toBe("Mật khẩu mới cần khác mật khẩu hiện tại.");
  });

  it("normalizes technical terms in messages from unknown error codes", () => {
    expect(normalizeUserFacingText("Tenant quota exceeded after upload.")).toBe(
      "trung tâm hạn mức dung lượng exceeded after tải lên.",
    );
  });
});
