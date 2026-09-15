import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { loginAction } from "./actions";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  const t = await getTranslations("auth.login");

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("signUp")}
          </Link>
        </>
      }
    >
      <AuthForm mode="login" action={loginAction} />
    </AuthShell>
  );
}
