import { getCreativeConcept } from "@socialpilot/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { approveConceptAction } from "../actions";

export default async function ConceptReviewPage({
  params,
}: PageProps<"/dashboard/create/[id]">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const concept = await getCreativeConcept(session.organizationId, id);
  if (!concept) {
    notFound();
  }

  if (concept.status === "APPROVED") {
    redirect("/dashboard/style");
  }

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

      <div className="grid gap-4 sm:grid-cols-3">
        {concept.imageUrls.map((url) => (
          <Card key={url} className="overflow-hidden">
            {/* Freshly-generated images hosted on R2 - not worth wiring up
                next/image's remote-pattern config for a preview grid. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Generated content concept"
              className="aspect-square w-full object-cover"
            />
            <CardContent className="p-3">
              <form action={approveConceptAction}>
                <input type="hidden" name="conceptId" value={concept.id} />
                <input type="hidden" name="imageUrl" value={url} />
                <Button type="submit" className="w-full">
                  Approve this style
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button asChild variant="outline" className="w-fit">
        <Link href="/dashboard/create">Try a different prompt</Link>
      </Button>
    </div>
  );
}
