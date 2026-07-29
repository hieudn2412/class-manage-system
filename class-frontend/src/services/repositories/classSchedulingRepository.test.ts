import { vi } from "vitest";
import type { ClassDraftInput } from "../../shared/types/domain";
import { saveSession } from "../../shared/lib/sessionStorage";
import { createTestSession } from "../../test/fixtures";
import { classRepository } from "./classRepository";

const input: ClassDraftInput = {
  name: "Kỹ năng giải toán 6",
  description: "Contract test",
  primaryTeacherId: "a2000000-0000-0000-0000-000000000001",
  startDate: "2026-08-04",
  totalSessions: 3,
  tuitionAmount: 1_500_000,
  hourlyRate: 200_000,
  capacity: 12,
  defaultMode: "ONLINE",
  studentIds: [],
  patterns: [
    {
      id: "tuesday",
      weekday: 2,
      startTime: "17:00",
      endTime: "18:30",
      mode: "ONLINE",
      roomId: null,
    },
  ],
  overrides: [],
};

describe("repository preview và publish", () => {
  it("không gửi link online và luôn gửi Idempotency-Key khi publish", async () => {
    saveSession(createTestSession(), false);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          previewId: "90000000-0000-0000-0000-000000000001",
          generatedAt: "2026-07-25T10:00:00Z",
          inputVersion: "v1",
          sessions: [],
          skippedHolidays: [],
          expectedEndDate: "2026-08-18",
          conflicts: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "80000000-0000-0000-0000-000000000001",
          code: "CLS-26002",
          name: input.name,
          status: "Scheduled",
        }),
      );

    const preview = await classRepository.previewSchedule("anh-duong", input);
    await classRepository.publishClass(
      "anh-duong",
      "80000000-0000-0000-0000-000000000001",
      { previewId: preview.previewId, acknowledgedWarningIds: [] },
      "publish-contract-test",
    );

    const previewOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(previewOptions.body).not.toContain("onlineUrl");
    expect(previewOptions.body).not.toContain("onlineLink");
    const publishOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(publishOptions.headers).get("Idempotency-Key")).toBe(
      "publish-contract-test",
    );
  });
});
