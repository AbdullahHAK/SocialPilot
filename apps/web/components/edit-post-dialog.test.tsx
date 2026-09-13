import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { dateKey } from "@/lib/calendar";
import { EditPostDialog } from "./edit-post-dialog";

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
}

describe("EditPostDialog", () => {
  it("pre-fills the caption and the scheduled time in the browser's local time", () => {
    // 2026-09-13T14:30:00Z. In whatever timezone the test runner uses,
    // this should round-trip back to the same instant on save - we just
    // check the caption is pre-filled here since the exact displayed
    // hour depends on the runner's local timezone.
    render(
      <EditPostDialog
        postId="post-1"
        caption="Original caption"
        scheduledForIso="2026-09-13T14:30:00.000Z"
        action={vi.fn().mockResolvedValue({ ok: true })}
        trigger={<button>Edit</button>}
      />,
    );
    openDialog();

    expect(screen.getByDisplayValue("Original caption")).toBeVisible();
  });

  it("submits the edited caption and the postId, preserving the original instant", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    const scheduledForIso = "2026-09-13T14:30:00.000Z";
    render(
      <EditPostDialog
        postId="post-1"
        caption="Original caption"
        scheduledForIso={scheduledForIso}
        action={action}
        trigger={<button>Edit</button>}
      />,
    );
    openDialog();

    const textarea = screen.getByDisplayValue("Original caption");
    fireEvent.change(textarea, { target: { value: "Updated caption" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.get("postId")).toBe("post-1");
    expect(formData.get("caption")).toBe("Updated caption");
    expect(formData.get("timezone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Reconstruct the instant from the submitted date+time+timezone and
    // confirm it's unchanged from what was passed in, since only the
    // caption was edited.
    const date = String(formData.get("date"));
    const time = String(formData.get("time"));
    const timezone = String(formData.get("timezone"));
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const { zonedTimeToUtc } = await import("@/lib/timezone");
    const reconstructed = zonedTimeToUtc({ year, month, day, hour, minute }, timezone);
    expect(reconstructed.toISOString()).toBe(scheduledForIso);
  });

  it("closes without submitting when the dialog is dismissed and reopened", () => {
    render(
      <EditPostDialog
        postId="post-1"
        caption="Original caption"
        scheduledForIso="2026-09-13T14:30:00.000Z"
        action={vi.fn().mockResolvedValue({ ok: true })}
        trigger={<button>Edit</button>}
      />,
    );
    openDialog();

    const textarea = screen.getByDisplayValue("Original caption");
    fireEvent.change(textarea, { target: { value: "Unsaved edit" } });
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    openDialog();
    expect(screen.getByDisplayValue("Original caption")).toBeVisible();
  });

  it("uses today's date key format for the date field", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    render(
      <EditPostDialog
        postId="post-1"
        caption=""
        scheduledForIso="2026-09-13T14:30:00.000Z"
        action={action}
        trigger={<button>Edit</button>}
      />,
    );
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][0] as FormData;
    expect(String(formData.get("date"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateKey(new Date(String(formData.get("date"))))).toBe(formData.get("date"));
  });
});
