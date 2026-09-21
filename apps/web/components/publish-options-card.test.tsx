import { fireEvent, render, screen, waitFor } from "@/test-utils";
import { describe, expect, it, vi } from "vitest";
import { PublishOptionsCard, type PublishMode } from "./publish-options-card";

function renderCard(mode: PublishMode = "POST_AND_STORY", includeCaption = true) {
  const action = vi.fn().mockResolvedValue({ saved: true });
  render(
    <PublishOptionsCard action={action} initialMode={mode} initialIncludeCaption={includeCaption} />,
  );
  return { action };
}

const option = (name: RegExp) => screen.getByRole("radio", { name });

describe("PublishOptionsCard", () => {
  it("starts on the saved mode and caption choice", () => {
    renderCard("POST_ONLY", false);

    expect(option(/^post only/i)).toHaveAttribute("aria-checked", "true");
    expect(option(/^post \+ story/i)).toHaveAttribute("aria-checked", "false");
    expect(option(/^no$/i)).toHaveAttribute("aria-checked", "true");
    expect(option(/^yes$/i)).toHaveAttribute("aria-checked", "false");
  });

  it("locks the caption choice for Story only, since Stories have no captions", () => {
    renderCard();

    fireEvent.click(option(/^story only/i));

    expect(option(/^yes$/i)).toBeDisabled();
    expect(option(/^no$/i)).toBeDisabled();
    expect(screen.getByText(/stories don't have captions/i)).toBeVisible();
  });

  it("re-enables the caption choice when switching back to a mode with a post", () => {
    renderCard();

    fireEvent.click(option(/^story only/i));
    fireEvent.click(option(/^post only/i));

    expect(option(/^yes$/i)).toBeEnabled();
  });

  it("submits the chosen mode and caption choice", async () => {
    const { action } = renderCard();

    fireEvent.click(option(/^story only/i));
    fireEvent.click(option(/^post only/i));
    fireEvent.click(option(/^no$/i));
    fireEvent.click(screen.getByRole("button", { name: /save options/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0]![1] as FormData;
    expect(formData.get("publishMode")).toBe("POST_ONLY");
    expect(formData.get("includeCaption")).toBe("false");
  });

  it("confirms once saved", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /save options/i }));

    expect(await screen.findByText(/^saved$/i)).toBeVisible();
  });
});
