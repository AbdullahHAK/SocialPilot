import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("auth.createAccount");

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      footer={
        <div className="flex flex-col items-center gap-2">
          <p>
            {t("haveAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("logIn")}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            {t("agreePrefix")}{" "}
            <Link href="/terms" className="underline-offset-4 hover:underline">
              {t("termsOfService")}
            </Link>{" "}
            {t("and")}{" "}
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              {t("privacyPolicy")}
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
