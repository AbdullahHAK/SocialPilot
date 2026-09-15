import { CalendarClock, Palette, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

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
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {roles.map((role, index) => {
            const Icon = ROLE_ICONS[index] ?? Sparkles;
            return (
              <div
                key={role.title}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-7 shadow-sm"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <h3 className="text-lg font-semibold">{role.title}</h3>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-14 text-center text-xl font-semibold tracking-tight text-balance">
          {t("closing")}
        </p>
      </div>
    </section>
  );
}
