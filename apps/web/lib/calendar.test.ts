import { describe, expect, it } from "vitest";
import {
  dateKey,
  formatMonthParam,
  getMonthGrid,
  localDateKey,
  parseMonthParam,
} from "./calendar";

describe("getMonthGrid", () => {
  it("pads September 2026 (starts Tuesday) with 2 leading days", () => {
    const grid = getMonthGrid(2026, 8); // September = index 8
    expect(dateKey(grid[0]!.date)).toBe("2026-08-30");
    expect(grid[0]!.inCurrentMonth).toBe(false);
    expect(dateKey(grid[2]!.date)).toBe("2026-09-01");
    expect(grid[2]!.inCurrentMonth).toBe(true);
  });

  it("always returns a multiple of 7 cells", () => {
    for (let month = 0; month < 12; month++) {
      const grid = getMonthGrid(2026, month);
      expect(grid.length % 7).toBe(0);
    }
  });

  it("includes every day of the month exactly once, in order", () => {
    const grid = getMonthGrid(2026, 1); // February 2026 (not a leap year)
    const daysInMonth = grid.filter((c) => c.inCurrentMonth);
    expect(daysInMonth).toHaveLength(28);
    expect(dateKey(daysInMonth[0]!.date)).toBe("2026-02-01");
    expect(dateKey(daysInMonth[27]!.date)).toBe("2026-02-28");
  });
});

describe("localDateKey", () => {
  it("rolls a late-UTC evening post into the next day for a timezone ahead of UTC", () => {
    // The exact bug report: a post at 8PM UTC is already past midnight in
    // Karachi (UTC+5) - it belongs on the 14th's calendar cell, not the 13th.
    const scheduledFor = new Date("2026-09-13T20:10:00.000Z");
    expect(dateKey(scheduledFor)).toBe("2026-09-13");
    expect(localDateKey(scheduledFor, "Asia/Karachi")).toBe("2026-09-14");
  });

  it("rolls an early-UTC morning post back a day for a timezone behind UTC", () => {
    const scheduledFor = new Date("2026-09-14T02:00:00.000Z");
    expect(localDateKey(scheduledFor, "America/Los_Angeles")).toBe("2026-09-13");
  });

  it("matches plain UTC dateKey for a UTC-scheduled org", () => {
    const scheduledFor = new Date("2026-09-13T20:10:00.000Z");
    expect(localDateKey(scheduledFor, "UTC")).toBe(dateKey(scheduledFor));
  });
});

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM string", () => {
    expect(parseMonthParam("2026-09")).toEqual({ year: 2026, month: 8 });
  });

  it("falls back to the current month for missing/invalid input", () => {
    const now = new Date();
    expect(parseMonthParam(undefined)).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth(),
    });
    expect(parseMonthParam("not-a-month")).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth(),
    });
  });
});

describe("formatMonthParam", () => {
  it("formats and round-trips through parseMonthParam", () => {
    const formatted = formatMonthParam(2026, 0);
    expect(formatted).toBe("2026-01");
    expect(parseMonthParam(formatted)).toEqual({ year: 2026, month: 0 });
  });
});
