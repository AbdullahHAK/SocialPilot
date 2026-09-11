import { getBrandProfile } from "@socialpilot/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BrandSettingsForm,
  type BrandProfileDefaults,
} from "@/components/brand-settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { updateBrandProfileAction } from "./actions";

export default async function BrandSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const profile = await getBrandProfile(session.organizationId);

  if (!profile) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Brand Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            You haven&apos;t completed onboarding yet.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              Complete onboarding to set up your brand profile before editing
              it here.
            </p>
            <Button asChild>
              <Link href="/onboarding">Complete onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const defaults: BrandProfileDefaults = {
    businessName: profile.businessName,
    category: profile.category ?? "",
    description: profile.description ?? "",
    logoUrl: profile.logoUrl,
    colors: Array.isArray(profile.colors)
      ? profile.colors.filter((c): c is string => typeof c === "string")
      : [],
    language: profile.language,
    tone: profile.tone ?? "",
    productsServices: Array.isArray(profile.productsServices)
      ? profile.productsServices.filter(
          (p): p is string => typeof p === "string",
        )
      : [],
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Brand Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          This is what SocialPilot uses to keep your content on-brand.
        </p>
      </div>
      <BrandSettingsForm action={updateBrandProfileAction} defaults={defaults} />
    </div>
  );
}
