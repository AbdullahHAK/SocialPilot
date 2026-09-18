import { fireEvent, render, screen, waitFor } from "@/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateKey, formatMonthParam, getMonthLabels } from "@/lib/calendar";
import { AddScheduleSlotDialog } from "./add-schedule-slot-dialog";

const MONTH_LABELS = getMonthLabels("en");

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /add posting time/i }));
}

function noopOnce() {
  return vi.fn().mockResolvedValue({ ok: true });
}

const BOTH_CONNECTED = ["INSTAGRAM", "FACEBOOK"] as const;

describe("AddScheduleSlotDialog - weekly mode", () => {
  it("requires at least one day before submitting", () => {
    render(
      <AddScheduleSlotDialog action={vi.fn()} onceAction={noopOnce()} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByText(/pick at least one day/i)).toBeVisible();
  });

  it("submits the chosen day, default time (6:00 PM -> 18:00), and platform", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(
      <AddScheduleSlotDialog action={action} onceAction={noopOnce()} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "W" }));
    // Instagram is selected by default - switch to Facebook only.
    fireEvent.click(screen.getByRole("button", { name: /instagram/i }));
    fireEvent.click(screen.getByRole("button", { name: /facebook/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.getAll("dayOfWeek")).toEqual(["WEDNESDAY"]);
    expect(formData.get("time")).toBe("18:00");
    expect(formData.getAll("platform")).toEqual(["FACEBOOK"]);
  });

  it("allows selecting both platforms at once", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(
      <AddScheduleSlotDialog action={action} onceAction={noopOnce()} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "W" }));
    // Instagram is already selected by default - also add Facebook.
    fireEvent.click(screen.getByRole("button", { name: /facebook/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.getAll("platform").sort()).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });

  it("requires at least one platform", async () => {
    render(
      <AddScheduleSlotDialog action={vi.fn()} onceAction={noopOnce()} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "W" }));
    fireEvent.click(screen.getByRole("button", { name: /instagram/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByText(/pick at least one platform/i)).toBeVisible();
  });

  it("includes the browser's own timezone so the time isn't misread as UTC", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(
      <AddScheduleSlotDialog action={action} onceAction={noopOnce()} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.get("timezone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("allows selecting multiple days for one time", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(
      <AddScheduleSlotDialog action={action} onceAction={noopOnce()} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: "W" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.getAll("dayOfWeek").sort()).toEqual(["MONDAY", "WEDNESDAY"]);
  });

  it("disables a platform that has no connected account", () => {
    render(
      <AddScheduleSlotDialog action={vi.fn()} onceAction={noopOnce()} connectedPlatforms={["FACEBOOK"]} />,
    );
    openDialog();

    expect(screen.getByRole("button", { name: /instagram/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /facebook/i })).toBeEnabled();
  });

  it("disables Save and shows a warning when no account is connected at all", () => {
    render(<AddScheduleSlotDialog action={vi.fn()} onceAction={noopOnce()} connectedPlatforms={[]} />);
    openDialog();

    expect(screen.getByRole("button", { name: /instagram/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /facebook/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
    expect(screen.getByText(/connect an instagram or facebook account first/i)).toBeVisible();
  });
});

describe("AddScheduleSlotDialog - one-time mode", () => {
  it("submits today's date by default and redirects to the calendar", async () => {
    const onceAction = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AddScheduleSlotDialog action={vi.fn()} onceAction={onceAction} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /one-time date/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onceAction).toHaveBeenCalledTimes(1));
    const formData = onceAction.mock.calls[0][0] as FormData;
    const today = new Date();
    const expectedKey = dateKey(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
    );
    expect(formData.get("date")).toBe(expectedKey);
    expect(formData.get("time")).toBe("18:00");
    expect(formData.getAll("platform")).toEqual(["INSTAGRAM"]);

    expect(push).toHaveBeenCalledWith(
      `/dashboard/calendar?month=${formatMonthParam(today.getUTCFullYear(), today.getUTCMonth())}`,
    );
  });

  it("lets you pick a date from next month via the mini calendar", async () => {
    const onceAction = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AddScheduleSlotDialog action={vi.fn()} onceAction={onceAction} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /one-time date/i }));
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    const today = new Date();
    const nextMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 10));
    const nextMonthLabel = `${MONTH_LABELS[nextMonthDate.getUTCMonth()]} ${nextMonthDate.getUTCFullYear()}`;
    expect(screen.getByText(nextMonthLabel)).toBeVisible();

    // Every day in the fully-displayed next month is guaranteed to be in
    // the future, so the 10th is always clickable regardless of today's date.
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onceAction).toHaveBeenCalledTimes(1));
    const formData = onceAction.mock.calls[0][0] as FormData;
    expect(formData.get("date")).toBe(dateKey(nextMonthDate));
  });

  it("shows a message and keeps the dialog open when the brand isn't ready", async () => {
    const onceAction = vi.fn().mockResolvedValue({ ok: false, reason: "not_ready" });
    render(
      <AddScheduleSlotDialog action={vi.fn()} onceAction={onceAction} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /one-time date/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onceAction).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/set up your brand style and logo first/i)).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    // Dialog should still be open - the title is still on screen.
    expect(screen.getByText(/add a posting time/i)).toBeVisible();
  });

  it("shows a message when the picked platform's account got disconnected", async () => {
    const onceAction = vi.fn().mockResolvedValue({ ok: false, reason: "not_connected" });
    render(
      <AddScheduleSlotDialog action={vi.fn()} onceAction={onceAction} connectedPlatforms={[...BOTH_CONNECTED]} />,
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /one-time date/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onceAction).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/that account got disconnected/i)).toBeVisible();
  });
});
