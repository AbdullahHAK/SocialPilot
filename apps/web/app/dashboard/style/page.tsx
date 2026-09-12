import { getBrandCreativeProfile, getPublishingSchedule } from "@socialpilot/db";
import { AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
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
import { getSession } from "@/lib/session";
import { generateMonthlyContentAction } from "./actions";

export default async function StylePage({
  searchParams,
}: PageProps<"/dashboard/style">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { error, generated } = await searchParams;
  const [creativeProfile, schedule] = await Promise.all([
    getBrandCreativeProfile(session.organizationId),
    getPublishingSchedule(session.organizationId),
  ]);

  if (!creativeProfile) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your Brand Style
          </h1>
          <p className="mt-1 text-muted-foreground">
            Approve a creative concept to set the visual style SocialPilot
            uses for your content.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Sparkles className="size-6" />
            </span>
            <p className="font-medium">No approved style yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create some content and approve a concept to set your visual
              style.
            </p>
            <Button asChild>
              <Link href="/dashboard/create">Create content</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enabledSlots = schedule.slots.filter((slot) => slot.enabled);
  const referenceImage = creativeProfile.referenceImageUrls[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Your Brand Style
        </h1>
        <p className="mt-1 text-muted-foreground">
          The approved visual direction SocialPilot uses to generate your
          content.
        </p>
      </div>

      {referenceImage && (
        <Card className="w-full max-w-xs overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={referenceImage}
            alt="Approved brand style"
            className="aspect-square w-full object-cover"
          />
        </Card>
      )}

      {error === "no_slots" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Add at least one publishing schedule slot first.
        </div>
      )}
      {typeof generated === "string" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          Generated {generated} post{generated === "1" ? "" : "s"} — check
          your Content Calendar.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Generate this month&apos;s content</CardTitle>
          <CardDescription>
            {enabledSlots.length === 0
              ? "You haven't set up a publishing schedule yet."
              : `Based on your ${enabledSlots.length} weekly slot${enabledSlots.length === 1 ? "" : "s"}, SocialPilot will generate on-brand images and captions for the upcoming weeks.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {enabledSlots.length === 0 ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/schedule">Set up your schedule</Link>
            </Button>
          ) : (
            <form action={generateMonthlyContentAction}>
              <Button type="submit" size="lg">
                Generate this month&apos;s content
              </Button>
            </form>
          )}
          <Button asChild variant="ghost">
            <Link href="/dashboard/create">Create a different concept</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
