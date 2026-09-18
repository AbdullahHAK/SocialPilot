"use client";

import { Plus, X } from "lucide-react";
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
  const [products, setProducts] = useState<string[]>([""]);

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
          <CardTitle>{t("steps.2")}</CardTitle>
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
