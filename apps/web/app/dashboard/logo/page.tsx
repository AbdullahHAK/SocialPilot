import { getBrandProfile, getMonthlyImageUsage, MONTHLY_LOGO_CAP } from "@socialpilot/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GenerateLogoForm } from "@/components/generate-logo-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { generateLogoConceptsAction } from "./actions";

export default async function LogoPage({
  searchParams,
}: PageProps<"/dashboard/logo">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { returnTo } = await searchParams;
  const [brand, usage] = await Promise.all([
    getBrandProfile(session.organizationId),
    getMonthlyImageUsage(session.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {brand?.logoUrl ? "Your logo" : "Generate a logo"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {brand?.logoUrl
            ? "This is what YOPAPI uses consistently across your content."
            : "Describe the logo you want and YOPAPI's AI will generate one concept to review."}
        </p>
      </div>

      {brand?.logoUrl && (
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brand.logoUrl}
              alt="Current logo"
              className="size-14 shrink-0 rounded-lg border border-border object-contain p-1"
            />
            <p className="text-sm text-muted-foreground">
              Already have a different logo file?{" "}
              <Link
                href="/dashboard/brand"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Upload it in Brand Settings
              </Link>
              , or generate new concepts below to replace this one.
            </p>
          </CardContent>
        </Card>
      )}

      <GenerateLogoForm
        action={generateLogoConceptsAction}
        returnTo={typeof returnTo === "string" ? returnTo : undefined}
        remainingLogoRevisions={Math.max(0, MONTHLY_LOGO_CAP - usage.logo)}
      />
    </div>
  );
}
