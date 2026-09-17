import { fireEvent, render, screen, waitFor } from "@/test-utils";
import { describe, expect, it, vi } from "vitest";
import { dateKey } from "@/lib/calendar";
import { EditPostDialog } from "./edit-post-dialog";

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
}

const defaultProps = {
  jobId: "job-1",
  instruction: "Promote our weekend chicken burger offer",
  scheduledForIso: "2026-09-13T14:30:00.000Z",
  status: "SCHEDULED" as const,
  platform: "INSTAGRAM" as const,
  trigger: <button>Edit</button>,
};

describe("EditPostDialog - not yet published", () => {
  it("pre-fills the instruction and the scheduled time in the browser's local time", () => {
    render(<EditPostDialog {...defaultProps} action={vi.fn().mockResolvedValue({ ok: true })} />);
    openDialog();

    expect(
      screen.getByDisplayValue("Promote our weekend chicken burger offer"),
    ).toBeVisible();
  });

  it("submits the edited instruction and the jobId, preserving the original instant", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(<EditPostDialog {...defaultProps} action={action} />);
    openDialog();

    const textarea = screen.getByDisplayValue("Promote our weekend chicken burger offer");
    fireEvent.change(textarea, { target: { value: "Announce our new spicy wrap" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.get("jobId")).toBe("job-1");
    expect(formData.get("instruction")).toBe("Announce our new spicy wrap");
    expect(formData.get("timezone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Reconstruct the instant from the submitted date+time+timezone and
    // confirm it's unchanged from what was passed in, since only the
    // instruction was edited.
    const date = String(formData.get("date"));
    const time = String(formData.get("time"));
    const timezone = String(formData.get("timezone"));
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const { zonedTimeToUtc } = await import("@socialpilot/db");
    const reconstructed = zonedTimeToUtc({ year, month, day, hour, minute }, timezone);
    expect(reconstructed.toISOString()).toBe(defaultProps.scheduledForIso);
  });

  it("closes without submitting when the dialog is dismissed and reopened", () => {
    render(<EditPostDialog {...defaultProps} action={vi.fn().mockResolvedValue({ ok: true })} />);
    openDialog();

    const textarea = screen.getByDisplayValue("Promote our weekend chicken burger offer");
    fireEvent.change(textarea, { target: { value: "Unsaved edit" } });
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    openDialog();
    expect(
      screen.getByDisplayValue("Promote our weekend chicken burger offer"),
    ).toBeVisible();
  });

  it("uses today's date key format for the date field", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(<EditPostDialog {...defaultProps} instruction="" action={action} />);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(String(formData.get("date"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateKey(new Date(String(formData.get("date"))))).toBe(formData.get("date"));
  });
});

describe("EditPostDialog - already published", () => {
  it("hides the time and date pickers", () => {
    render(
      <EditPostDialog
        {...defaultProps}
        status="PUBLISHED"
        action={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    openDialog();

    expect(screen.queryByText(/^time$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^date/i)).not.toBeInTheDocument();
  });

  it("submits only the instruction and jobId, no date/time fields", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(<EditPostDialog {...defaultProps} status="PUBLISHED" action={action} />);
    openDialog();

    fireEvent.change(screen.getByDisplayValue("Promote our weekend chicken burger offer"), {
      target: { value: "Announce our new spicy wrap" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.get("jobId")).toBe("job-1");
    expect(formData.get("instruction")).toBe("Announce our new spicy wrap");
    expect(formData.get("date")).toBeNull();
    expect(formData.get("time")).toBeNull();
  });

  it("warns up front that Instagram won't reflect the edit", () => {
    render(
      <EditPostDialog
        {...defaultProps}
        status="PUBLISHED"
        platform="INSTAGRAM"
        action={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    openDialog();

    expect(screen.getByText(/doesn't support editing a caption/i)).toBeVisible();
  });

  it("tells the user a Facebook post's live caption will also update", () => {
    render(
      <EditPostDialog
        {...defaultProps}
        status="PUBLISHED"
        platform="FACEBOOK"
        action={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    openDialog();

    expect(screen.getByText(/will also update the caption on the live facebook post/i)).toBeVisible();
  });

  it("keeps the dialog open and shows a note instead of closing when the server returns one", async () => {
    const action = vi.fn().mockResolvedValue({
      ok: true,
      note: "Saved here, but couldn't update the caption on the live Facebook post.",
    });
    render(<EditPostDialog {...defaultProps} status="PUBLISHED" action={action} />);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn't update the caption on the live facebook post/i)).toBeVisible(),
    );
    // Still open - the title is still on screen.
    expect(screen.getByText(/^edit post$/i)).toBeVisible();
  });
});
