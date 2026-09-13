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
        <div className="flex flex-col items-center gap-2">
          <p>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline-offset-4 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      }
    >
      <AuthForm mode="signup" action={createAccountAction} />
    </AuthShell>
  );
}
