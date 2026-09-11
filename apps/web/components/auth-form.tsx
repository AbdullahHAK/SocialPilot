"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form action={formAction} className="flex flex-col gap-5">
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
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {mode === "signup" ? "Create account" : "Log in"}
      </Button>
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
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        minLength={minLength}
      />
    </div>
  );
}
