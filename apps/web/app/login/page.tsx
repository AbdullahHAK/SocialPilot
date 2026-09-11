import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { loginAction } from "./actions";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm mode="login" action={loginAction} />
      <p className="text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
