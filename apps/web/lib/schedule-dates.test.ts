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
});
