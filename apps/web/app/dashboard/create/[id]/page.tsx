import { getCreativeConcept } from "@socialpilot/db";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose your style
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pick the concept that feels most &ldquo;you&rdquo; — this sets the
          visual style SocialPilot uses for future content.
        </p>
      </div>

      <Card className="w-full max-w-sm overflow-hidden">
        {/* Freshly-generated image hosted on R2 - not worth wiring up
            next/image's remote-pattern config for a single preview. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concept.imageUrls[0]}
          alt="Generated content concept"
          className="aspect-square w-full object-cover"
        />
        <CardContent className="p-3">
          <form action={approveConceptAction}>
            <input type="hidden" name="conceptId" value={concept.id} />
            <input type="hidden" name="imageUrl" value={concept.imageUrls[0]} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" className="w-full">
              Approve this style
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
        <Link href={tryAgainHref}>Try a different prompt</Link>
      </Button>
    </div>
  );
}
