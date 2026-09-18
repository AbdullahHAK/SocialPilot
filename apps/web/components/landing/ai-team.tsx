import { CalendarClock, Palette, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/landing/reveal";

const ROLE_ICONS = [Palette, Sparkles, CalendarClock] as const;

interface Role {
  title: string;
  description: string;
}

export async function AiTeam() {
  const t = await getTranslations("landing.aiTeam");
  const roles = t.raw("roles") as Role[];

  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {roles.map((role, index) => {
            const Icon = ROLE_ICONS[index] ?? Sparkles;
            return (
              <Reveal key={role.title} delayMs={index * 120}>
                <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="text-lg font-semibold">{role.title}</h3>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delayMs={200}>
          <p className="mt-14 text-center text-xl font-semibold tracking-tight text-balance">
            {t("closing")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
