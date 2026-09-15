"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLocaleAction } from "@/lib/locale-actions";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@/lib/locale";
import { cn } from "@/lib/utils";

/** Present on every top-level shell (marketing header, auth shell, legal
 * pages, dashboard sidebar) so it's reachable from anywhere, per the
 * requirement that language can be changed at any moment. Setting the
 * cookie alone doesn't re-render already-loaded Server Components - the
 * router.refresh() is what actually picks up the new locale's messages. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <Select value={locale} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger
        className={cn("h-9 w-auto gap-1.5 border-none bg-transparent px-2 shadow-none", className)}
        aria-label={t("languageLabel")}
      >
        <Globe className="size-4 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {LOCALE_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
