import { getBrandProfile } from "@socialpilot/db";
import { ImagePlus } from "lucide-react";
import { redirect } from "next/navigation";
import { CreateContentForm } from "@/components/create-content-form";
import { GenerateLogoForm } from "@/components/generate-logo-form";
import { generateLogoConceptsAction } from "@/app/dashboard/logo/actions";
import { getSession } from "@/lib/session";
import { generateConceptsAction } from "./actions";

export default async function CreateContentPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const brand = await getBrandProfile(session.organizationId);

  // A logo is required before any content generation - there's no
  // consistent brand identity to keep every image on without one, so this
  // gate is enforced here (not just suggested), right in the same window
  // rather than as a separate settings step to go find.
  if (!brand?.logoUrl) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImagePlus className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              First, let&apos;s set up your logo
            </h1>
            <p className="mt-1 text-muted-foreground">
              SocialPilot needs your logo to keep every image on-brand.
              Describe the logo you want below.
            </p>
          </div>
        </div>
        <GenerateLogoForm
          action={generateLogoConceptsAction}
          returnTo="/dashboard/create"
        />
      </div>
    );
  }

  return <CreateContentForm action={generateConceptsAction} />;
}
