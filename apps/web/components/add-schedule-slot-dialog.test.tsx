import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddScheduleSlotDialog } from "./add-schedule-slot-dialog";

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /add posting time/i }));
}

describe("AddScheduleSlotDialog", () => {
  it("requires at least one day before submitting", () => {
    render(<AddScheduleSlotDialog action={vi.fn()} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByText(/pick at least one day/i)).toBeVisible();
  });

  it("submits the chosen day, default time (6:00 PM -> 18:00), and platform", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<AddScheduleSlotDialog action={action} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "W" }));
    fireEvent.click(screen.getByRole("button", { name: /facebook/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.getAll("dayOfWeek")).toEqual(["WEDNESDAY"]);
    expect(formData.get("time")).toBe("18:00");
    expect(formData.get("platform")).toBe("FACEBOOK");
  });

  it("switches AM/PM correctly", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<AddScheduleSlotDialog action={action} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: "AM" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.get("time")).toBe("06:00");
  });

  it("allows selecting multiple days for one time", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<AddScheduleSlotDialog action={action} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: "W" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.getAll("dayOfWeek").sort()).toEqual(["MONDAY", "WEDNESDAY"]);
  });
});
