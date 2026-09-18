import { Prisma } from "@prisma/client";
import { prisma } from "./index";

// Per-organization monthly image budget - scheduled content generation,
// Brand Style revisions, and logo revisions all draw from the same pool.
// The client's explicit cost-control philosophy already established
// elsewhere in this product ("one AI image per org per day", "a 30-day
// subscription means 30 images") extended to cover the Brand Style/logo
// flows too, which previously had no cap at all.
export const MONTHLY_TOTAL_IMAGE_CAP = 40;
export const MONTHLY_BRAND_STYLE_CAP = 10;
export const MONTHLY_LOGO_CAP = 3;

export interface MonthlyImageUsage {
  total: number;
  brandStyle: number;
  logo: number;
}

/** How many real AI image generations an organization has used so far in
 * the current calendar month (UTC), across all three generation paths.
 * `ContentJob.generatedAt` (not `createdAt`) is used for scheduled content
 * because a slot-materialized job's row can be created up to a week before
 * it actually generates - what matters here is when the OpenAI call
 * happened, not when the row first appeared. Filtering on `creativeMetadata`
 * being set excludes same-day-reused jobs, which cost nothing extra. */
export async function getMonthlyImageUsage(
  organizationId: string,
  now: Date = new Date(),
): Promise<MonthlyImageUsage> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [contentGenerations, brandStyle, logo] = await Promise.all([
    prisma.contentJob.count({
      where: {
        organizationId,
        creativeMetadata: { not: Prisma.JsonNull },
        generatedAt: { gte: monthStart },
      },
    }),
    prisma.creativeConcept.count({
      where: { organizationId, kind: "BRAND_STYLE", createdAt: { gte: monthStart } },
    }),
    prisma.creativeConcept.count({
      where: { organizationId, kind: "LOGO", createdAt: { gte: monthStart } },
    }),
  ]);

  return { total: contentGenerations + brandStyle + logo, brandStyle, logo };
}
