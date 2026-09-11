import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { signupAction } from "./actions";

export default async function SignupPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-gray-600">
          Set up your business and start automating your social content.
        </p>
      </div>
      <AuthForm mode="signup" action={signupAction} />
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
