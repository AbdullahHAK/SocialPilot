import { getBrandProfile, getMonthlyImageUsage, MONTHLY_LOGO_CAP } from "@socialpilot/db";
import { asStringArray } from "@socialpilot/content-engine";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { GenerateLogoForm } from "@/components/generate-logo-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { generateLogoConceptsAction, saveBrandColorsAction, uploadLogoAction } from "./actions";

export const maxDuration = 120;

export default async function LogoPage({
  searchParams,
}: PageProps<"/dashboard/logo">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { returnTo } = await searchParams;
  const [brand, usage, t] = await Promise.all([
    getBrandProfile(session.organizationId),
    getMonthlyImageUsage(session.organizationId),
    getTranslations("dashboard.logo"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {brand?.logoUrl ? t("yourLogo") : t("generateLogo")}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {brand?.logoUrl ? t("consistentUse") : t("describeAndGenerate")}
        </p>
      </div>

      {brand?.logoUrl && (
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brand.logoUrl}
              alt={t("currentLogoAlt")}
              className="size-14 shrink-0 rounded-lg border border-border object-contain p-1"
            />
            <p className="text-sm text-muted-foreground">{t("haveDifferentLogo")}</p>
          </CardContent>
        </Card>
      )}

      <GenerateLogoForm
        action={generateLogoConceptsAction}
        uploadAction={uploadLogoAction}
        colorsAction={saveBrandColorsAction}
        returnTo={typeof returnTo === "string" ? returnTo : undefined}
        remainingLogoRevisions={Math.max(0, MONTHLY_LOGO_CAP - usage.logo)}
        logoCap={MONTHLY_LOGO_CAP}
        initialColors={asStringArray(brand?.colors) ?? []}
      />
    </div>
  );
}
