import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { Logo } from "@/components/logo";
import { getPendingSignup } from "@/lib/pending-signup";

export default async function ConnectPage({
  searchParams,
}: PageProps<"/connect">) {
  const pending = await getPendingSignup();
  if (!pending) {
    redirect("/pricing");
  }

  const { error } = await searchParams;
  const connectedCount = pending.metaPages?.length ?? 0;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
      >
        <div className="aspect-1155/678 w-[60rem] bg-gradient-to-tr from-primary/25 via-primary/10 to-transparent opacity-40" />
      </div>

      <Link href="/" className="mb-8">
        <Logo />
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Connect your accounts</CardTitle>
          <CardDescription>
            Link your Facebook Page and its Instagram Business account
            through Meta&apos;s official login. We never see or ask for your
            password.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-center gap-4 rounded-lg border border-dashed border-border py-6 text-muted-foreground">
            <FacebookIcon className="size-7" />
            <InstagramIcon className="size-7" />
          </div>

          {typeof error === "string" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          {connectedCount > 0 ? (
            <>
              <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                Connected {connectedCount} account
                {connectedCount === 1 ? "" : "s"}.
              </div>
              <Button asChild size="lg">
                <Link href="/create-account">Continue</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="lg">
              <a href="/api/meta/connect">Connect Instagram / Facebook</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
