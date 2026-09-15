import { getCreativeConcept } from "@socialpilot/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { approveLogoAction } from "../actions";

export default async function LogoReviewPage({
  params,
  searchParams,
}: PageProps<"/dashboard/logo/[id]">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const { returnTo } = await searchParams;
  const concept = await getCreativeConcept(session.organizationId, id);
  if (!concept) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose your logo
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pick the one that fits your brand — it&apos;ll be used consistently
          across future content, never redesigned automatically.
        </p>
      </div>

      <Card className="w-full max-w-sm overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concept.imageUrls[0]}
          alt="Generated logo concept"
          className="aspect-square w-full bg-white object-contain p-4"
        />
        <CardContent className="p-3">
          <form action={approveLogoAction}>
            <input type="hidden" name="imageUrl" value={concept.imageUrls[0]} />
            {typeof returnTo === "string" && (
              <input type="hidden" name="returnTo" value={returnTo} />
            )}
            <Button type="submit" className="w-full">
              Use this logo
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="w-fit">
        <Link
          href={
            typeof returnTo === "string"
              ? `/dashboard/logo?returnTo=${encodeURIComponent(returnTo)}`
              : "/dashboard/logo"
          }
        >
          Try a different description
        </Link>
      </Button>
    </div>
  );
}
