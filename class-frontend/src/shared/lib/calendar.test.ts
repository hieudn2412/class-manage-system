import { describe, expect, it } from "vitest";
import { dateKeyFromIso, timeFromIso } from "./calendar";

describe("business timezone calendar helpers", () => {
  it.each(["2026-08-04T12:00:00Z", "2026-08-04T19:00:00+07:00"])(
    "renders %s as the same Vietnam date and time",
    (value) => {
      expect(dateKeyFromIso(value)).toBe("2026-08-04");
      expect(timeFromIso(value)).toBe("19:00");
    },
  );

  it("moves a late UTC timestamp into the next Vietnam calendar day", () => {
    expect(dateKeyFromIso("2026-08-04T18:30:00Z")).toBe("2026-08-05");
    expect(timeFromIso("2026-08-04T18:30:00Z")).toBe("01:30");
  });
});
