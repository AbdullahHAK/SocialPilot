import { getBrandProfile } from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { saveBrandProfileAction } from "./actions";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const existingProfile = await getBrandProfile(session.organizationId);
  if (existingProfile) {
    redirect("/dashboard");
  }
  const t = await getTranslations("onboarding");

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
      >
        <div className="aspect-1155/678 w-[60rem] bg-gradient-to-tr from-primary/25 via-primary/10 to-transparent opacity-40" />
      </div>

      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="mb-8">
        <Logo />
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader className="gap-1.5">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </CardHeader>
        <CardContent>
          <OnboardingWizard action={saveBrandProfileAction} />
        </CardContent>
      </Card>
    </main>
  );
}
