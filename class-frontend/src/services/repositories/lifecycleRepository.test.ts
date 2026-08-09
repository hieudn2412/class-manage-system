import { vi } from "vitest";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession } from "../../test/fixtures";
import { lifecycleRepository } from "./lifecycleRepository";

describe("lifecycleRepository", () => {
  it("giữ warning details RFC 7807 để UI xác nhận lại", async () => {
    saveSession(createTestSession(), false);
    const warning = {
      id: "CLASS_CAPACITY:class-1",
      code: "CLASS_CAPACITY",
      message: "Vượt sĩ số lớp.",
      studentIds: ["student-1"],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 409,
          detail: "Cần xác nhận cảnh báo.",
          code: "WARNINGS_NOT_ACKNOWLEDGED",
          message: "Cần xác nhận cảnh báo.",
          details: { warnings: [warning] },
        }),
        { status: 409, headers: { "Content-Type": "application/problem+json" } },
      ),
    );

    await expect(
      lifecycleRepository.addEnrollments(
        "anh-duong",
        "class-1",
        ["student-1"],
        3,
        [],
        "fl06-test-key",
      ),
    ).rejects.toMatchObject({
      code: "WARNINGS_NOT_ACKNOWLEDGED",
      details: { warnings: [warning] },
    });
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(options.headers).get("Idempotency-Key")).toBe("fl06-test-key");
    const requestBody = options.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") throw new Error("Expected JSON request body");
    expect(JSON.parse(requestBody)).toEqual({
      studentIds: ["student-1"],
      classVersion: 3,
      acknowledgedWarningIds: [],
    });
  });
});
