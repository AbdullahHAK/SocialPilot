"use client";

import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { GenerateLogoFormState, SaveColorsFormState } from "@/app/dashboard/logo/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type GenerateLogoAction = (
  state: GenerateLogoFormState,
  formData: FormData,
) => Promise<GenerateLogoFormState>;

export type SaveColorsAction = (
  state: SaveColorsFormState,
  formData: FormData,
) => Promise<SaveColorsFormState>;

type LogoMode = "generate" | "upload";

export function GenerateLogoForm({
  action,
  uploadAction,
  colorsAction,
  returnTo,
  remainingLogoRevisions,
  logoCap,
  initialColors = [],
}: {
  action: GenerateLogoAction;
  uploadAction: GenerateLogoAction;
  colorsAction: SaveColorsAction;
  returnTo?: string;
  remainingLogoRevisions: number;
  logoCap: number;
  initialColors?: string[];
}) {
  const t = useTranslations("dashboard.logoForm");
  const [mode, setMode] = useState<LogoMode>("generate");
  const [generateState, generateFormAction, isGenerating] = useActionState<
    GenerateLogoFormState,
    FormData
  >(action, {});
  const [uploadState, uploadFormAction, isUploading] = useActionState<
    GenerateLogoFormState,
    FormData
  >(uploadAction, {});
  const [colorsState, colorsFormAction, isSavingColors] = useActionState<
    SaveColorsFormState,
    FormData
  >(colorsAction, {});
  const [prompt, setPrompt] = useState("");
  const [logoName, setLogoName] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>(
    initialColors.length > 0 ? initialColors : ["#111111", "#ffffff"],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("brandColors")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("brandColorsHint")}</p>
          <form action={colorsFormAction} className="flex flex-col gap-3">
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
            <div className="flex items-center gap-3">
              <Button type="submit" variant="outline" size="sm" disabled={isSavingColors} className="w-fit">
                {isSavingColors ? t("saving") : t("saveColors")}
              </Button>
              {colorsState.success && (
                <p className="text-sm font-medium text-success">{t("colorsSaved")}</p>
              )}
              {colorsState.error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {colorsState.error}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("logo")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { value: "generate" as const, label: t("modeGenerate") },
                { value: "upload" as const, label: t("modeUpload") },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={mode === option.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === "generate" ? (
            <form action={generateFormAction} className="flex flex-col gap-4">
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {t("revisionsWarning", { count: remainingLogoRevisions, cap: logoCap })}
              </p>
              <Textarea
                name="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder={t("promptPlaceholder")}
                className="resize-none text-base"
              />

              {generateState.error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {generateState.error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={isGenerating || !prompt.trim() || remainingLogoRevisions <= 0}
                className="w-fit gap-2"
              >
                {isGenerating && <Loader2 className="size-4 animate-spin" />}
                {isGenerating ? t("generating") : t("generate")}
              </Button>
            </form>
          ) : (
            <form action={uploadFormAction} className="flex flex-col gap-4">
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
              <div className="flex flex-col gap-2">
                <Label htmlFor="logo">{t("uploadLabel")}</Label>
                <label
                  htmlFor="logo"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30"
                >
                  <ImagePlus className="size-5 shrink-0" />
                  {logoName ?? t("uploadPrompt")}
                </label>
                <input
                  id="logo"
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? null)}
                  className="sr-only"
                />
              </div>

              {uploadState.error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {uploadState.error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={isUploading || !logoName}
                className="w-fit gap-2"
              >
                {isUploading && <Loader2 className="size-4 animate-spin" />}
                {isUploading ? t("saving") : t("saveLogo")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
