import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getPendingSignup } from "@/lib/pending-signup";
import { getSession } from "@/lib/session";
import { createAccountAction } from "./actions";

export default async function CreateAccountPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const pending = await getPendingSignup();
  if (!pending) {
    redirect("/pricing");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Last step — set up your login and we'll take you to onboarding."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <AuthForm mode="signup" action={createAccountAction} />
    </AuthShell>
  );
}
