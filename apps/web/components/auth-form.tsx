"use client";

import { useActionState } from "react";

export interface AuthFormState {
  error?: string;
}

export type AuthFormAction = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

interface AuthFormProps {
  mode: "signup" | "login";
  action: AuthFormAction;
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, isPending] = useActionState<
    AuthFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "signup" && (
        <>
          <Field label="Business name" name="organizationName" required />
          <Field label="Your name" name="name" />
        </>
      )}
      <Field label="Email" name="email" type="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        minLength={mode === "signup" ? 8 : undefined}
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}
