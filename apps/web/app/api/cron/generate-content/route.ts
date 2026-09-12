import { prisma } from "@socialpilot/db";
import { NextResponse, type NextRequest } from "next/server";
import { generateAndScheduleContent } from "@/lib/generate-content";
import { computeUpcomingSlotOccurrences } from "@/lib/schedule-dates";

// Keeps only the next couple of days topped up with content, generated
// just ahead of when it's needed - not a whole month upfront. If a
// customer cancels, at most this much gets wasted, never sixty images'
// worth. Vercel Cron calls this once a day (see vercel.json - Hobby plan
// caps cron frequency at once/day; the 48h lookahead comfortably covers
// the gap between runs). Raise MAX_GENERATED_PER_ORG_PER_RUN or the cron
// frequency together if this project moves to a Pro plan.
const LOOKAHEAD_HOURS = 48;
const MAX_GENERATED_PER_ORG_PER_RUN = 6;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const lookaheadEnd = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  const organizations = await prisma.organization.findMany({
    where: {
      brandCreativeProfile: { isNot: null },
      brandProfile: { logoUrl: { not: null } },
      publishingSchedule: { slots: { some: { enabled: true } } },
    },
    include: {
      publishingSchedule: { include: { slots: { where: { enabled: true } } } },
    },
  });

  let totalGenerated = 0;
  const perOrgResults: Array<{ organizationId: string; generated: number }> = [];

  for (const org of organizations) {
    const slots = org.publishingSchedule?.slots ?? [];
    if (slots.length === 0) continue;

    const occurrences = computeUpcomingSlotOccurrences(slots, {
      from: now,
      days: Math.ceil(LOOKAHEAD_HOURS / 24) + 1,
    }).filter((occurrence) => occurrence.date <= lookaheadEnd);

    let generatedForOrg = 0;
    for (const [index, occurrence] of occurrences.entries()) {
      if (generatedForOrg >= MAX_GENERATED_PER_ORG_PER_RUN) break;

      const existing = await prisma.contentPost.findFirst({
        where: {
          organizationId: org.id,
          platform: occurrence.platform,
          scheduledFor: occurrence.date,
        },
      });
      if (existing) continue;

      const result = await generateAndScheduleContent({
        organizationId: org.id,
        platform: occurrence.platform,
        scheduledFor: occurrence.date,
        themeIndex: index,
      });
      if (result.success) {
        generatedForOrg++;
        totalGenerated++;
      }
    }

    if (generatedForOrg > 0) {
      perOrgResults.push({ organizationId: org.id, generated: generatedForOrg });
    }
  }

  return NextResponse.json({
    ok: true,
    organizationsChecked: organizations.length,
    totalGenerated,
    perOrgResults,
  });
}
