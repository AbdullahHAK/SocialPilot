import { getCreativeConcept } from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("dashboard.logoReview");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      <Card className="w-full max-w-sm overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concept.imageUrls[0]}
          alt={t("imageAlt")}
          className="aspect-square w-full bg-white object-contain p-4"
        />
        <CardContent className="p-3">
          <form action={approveLogoAction}>
            <input type="hidden" name="imageUrl" value={concept.imageUrls[0]} />
            {typeof returnTo === "string" && (
              <input type="hidden" name="returnTo" value={returnTo} />
            )}
            <Button type="submit" className="w-full">
              {t("useThisLogo")}
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
          {t("tryDifferentDescription")}
        </Link>
      </Button>
    </div>
  );
}
