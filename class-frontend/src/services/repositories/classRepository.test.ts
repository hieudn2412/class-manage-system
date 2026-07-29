import { vi } from "vitest";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession } from "../../test/fixtures";
import { classRepository } from "./classRepository";

describe("classRepository dùng hợp đồng API thật", () => {
  it("gọi base URL Spring Boot và ánh xạ RFC 7807", async () => {
    saveSession(createTestSession(), false);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://classops.vn/problems/class-not-found",
          title: "Not Found",
          status: 404,
          detail: "Không tìm thấy lớp.",
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp.",
          fieldErrors: {},
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
    );

    await expect(classRepository.getClass("anh-duong", "missing-class")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Không tìm thấy lớp.",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:8080/api/v1/classes/missing-class");
  });
});
