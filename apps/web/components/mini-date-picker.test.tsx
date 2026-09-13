import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dateKey, MONTH_LABELS } from "@/lib/calendar";
import { MiniDatePicker } from "./mini-date-picker";

// "Today" inside the component is always the real wall-clock date, so
// these tests pin it with fake timers rather than relying on whatever
// day the test suite happens to run on.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MiniDatePicker", () => {
  const today = new Date(Date.UTC(2026, 5, 15));

  it("disables days before today", () => {
    render(<MiniDatePicker selected={today} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "14" })).toBeDisabled();
  });

  it("calls onSelect with the clicked date", () => {
    const onSelect = vi.fn();
    render(<MiniDatePicker selected={today} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "20" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(dateKey(onSelect.mock.calls[0][0] as Date)).toBe("2026-06-20");
  });

  it("navigates to the next and previous month", () => {
    render(<MiniDatePicker selected={today} onSelect={vi.fn()} />);

    expect(screen.getByText(`${MONTH_LABELS[5]} 2026`)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    expect(screen.getByText(`${MONTH_LABELS[6]} 2026`)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    expect(screen.getByText(`${MONTH_LABELS[4]} 2026`)).toBeVisible();
  });
});
