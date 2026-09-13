import { getBrandCreativeProfile, getBrandProfile } from "@socialpilot/db";
import { CheckCircle2, Wand2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BrandSettingsForm,
  type BrandProfileDefaults,
} from "@/components/brand-settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { asStringArray } from "@/lib/brand-fields";
import { getSession } from "@/lib/session";
import { updateBrandProfileAction } from "./actions";

export default async function BrandSettingsPage({
  searchParams,
}: PageProps<"/dashboard/brand">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { logoApproved } = await searchParams;

  const [profile, creativeProfile] = await Promise.all([
    getBrandProfile(session.organizationId),
    getBrandCreativeProfile(session.organizationId),
  ]);

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
    colors: asStringArray(profile.colors) ?? [],
    language: profile.language,
    tone: profile.tone ?? "",
    productsServices: asStringArray(profile.productsServices) ?? [],
  };

  const referenceImage = creativeProfile?.referenceImageUrls[0];

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

      {logoApproved === "1" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Logo approved — it&apos;ll be used across future content.
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {defaults.logoUrl ? "Want a different logo?" : "Don't have a logo yet?"}{" "}
        <Link
          href={`/dashboard/logo?returnTo=${encodeURIComponent("/dashboard/brand")}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {defaults.logoUrl ? "Regenerate with AI" : "Generate one with AI"}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visual style</CardTitle>
          <CardDescription>
            The approved look SocialPilot uses to generate every image.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {referenceImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceImage}
                alt="Approved brand style"
                className="size-20 shrink-0 rounded-lg border border-border object-cover"
              />
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/dashboard/create?returnTo=${encodeURIComponent("/dashboard/brand")}`}>
                  <Wand2 className="size-4" />
                  Choose a different style
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No visual style set yet — SocialPilot needs one before it can
                generate content.
              </p>
              <Button asChild className="ml-auto shrink-0 gap-2">
                <Link href={`/dashboard/create?returnTo=${encodeURIComponent("/dashboard/brand")}`}>
                  <Wand2 className="size-4" />
                  Set up with AI
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <BrandSettingsForm action={updateBrandProfileAction} defaults={defaults} />
    </div>
  );
}
