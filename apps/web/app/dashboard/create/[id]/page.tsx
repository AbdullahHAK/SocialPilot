import { getCreativeConcept } from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RegenerateConceptForm } from "@/components/regenerate-concept-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { safeReturnTo } from "@/lib/safe-return-to";
import { getSession } from "@/lib/session";
import { approveConceptAction, regenerateConceptAction } from "../actions";

export default async function ConceptReviewPage({
  params,
  searchParams,
}: PageProps<"/dashboard/create/[id]">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const { returnTo: returnToParam } = await searchParams;
  const returnTo = safeReturnTo(
    typeof returnToParam === "string" ? returnToParam : null,
    "/dashboard/schedule",
  );

  const concept = await getCreativeConcept(session.organizationId, id);
  if (!concept) {
    notFound();
  }

  if (concept.status === "APPROVED") {
    redirect(returnTo);
  }

  const tryAgainHref = `/dashboard/create?returnTo=${encodeURIComponent(returnTo)}`;
  const t = await getTranslations("dashboard.conceptReview");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      <Card className="w-full max-w-sm overflow-hidden">
        {/* Freshly-generated image hosted on R2 - not worth wiring up
            next/image's remote-pattern config for a single preview. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concept.imageUrls[0]}
          alt={t("imageAlt")}
          className="aspect-square w-full object-cover"
        />
        <CardContent className="p-3">
          <form action={approveConceptAction}>
            <input type="hidden" name="conceptId" value={concept.id} />
            <input type="hidden" name="imageUrl" value={concept.imageUrls[0]} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" className="w-full">
              {t("approveStyle")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <RegenerateConceptForm
        action={regenerateConceptAction}
        conceptId={concept.id}
        returnTo={returnTo}
      />

      <Button asChild variant="outline" className="w-fit">
        <Link href={tryAgainHref}>{t("tryDifferentPrompt")}</Link>
      </Button>
    </div>
  );
}
