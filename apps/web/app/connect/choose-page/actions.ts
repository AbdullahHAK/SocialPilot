"use server";

import { decryptToken, encryptToken, upsertSocialAccount } from "@socialpilot/db";
import { redirect } from "next/navigation";
import { getPageById } from "@/lib/meta";
import { clearMetaPageChoiceCookie, getMetaPageChoice } from "@/lib/meta-page-choice";
import {
  getPendingSignup,
  setPendingSignupCookie,
  type PendingMetaPage,
} from "@/lib/pending-signup";
import { getSession } from "@/lib/session";

export async function chooseMetaPageAction(formData: FormData) {
  const choice = await getMetaPageChoice();
  if (!choice) {
    redirect("/connect");
  }

  const pageId = formData.get("pageId")?.toString();
  if (!pageId || !choice.choices.some((candidate) => candidate.id === pageId)) {
    redirect("/connect/choose-page");
  }

  const userToken = decryptToken(choice.encryptedUserToken);
  const page = await getPageById(userToken, pageId);
  await clearMetaPageChoiceCookie();

  if (choice.target === "session") {
    const session = await getSession();
    if (!session) {
      redirect("/login");
    }

    await upsertSocialAccount({
      organizationId: session.organizationId,
      provider: "FACEBOOK",
      externalId: page.id,
      displayName: page.name,
      accessToken: page.accessToken,
    });
    let connectedCount = 1;

    if (page.instagramBusinessAccount) {
      await upsertSocialAccount({
        organizationId: session.organizationId,
        provider: "INSTAGRAM",
        externalId: page.instagramBusinessAccount.id,
        displayName: page.instagramBusinessAccount.username,
        profilePictureUrl: page.instagramBusinessAccount.profilePictureUrl,
        accessToken: page.accessToken,
      });
      connectedCount++;
    }

    redirect(`/dashboard/accounts?connected=${connectedCount}`);
  }

  const pending = await getPendingSignup();
  if (!pending) {
    redirect("/pricing");
  }

  const metaPages: PendingMetaPage[] = [
    {
      provider: "FACEBOOK",
      externalId: page.id,
      displayName: page.name,
      encryptedAccessToken: encryptToken(page.accessToken),
    },
  ];

  if (page.instagramBusinessAccount) {
    metaPages.push({
      provider: "INSTAGRAM",
      externalId: page.instagramBusinessAccount.id,
      displayName: page.instagramBusinessAccount.username,
      profilePictureUrl: page.instagramBusinessAccount.profilePictureUrl,
      encryptedAccessToken: encryptToken(page.accessToken),
    });
  }

  await setPendingSignupCookie({ ...pending, metaPages });
  redirect("/connect");
}
