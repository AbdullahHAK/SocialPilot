"use client";

import { ImagePlus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { BrandSettingsFormState } from "@/app/dashboard/brand/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LANGUAGE_VALUES = ["en", "ur", "ar", "es", "fr", "hi", "pt", "de"] as const;

export type BrandSettingsAction = (
  state: BrandSettingsFormState,
  formData: FormData,
) => Promise<BrandSettingsFormState>;

export interface BrandProfileDefaults {
  businessName: string;
  category: string;
  description: string;
  logoUrl: string | null;
  colors: string[];
  language: string;
  tone: string;
  productsServices: string[];
}

export function BrandSettingsForm({
  action,
  defaults,
}: {
  action: BrandSettingsAction;
  defaults: BrandProfileDefaults;
}) {
  const t = useTranslations("dashboard.brandForm");
  const tLang = useTranslations("languages");
  const [state, formAction, isPending] = useActionState<
    BrandSettingsFormState,
    FormData
  >(action, {});
  const [colors, setColors] = useState<string[]>(
    defaults.colors.length > 0 ? defaults.colors : ["#111111", "#ffffff"],
  );
  const [products, setProducts] = useState<string[]>(
    defaults.productsServices.length > 0 ? defaults.productsServices : [""],
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(
    defaults.logoUrl,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Duplicated next to the Save button below - this form is long
       * enough on mobile that submitting (from anywhere, e.g. the Logo
       * field near the top) never scrolls the page, so a result shown only
       * at the very bottom went unseen and looked like nothing happened. */}
      {(state.error || state.success) && (
        <div
          role={state.error ? "alert" : undefined}
          className={
            state.error
              ? "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
              : "rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success"
          }
        >
          {state.error ?? state.note ?? t("saved")}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("businessBasics")}</CardTitle>
          <CardDescription>{t("businessBasicsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">{t("businessName")}</Label>
            <Input
              id="businessName"
              name="businessName"
              defaultValue={defaults.businessName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">{t("category")}</Label>
            <Input
              id="category"
              name="category"
              defaultValue={defaults.category}
              placeholder={t("categoryPlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">{t("describeLabel")}</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={defaults.description}
              rows={4}
              placeholder={t("describePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("describeHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("logoAndColors")}</CardTitle>
          <CardDescription>{t("logoAndColorsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="logo">{t("logo")}</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                // Either a blob: URL from a freshly-selected file (which
                // next/image's optimizer can't fetch) or a low-stakes small
                // thumbnail of an already-hosted logo - not worth the
                // optimizer for either case.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt={t("currentLogoAlt")}
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-lg border border-border object-contain p-1"
                />
              )}
              <label
                htmlFor="logo"
                className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30"
              >
                <ImagePlus className="size-5 shrink-0" />
                {logoPreview ? t("replaceLogo") : t("uploadLogo")}
              </label>
              <input
                id="logo"
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setLogoPreview(URL.createObjectURL(file));
                }}
                className="sr-only"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("brandColors")}</Label>
            <div className="flex flex-wrap items-center gap-3">
              {colors.map((color, index) => (
                <div key={index} className="group relative">
                  <input
                    type="color"
                    name="colors"
                    value={color}
                    onChange={(e) =>
                      setColors((prev) =>
                        prev.map((c, i) => (i === index ? e.target.value : c)),
                      )
                    }
                    className="size-10 cursor-pointer rounded-lg border border-input p-0.5"
                  />
                  {colors.length > 1 && (
                    <button
                      type="button"
                      aria-label={t("removeColor", { number: index + 1 })}
                      onClick={() =>
                        setColors((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="absolute -top-1.5 -end-1.5 hidden size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </div>
              ))}
              {colors.length < 6 && (
                <button
                  type="button"
                  aria-label={t("addColor")}
                  onClick={() => setColors((prev) => [...prev, "#888888"])}
                  className="flex size-10 items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("productsServices")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {products.map((product, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                name="productsServices"
                value={product}
                onChange={(e) =>
                  setProducts((prev) =>
                    prev.map((p, i) => (i === index ? e.target.value : p)),
                  )
                }
                placeholder={t("productPlaceholder")}
              />
              {products.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeProduct")}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setProducts((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 w-fit gap-1.5"
            onClick={() => setProducts((prev) => [...prev, ""])}
          >
            <Plus className="size-4" />
            {t("addAnother")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("languageAndTone")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">{t("preferredLanguage")}</Label>
            <Select name="language" defaultValue={defaults.language}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tLang(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tone">{t("toneLabel")}</Label>
            <Input
              id="tone"
              name="tone"
              defaultValue={defaults.tone}
              placeholder={t("tonePlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {t("saveChanges")}
        </Button>
        {state.success && !state.note && (
          <p className="text-sm font-medium text-success">{t("saved")}</p>
        )}
        {state.note && (
          <p className="text-sm font-medium text-muted-foreground">{state.note}</p>
        )}
        {state.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
