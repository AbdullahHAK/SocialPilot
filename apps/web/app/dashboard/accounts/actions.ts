"use server";

import { disconnectSocialAccount } from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";

export async function disconnectAccountAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const accountId = formData.get("accountId");
  if (typeof accountId !== "string") return;

  await disconnectSocialAccount(session.organizationId, accountId);
  revalidatePath("/dashboard/accounts");
}
