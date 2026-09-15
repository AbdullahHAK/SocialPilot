import { getTranslations } from "next-intl/server";

interface Step {
  title: string;
  description: string;
}

export async function ThreeMinuteSetup() {
  const t = await getTranslations("landing.threeMinutes");
  const steps = t.raw("steps") as Step[];

  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
        <div className="flex flex-col items-start gap-4 text-start">
          <span className="bg-gradient-to-br from-primary to-navy bg-clip-text text-7xl font-black tracking-tight text-transparent sm:text-8xl">
            {t("eyebrow")}
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {t("title")}
          </h2>
          <p className="text-lg font-semibold text-primary">{t("closing")}</p>
        </div>

        <ol className="flex flex-col gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
