import { getBrandProfile } from "@socialpilot/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GenerateLogoForm } from "@/components/generate-logo-form";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { generateLogoConceptsAction } from "./actions";

export default async function LogoPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const brand = await getBrandProfile(session.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Generate a logo
        </h1>
        <p className="mt-1 text-muted-foreground">
          Describe the logo you want and SocialPilot&apos;s AI will generate
          three concepts to choose from.
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
              You already have an approved logo. Generating new concepts
              below will replace it once you approve one.{" "}
              <Link href="/dashboard/brand" className="font-medium text-primary underline-offset-4 hover:underline">
                Manage in Brand Settings
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <GenerateLogoForm action={generateLogoConceptsAction} />
    </div>
  );
}
