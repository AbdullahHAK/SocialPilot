import { getTranslations } from "next-intl/server";

export async function StayVisible() {
  const t = await getTranslations("landing.stayVisible");

  return (
    <section className="bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div className="order-2 flex flex-col items-start gap-5 text-start lg:order-1">
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="text-lg text-pretty text-navy-foreground/80">{t("body")}</p>
          <p className="text-lg font-semibold text-gold">{t("highlight")}</p>
          <div className="mt-2 border-s-2 border-gold/50 ps-4">
            <p className="text-xl font-medium">{t("emotionalLine1")}</p>
            <p className="text-xl font-bold">{t("emotionalLine2")}</p>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative overflow-hidden rounded-2xl border border-navy-foreground/10 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1753351052363-53ce102830eb?q=80&w=1000&auto=format&fit=crop"
              alt=""
              className="aspect-4/5 size-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
