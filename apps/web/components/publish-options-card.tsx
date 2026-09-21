"use client";

import { Check, Image as ImageIcon, Images, Loader2, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, type ComponentType } from "react";
import type { PublishOptionsState } from "@/app/dashboard/schedule/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PublishMode = "POST_AND_STORY" | "STORY_ONLY" | "POST_ONLY";

export type PublishOptionsAction = (
  state: PublishOptionsState,
  formData: FormData,
) => Promise<PublishOptionsState>;

const MODES: {
  value: PublishMode;
  labelKey: "postAndStory" | "storyOnly" | "postOnly";
  hintKey: "postAndStoryHint" | "storyOnlyHint" | "postOnlyHint";
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: "POST_AND_STORY", labelKey: "postAndStory", hintKey: "postAndStoryHint", icon: Images },
  { value: "STORY_ONLY", labelKey: "storyOnly", hintKey: "storyOnlyHint", icon: Smartphone },
  { value: "POST_ONLY", labelKey: "postOnly", hintKey: "postOnlyHint", icon: ImageIcon },
];

export function PublishOptionsCard({
  action,
  initialMode,
  initialIncludeCaption,
}: {
  action: PublishOptionsAction;
  initialMode: PublishMode;
  initialIncludeCaption: boolean;
}) {
  const t = useTranslations("dashboard.schedule.publishOptions");
  const [state, formAction, isPending] = useActionState<PublishOptionsState, FormData>(action, {});
  const [mode, setMode] = useState<PublishMode>(initialMode);
  const [includeCaption, setIncludeCaption] = useState(initialIncludeCaption);

  // Stories carry no caption on either platform, so the choice is moot -
  // shown but locked rather than hidden, so it's clear why.
  const captionApplies = mode !== "STORY_ONLY";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="publishMode" value={mode} />
          <input type="hidden" name="includeCaption" value={String(includeCaption)} />

          <div role="radiogroup" aria-label={t("title")} className="grid gap-3 sm:grid-cols-3">
            {MODES.map(({ value, labelKey, hintKey, icon: Icon }) => {
              const selected = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(value)}
                  className={cn(
                    "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-accent/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold">{t(labelKey)}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{t(hintKey)}</span>
                  {selected && (
                    <span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4",
              !captionApplies && "opacity-60",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("captionLabel")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {captionApplies ? t("captionHint") : t("captionNotForStories")}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label={t("captionLabel")}
              className="inline-flex rounded-lg border border-border bg-background p-0.5"
            >
              {[
                { value: true, label: t("yes") },
                { value: false, label: t("no") },
              ].map((option) => {
                const selected = includeCaption === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!captionApplies}
                    onClick={() => setIncludeCaption(option.value)}
                    className={cn(
                      "min-w-14 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
            {state.saved && !isPending && (
              <p className="text-sm font-medium text-success">{t("saved")}</p>
            )}
            {state.error && !isPending && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {t("saveFailed")}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
