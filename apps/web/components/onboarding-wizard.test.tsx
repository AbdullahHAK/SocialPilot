import { fireEvent, render, screen } from "@testing-library/react";
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
});
