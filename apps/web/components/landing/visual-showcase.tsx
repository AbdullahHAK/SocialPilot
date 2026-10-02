import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/landing/reveal";
import { InstagramGlyph, ShowcaseLightboxItem } from "@/components/landing/showcase-lightbox";

interface ShowcaseCopy {
  business: string;
  businessType: string;
}

// Real AI-generated posts, actually published by real customers - adding
// the next ones is just appending here plus the copy entry at the matching
// index in landing.showcase.items (every locale's messages file).
const SHOWCASE_ITEMS = [
  {
    image: "/showcase/dc-chicken.jpg",
    instagramUrl: "https://www.instagram.com/p/Dd67l4bmPmP/",
  },
  {
    image: "/showcase/mgood.jpg",
    instagramUrl: "https://www.instagram.com/p/DdreusfmEd1/",
  },
];

export async function VisualShowcase() {
  const t = await getTranslations("landing.showcase");
  const copy = t.raw("items") as ShowcaseCopy[];

  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
          {SHOWCASE_ITEMS.map((item, index) => {
            const itemCopy = copy[index];
            if (!itemCopy) return null;
            return (
              <Reveal key={item.image} delayMs={index * 120}>
                <ShowcaseLightboxItem
                  image={item.image}
                  alt={itemCopy.business}
                  instagramUrl={item.instagramUrl}
                  business={itemCopy.business}
                  businessType={itemCopy.businessType}
                  viewOnInstagramLabel={t("viewOnInstagram")}
                >
                  <div className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-border shadow-sm transition-shadow duration-300 hover:shadow-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={itemCopy.business}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Always-visible Instagram badge - the "this is a real
                        post, not a mockup" signal at a glance. */}
                    <div className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/95 text-navy shadow">
                      <InstagramGlyph className="size-4" />
                    </div>

                    {/* Always-visible caption. */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent p-4 pt-14">
                      <p className="text-xs font-medium text-navy-foreground/70">
                        {itemCopy.businessType}
                      </p>
                      <p className="text-sm font-semibold text-navy-foreground">
                        {itemCopy.business}
                      </p>
                    </div>

                    {/* Hover-only invitation to click. */}
                    <div className="absolute inset-0 flex items-center justify-center bg-navy/0 opacity-0 transition-all duration-300 group-hover:bg-navy/30 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-lg">
                        <InstagramGlyph className="size-4" />
                        {t("tapToView")}
                      </span>
                    </div>
                  </div>
                </ShowcaseLightboxItem>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mx-auto mt-8 max-w-xl text-center" delayMs={240}>
          <p className="text-sm text-muted-foreground">{t("moreComing")}</p>
        </Reveal>
      </div>
    </section>
  );
}
