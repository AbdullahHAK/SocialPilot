import { fireEvent, render, screen } from "@/test-utils";
import { describe, expect, it, vi } from "vitest";
import { GenerateLogoForm } from "./generate-logo-form";

function renderForm(overrides: Partial<Parameters<typeof GenerateLogoForm>[0]> = {}) {
  const action = vi.fn().mockResolvedValue({});
  const uploadAction = vi.fn().mockResolvedValue({});
  const colorsAction = vi.fn().mockResolvedValue({ success: true });
  render(
    <GenerateLogoForm
      action={action}
      uploadAction={uploadAction}
      colorsAction={colorsAction}
      remainingLogoRevisions={3}
      logoCap={3}
      {...overrides}
    />,
  );
  return { action, uploadAction, colorsAction };
}

describe("GenerateLogoForm", () => {
  it("shows the AI prompt by default, with no upload field visible", () => {
    renderForm();

    expect(screen.getByPlaceholderText(/create a modern logo/i)).toBeVisible();
    expect(screen.queryByLabelText(/logo file/i)).not.toBeInTheDocument();
  });

  it("switches to the upload field when 'Upload your own' is selected", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /upload your own/i }));

    expect(screen.getByLabelText(/logo file/i)).toBeVisible();
    expect(screen.queryByPlaceholderText(/create a modern logo/i)).not.toBeInTheDocument();
  });

  it("disables the generate button until a prompt is typed", () => {
    renderForm();

    const generateButton = screen.getByRole("button", { name: /^generate logo concept$/i });
    expect(generateButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/create a modern logo/i), {
      target: { value: "A bold logo for a chicken restaurant" },
    });

    expect(generateButton).toBeEnabled();
  });

  it("disables generation once the monthly revision cap is used up", () => {
    renderForm({ remainingLogoRevisions: 0 });

    fireEvent.change(screen.getByPlaceholderText(/create a modern logo/i), {
      target: { value: "A bold logo for a chicken restaurant" },
    });

    expect(screen.getByRole("button", { name: /^generate logo concept$/i })).toBeDisabled();
  });

  it("shows the cap in the revisions warning", () => {
    renderForm({ remainingLogoRevisions: 2, logoCap: 3 });

    expect(screen.getByText(/2 of 3 logo revisions left/i)).toBeVisible();
  });

  it("disables the upload save button until a file is chosen", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /upload your own/i }));

    const saveButton = screen.getByRole("button", { name: /^save logo$/i });
    expect(saveButton).toBeDisabled();

    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const input = screen.getByLabelText(/logo file/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(saveButton).toBeEnabled();
    expect(screen.getByText("logo.png")).toBeVisible();
  });

  it("shows two color swatches by default and lets you add up to six", () => {
    renderForm();

    const colorInputs = document.querySelectorAll('input[type="color"]');
    expect(colorInputs).toHaveLength(2);

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /add color/i }));
    }
    expect(document.querySelectorAll('input[type="color"]')).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /add color/i })).not.toBeInTheDocument();
  });

  it("saves colors independently of the logo, via its own button", () => {
    const { colorsAction } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: /^save colors$/i }));

    expect(colorsAction).toHaveBeenCalledTimes(1);
    const submitted = colorsAction.mock.calls[0]![1] as FormData;
    expect(submitted.getAll("colors")).toEqual(["#111111", "#ffffff"]);
  });
});
