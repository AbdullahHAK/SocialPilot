import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const now = new Date("2026-09-13T12:00:00Z");

function fmt(date: Date) {
  return formatRelativeTime(date, "en", "just now", "in a moment", now);
}

describe("formatRelativeTime", () => {
  it("formats the recent past", () => {
    expect(fmt(new Date("2026-09-13T10:00:00Z"))).toBe("2 hours ago");
    expect(fmt(new Date("2026-09-13T11:59:00Z"))).toBe("1 minute ago");
  });

  it("formats the near future", () => {
    expect(fmt(new Date("2026-09-13T15:00:00Z"))).toBe("in 3 hours");
    expect(fmt(new Date("2026-09-14T12:00:00Z"))).toBe("in 1 day");
  });

  it("falls back to just now / in a moment under a minute", () => {
    expect(fmt(new Date("2026-09-13T11:59:45Z"))).toBe("just now");
    expect(fmt(new Date("2026-09-13T12:00:30Z"))).toBe("in a moment");
  });

  it("formats longer spans", () => {
    expect(fmt(new Date("2026-08-13T12:00:00Z"))).toBe("1 month ago");
    expect(fmt(new Date("2026-09-20T12:00:00Z"))).toBe("in 1 week");
  });

  it("formats in another locale via Intl.RelativeTimeFormat", () => {
    expect(
      formatRelativeTime(
        new Date("2026-09-13T10:00:00Z"),
        "fr",
        "à l'instant",
        "dans un instant",
        now,
      ),
    ).toBe("il y a 2 heures");
  });
});
