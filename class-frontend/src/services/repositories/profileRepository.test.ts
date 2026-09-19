import { afterEach, vi } from "vitest";
import { clearSession, saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession } from "../../test/fixtures";
import { profileRepository } from "./profileRepository";

afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
});

describe("profileRepository", () => {
  it("gọi đúng API hồ sơ và gửi mật khẩu qua PUT", async () => {
    saveSession(createTestSession(), false);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(createTestSession()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await profileRepository.changePassword({
      currentPassword: "Demo@123",
      newPassword: "NewDemo@2026",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/profile/me/password",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          currentPassword: "Demo@123",
          newPassword: "NewDemo@2026",
        }),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toMatch(/^Bearer /);
  });
});
