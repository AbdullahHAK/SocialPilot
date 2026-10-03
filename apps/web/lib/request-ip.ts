import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP for the terms-acceptance legal record - Vercel
 * (and most proxies) set x-forwarded-for; there's no guaranteed source of
 * truth, so a miss just means a thinner record, not a broken one. */
export async function getClientIp(): Promise<string | null> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  return headersList.get("x-real-ip");
}
