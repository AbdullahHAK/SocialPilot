import { fireEvent, render, screen } from "@/test-utils";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "./onboarding-wizard";

describe("OnboardingWizard", () => {
  it("shows every section's fields at once, with no step navigation", () => {
    render(<OnboardingWizard action={vi.fn()} />);

    expect(screen.getByLabelText(/business name/i)).toBeVisible();
    expect(screen.getByLabelText(/^logo$/i)).toBeVisible();
    expect(screen.getByLabelText(/preferred language/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^next$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^back$/i }),
    ).not.toBeInTheDocument();
  });

  it("submits every field's data in one go via a single Save & Continue button", () => {
    const action = vi.fn().mockResolvedValue({});
    render(<OnboardingWizard action={action} />);

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Acme Coffee Co" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save & continue/i }));

    expect(screen.getByLabelText(/business name/i)).toHaveValue(
      "Acme Coffee Co",
    );
  });

  it("still allows adding another product/service field", () => {
    render(<OnboardingWizard action={vi.fn()} />);

    const initialInputs = screen.getAllByPlaceholderText(/espresso/i);
    fireEvent.click(screen.getByRole("button", { name: /add another/i }));

    expect(screen.getAllByPlaceholderText(/espresso/i)).toHaveLength(
      initialInputs.length + 1,
    );
  });
});
