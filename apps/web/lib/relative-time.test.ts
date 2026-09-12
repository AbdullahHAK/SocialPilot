import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const now = new Date("2026-09-13T12:00:00Z");

describe("formatRelativeTime", () => {
  it("formats the recent past", () => {
    expect(formatRelativeTime(new Date("2026-09-13T10:00:00Z"), now)).toBe(
      "2 hours ago",
    );
    expect(formatRelativeTime(new Date("2026-09-13T11:59:00Z"), now)).toBe(
      "1 minute ago",
    );
  });

  it("formats the near future", () => {
    expect(formatRelativeTime(new Date("2026-09-13T15:00:00Z"), now)).toBe(
      "in 3 hours",
    );
    expect(formatRelativeTime(new Date("2026-09-14T12:00:00Z"), now)).toBe(
      "in 1 day",
    );
  });

  it("falls back to just now / in a moment under a minute", () => {
    expect(formatRelativeTime(new Date("2026-09-13T11:59:45Z"), now)).toBe(
      "just now",
    );
    expect(formatRelativeTime(new Date("2026-09-13T12:00:30Z"), now)).toBe(
      "in a moment",
    );
  });

  it("formats longer spans", () => {
    expect(formatRelativeTime(new Date("2026-08-13T12:00:00Z"), now)).toBe(
      "1 month ago",
    );
    expect(formatRelativeTime(new Date("2026-09-20T12:00:00Z"), now)).toBe(
      "in 1 week",
    );
  });
});
