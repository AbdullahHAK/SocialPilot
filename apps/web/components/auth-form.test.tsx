import { render, screen } from "@/test-utils";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
  it("renders business name and name fields in signup mode", () => {
    render(<AuthForm mode="signup" action={vi.fn()} />);

    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("omits business/name fields in login mode", () => {
    render(<AuthForm mode="login" action={vi.fn()} />);

    expect(screen.queryByLabelText(/business name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log in/i }),
    ).toBeInTheDocument();
  });
});
