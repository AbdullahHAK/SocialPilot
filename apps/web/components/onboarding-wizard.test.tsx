import { fireEvent, render, screen } from "@/test-utils";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "./onboarding-wizard";

describe("OnboardingWizard", () => {
  it("starts on the business basics step", () => {
    render(<OnboardingWizard action={vi.fn()} />);

    expect(screen.getByLabelText(/business name/i)).toBeVisible();
    expect(screen.queryByLabelText(/logo/i)).not.toBeVisible();
  });

  it("moves to the next step and back without losing entered data", () => {
    render(<OnboardingWizard action={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Acme Coffee Co" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByLabelText(/logo/i)).toBeVisible();
    expect(screen.getByLabelText(/business name/i)).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByLabelText(/business name/i)).toHaveValue(
      "Acme Coffee Co",
    );
  });

  it("only shows the Finish button on the last step", () => {
    render(<OnboardingWizard action={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /finish/i }),
    ).not.toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }

    expect(screen.getByRole("button", { name: /finish/i })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^next$/i }),
    ).not.toBeInTheDocument();
  });

  it("does not submit when the last Next click turns the button into Finish", () => {
    // Regression test: Next and Finish previously shared one DOM node (same
    // position, no `key`), so React mutated its `type` from "button" to
    // "submit" in place as part of the very click that reveals the review
    // step. A real browser can treat that click as activating the
    // now-submit button, silently skipping the review step. Distinct
    // `key`s force a fresh element instead. jsdom's synthetic events don't
    // reproduce that native timing quirk, so this only guards the visible
    // side effect (no premature action call); the real browser-level
    // regression check is the Playwright E2E onboarding flow.
    const action = vi.fn();
    render(<OnboardingWizard action={action} />);

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }

    expect(screen.getByRole("button", { name: /finish/i })).toBeVisible();
    expect(action).not.toHaveBeenCalled();
  });
});
