import { afterEach, vi } from "vitest";
import { clearSession, saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession } from "../../test/fixtures";
import { profileRepository } from "./profileRepository";

afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
});

describe("profileRepository", () => {
  it("gọi đúng API đổi mật khẩu qua PUT", async () => {
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

  it("gọi đúng API cập nhật email qua PUT", async () => {
    saveSession(createTestSession(), false);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          scope: "TENANT",
          id: "user-1",
          tenant: { id: "tenant-1", slug: "anh-duong", name: "Trung tâm Ánh Dương" },
          profileType: "STAFF",
          code: null,
          username: "admin",
          displayName: "Admin",
          email: "admin@example.vn",
          roles: ["ADMIN"],
          status: "ACTIVE",
          parentName: null,
          parentPhone: null,
          lastLoginAt: null,
          createdAt: "2026-09-01T00:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await profileRepository.updateEmail({ email: "admin@example.vn" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/profile/me/email",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ email: "admin@example.vn" }),
      }),
    );
  });
});
