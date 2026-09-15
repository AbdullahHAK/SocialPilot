import { getTranslations } from "next-intl/server";

interface ShowcaseItem {
  category: string;
  caption: string;
}

// Real photography (curated stock, not generated) standing in for the kind
// of on-brand content YOPAPI's AI designers produce - order matches
// landing.showcase.items in every locale's messages file index-for-index.
const IMAGE_URLS = [
  "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1426869981800-95ebf51ce900?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1485808191679-5f86510681a2?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1541781550486-81b7a2328578?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=800&auto=format&fit=crop",
];

export async function VisualShowcase() {
  const t = await getTranslations("landing.showcase");
  const items = t.raw("items") as ShowcaseItem[];

  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => (
            <div
              key={item.category}
              className="group relative aspect-3/4 overflow-hidden rounded-xl border border-border shadow-sm"
            >
              {/* Curated real photography, hotlinked - matches this app's
                  established plain-<img> convention for external images. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={IMAGE_URLS[index]}
                alt={item.category}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent p-3 pt-10">
                <p className="text-xs font-medium text-navy-foreground/70">{item.category}</p>
                <p className="text-sm font-semibold text-navy-foreground">{item.caption}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
