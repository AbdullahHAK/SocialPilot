"use client";

import { ImagePlus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { OnboardingFormState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const DEFAULT_COLORS = ["#111111", "#ffffff"];

export type OnboardingAction = (
  state: OnboardingFormState,
  formData: FormData,
) => Promise<OnboardingFormState>;

export function OnboardingWizard({ action }: { action: OnboardingAction }) {
  const t = useTranslations("onboarding.wizard");
  const [state, formAction, isPending] = useActionState<
    OnboardingFormState,
    FormData
  >(action, {});
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [products, setProducts] = useState<string[]>([""]);
  const [logoName, setLogoName] = useState<string | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("steps.0")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field
            label={t("step1.businessName")}
            name="businessName"
            placeholder={t("step1.businessNamePlaceholder")}
          />
          <Field
            label={t("step1.category")}
            name="category"
            placeholder={t("step1.categoryPlaceholder")}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">{t("step1.describeLabel")}</Label>
            <Textarea
              id="description"
              name="description"
              placeholder={t("step1.describePlaceholder")}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{t("step1.describeHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.1")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="logo">{t("step2.logo")}</Label>
            <label
              htmlFor="logo"
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30"
            >
              <ImagePlus className="size-5 shrink-0" />
              {logoName ?? t("step2.logoUploadPrompt")}
            </label>
            <input
              id="logo"
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? null)}
              className="sr-only"
            />
            <p className="text-xs text-muted-foreground">{t("step2.logoHint")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("step2.brandColors")}</Label>
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
                      aria-label={t("step2.removeColor", { number: index + 1 })}
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
                  aria-label={t("step2.addColor")}
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
          <CardTitle>{t("steps.2")}</CardTitle>
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
                placeholder={t("step3.productPlaceholder")}
              />
              {products.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
            {t("step3.addAnother")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.3")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">{t("step4.preferredLanguage")}</Label>
            <Select name="language" defaultValue="en">
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`step4.languages.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label={t("step4.toneLabel")}
            name="tone"
            placeholder={t("step4.tonePlaceholder")}
          />
        </CardContent>
      </Card>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {t("saveAndContinue")}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} />
    </div>
  );
}
