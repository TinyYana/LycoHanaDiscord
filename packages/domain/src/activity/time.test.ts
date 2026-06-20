import { describe, expect, it } from "vitest";
import { dateKey, monthRange, rollingWindowStart } from "./time";

const TPE = "Asia/Taipei";

describe("dateKey", () => {
  it("formats as YYYY-MM-DD in the given timezone", () => {
    const noonUtc = new Date("2026-06-20T03:00:00Z"); // 11:00 in Taipei
    expect(dateKey(noonUtc, TPE)).toBe("2026-06-20");
  });

  it("respects the timezone across a UTC day boundary", () => {
    const lateUtc = new Date("2026-06-20T16:30:00Z"); // 00:30 next day in Taipei
    expect(dateKey(lateUtc, "UTC")).toBe("2026-06-20");
    expect(dateKey(lateUtc, TPE)).toBe("2026-06-21");
  });
});

describe("monthRange", () => {
  it("spans the first of the month to the current day, inclusive", () => {
    const date = new Date("2026-06-20T03:00:00Z");
    expect(monthRange(date, TPE)).toEqual({ start: "2026-06-01", end: "2026-06-20" });
  });
});

describe("rollingWindowStart", () => {
  const date = new Date("2026-06-20T03:00:00Z"); // 2026-06-20 in Taipei

  it("includes exactly `days` calendar days counting the end day", () => {
    // 30-day inclusive window ending 06-20 starts 29 days earlier: 05-22.
    expect(rollingWindowStart(date, 30, TPE)).toBe("2026-05-22");
  });

  it("a 1-day window starts on the end day itself", () => {
    expect(rollingWindowStart(date, 1, TPE)).toBe("2026-06-20");
  });

  it("a 7-day window ending 06-20 starts 06-14", () => {
    expect(rollingWindowStart(date, 7, TPE)).toBe("2026-06-14");
  });
});
