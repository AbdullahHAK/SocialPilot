import {
  getBrandProfile,
  getMonthlyImageUsage,
  MONTHLY_BRAND_STYLE_CAP,
  MONTHLY_LOGO_CAP,
} from "@socialpilot/db";
import { asStringArray } from "@socialpilot/content-engine";
import { ImagePlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CreateContentForm } from "@/components/create-content-form";
import { GenerateLogoForm } from "@/components/generate-logo-form";
import {
  generateLogoConceptsAction,
  saveBrandColorsAction,
  uploadLogoAction,
} from "@/app/dashboard/logo/actions";
import { safeReturnTo } from "@/lib/safe-return-to";
import { getSession } from "@/lib/session";
import { generateConceptsAction } from "./actions";

export default async function CreateContentPage({
  searchParams,
}: PageProps<"/dashboard/create">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { returnTo: returnToParam } = await searchParams;
  const returnTo =
    typeof returnToParam === "string"
      ? safeReturnTo(returnToParam, "/dashboard/schedule")
      : undefined;

  const [brand, usage, t] = await Promise.all([
    getBrandProfile(session.organizationId),
    getMonthlyImageUsage(session.organizationId),
    getTranslations("dashboard.create"),
  ]);

  // A logo is required before any content generation - there's no
  // consistent brand identity to keep every image on without one, so this
  // gate is enforced here (not just suggested), right in the same window
  // rather than as a separate settings step to go find. Preserves an
  // incoming returnTo (e.g. from Brand Settings) through the round trip
  // to the logo flow and back here.
  if (!brand?.logoUrl) {
    const logoReturnTo = returnTo
      ? `/dashboard/create?returnTo=${encodeURIComponent(returnTo)}`
      : "/dashboard/create";

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImagePlus className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <GenerateLogoForm
          action={generateLogoConceptsAction}
          uploadAction={uploadLogoAction}
          colorsAction={saveBrandColorsAction}
          returnTo={logoReturnTo}
          remainingLogoRevisions={Math.max(0, MONTHLY_LOGO_CAP - usage.logo)}
          logoCap={MONTHLY_LOGO_CAP}
          initialColors={asStringArray(brand?.colors) ?? []}
        />
      </div>
    );
  }

  return (
    <CreateContentForm
      action={generateConceptsAction}
      returnTo={returnTo}
      remainingBrandStyleRevisions={Math.max(0, MONTHLY_BRAND_STYLE_CAP - usage.brandStyle)}
    />
  );
}
