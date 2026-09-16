// Single source of truth for the $19.90/mo, $99/6mo, $178/yr plan copy -
// reused by the landing page's pricing teaser, the standalone /pricing
// page, and /dashboard/subscription, which all showed the same plans as
// separately hand-maintained copies before this. Matches the shape both
// next-intl's useTranslations() (client) and getTranslations() (server)
// return - callable for a single string, plus .raw() for the features array.
export interface TranslatorWithRaw {
  (key: string): string;
  raw(key: string): unknown;
}

export interface PlanCopy {
  id: "MONTHLY" | "SIX_MONTH" | "YEARLY";
  name: string;
  price: string;
  cadence: string;
  description: string;
  featured: boolean;
}

export function getPlans(t: TranslatorWithRaw): PlanCopy[] {
  return [
    {
      id: "MONTHLY",
      name: t("monthly.name"),
      price: t("monthly.price"),
      cadence: t("monthly.cadence"),
      description: t("monthly.description"),
      featured: false,
    },
    {
      id: "SIX_MONTH",
      name: t("sixMonth.name"),
      price: t("sixMonth.price"),
      cadence: t("sixMonth.cadence"),
      description: t("sixMonth.description"),
      featured: false,
    },
    {
      id: "YEARLY",
      name: t("yearly.name"),
      price: t("yearly.price"),
      cadence: t("yearly.cadence"),
      description: t("yearly.description"),
      featured: true,
    },
  ];
}

export function getPlanFeatures(t: TranslatorWithRaw): string[] {
  return t.raw("features") as string[];
}
