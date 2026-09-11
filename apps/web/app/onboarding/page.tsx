import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Welcome to SocialPilot</h1>
      <p className="text-gray-600">
        Brand onboarding (business info, logo, colors, and connecting your
        Instagram/Facebook accounts) is coming soon. For now, head to your{" "}
        <Link href="/dashboard" className="underline">
          dashboard
        </Link>
        .
      </p>
    </main>
  );
}
