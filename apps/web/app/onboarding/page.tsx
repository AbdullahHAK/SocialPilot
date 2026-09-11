import { getBrandProfile } from "@socialpilot/db";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";
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

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Tell us about your business</h1>
        <p className="mt-1 text-sm text-gray-600">
          This is what SocialPilot will use to keep your content on-brand.
        </p>
      </div>
      <OnboardingWizard action={saveBrandProfileAction} />
    </main>
  );
}
