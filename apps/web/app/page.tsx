import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">SocialPilot</h1>
      <p className="max-w-md text-lg text-gray-600">
        Your AI social media manager for Instagram and Facebook. Connect your
        accounts, approve your brand style, and let SocialPilot generate and
        publish content on your schedule.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-md bg-black px-5 py-3 text-sm font-medium text-white"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-gray-300 px-5 py-3 text-sm font-medium"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
