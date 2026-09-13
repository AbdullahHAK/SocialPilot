import { describe, expect, it } from "vitest";
import { computeUpcomingSlotOccurrences } from "./schedule-dates";

describe("computeUpcomingSlotOccurrences", () => {
  it("returns the next occurrence of a slot later this week", () => {
    // Monday 2026-09-14 is a Monday.
    const from = new Date("2026-09-14T00:00:00Z");
    const result = computeUpcomingSlotOccurrences(
      [{ dayOfWeek: "WEDNESDAY", time: "09:00", platform: "INSTAGRAM" }],
      { from, days: 7 },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.date.toISOString()).toBe("2026-09-16T09:00:00.000Z");
    expect(result[0]!.platform).toBe("INSTAGRAM");
  });

  it("rolls over to next week when the time today has already passed", () => {
    const from = new Date("2026-09-14T12:00:00Z"); // Monday noon
    const result = computeUpcomingSlotOccurrences(
      [{ dayOfWeek: "MONDAY", time: "09:00", platform: "FACEBOOK" }],
      { from, days: 10 },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.date.toISOString()).toBe("2026-09-21T09:00:00.000Z");
  });

  it("includes today's slot if its time hasn't passed yet", () => {
    const from = new Date("2026-09-14T06:00:00Z"); // Monday 6am
    const result = computeUpcomingSlotOccurrences(
      [{ dayOfWeek: "MONDAY", time: "09:00", platform: "INSTAGRAM" }],
      { from, days: 10 },
    );

    expect(result[0]!.date.toISOString()).toBe("2026-09-14T09:00:00.000Z");
  });

  it("returns multiple occurrences across the window, sorted chronologically", () => {
    const from = new Date("2026-09-14T00:00:00Z");
    const result = computeUpcomingSlotOccurrences(
      [
        { dayOfWeek: "FRIDAY", time: "11:00", platform: "INSTAGRAM" },
        { dayOfWeek: "MONDAY", time: "09:00", platform: "FACEBOOK" },
      ],
      { from, days: 14 },
    );

    const isoDates = result.map((r) => r.date.toISOString());
    expect(isoDates).toEqual([
      "2026-09-14T09:00:00.000Z",
      "2026-09-18T11:00:00.000Z",
      "2026-09-21T09:00:00.000Z",
      "2026-09-25T11:00:00.000Z",
    ]);
  });

  it("returns an empty array for no slots", () => {
    expect(computeUpcomingSlotOccurrences([])).toEqual([]);
  });

  describe("with a non-UTC timezone", () => {
    it("interprets the slot's time as local, not UTC (the reported bug)", () => {
      // A slot at 10:55 for an org in Asia/Karachi (UTC+5) means 10:55
      // Karachi time, i.e. 05:55 UTC - not literally 10:55 UTC.
      const from = new Date("2026-09-13T06:14:00.000Z"); // just past 05:55 UTC
      const result = computeUpcomingSlotOccurrences(
        [{ dayOfWeek: "SUNDAY", time: "10:55", platform: "INSTAGRAM" }],
        { from, days: 8, timezone: "Asia/Karachi" },
      );

      // 2026-09-13 is a Sunday; already-past-today rolls to next Sunday.
      expect(result[0]!.date.toISOString()).toBe("2026-09-20T05:55:00.000Z");
    });

    it("keeps today's occurrence if it hasn't happened yet in local time", () => {
      const from = new Date("2026-09-13T05:00:00.000Z"); // 10:00 AM in Karachi
      const result = computeUpcomingSlotOccurrences(
        [{ dayOfWeek: "SUNDAY", time: "10:55", platform: "INSTAGRAM" }],
        { from, days: 1, timezone: "Asia/Karachi" },
      );

      expect(result[0]!.date.toISOString()).toBe("2026-09-13T05:55:00.000Z");
    });

    it("computes the correct weekday from the org's local calendar, not UTC's", () => {
      // 2026-09-13T21:00:00Z is still Sunday in UTC, but already Monday
      // 02:00 in Karachi (+5) - "Monday" slots should resolve to today.
      const from = new Date("2026-09-13T21:00:00.000Z");
      const result = computeUpcomingSlotOccurrences(
        [{ dayOfWeek: "MONDAY", time: "09:00", platform: "FACEBOOK" }],
        { from, days: 1, timezone: "Asia/Karachi" },
      );

      // Monday 09:00 Karachi = 04:00 UTC the same UTC-calendar-day (Sep 14).
      expect(result[0]!.date.toISOString()).toBe("2026-09-14T04:00:00.000Z");
    });
  });
});
