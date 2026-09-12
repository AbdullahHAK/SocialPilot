"use client";

import { Check, ImagePlus, Plus, X } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import type { OnboardingFormState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const STEPS = [
  "Business basics",
  "Logo & colors",
  "Products & services",
  "Language & tone",
  "Review",
] as const;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "hi", label: "Hindi" },
  { value: "pt", label: "Portuguese" },
  { value: "de", label: "German" },
];

const DEFAULT_COLORS = ["#111111", "#ffffff"];

export type OnboardingAction = (
  state: OnboardingFormState,
  formData: FormData,
) => Promise<OnboardingFormState>;

export function OnboardingWizard({ action }: { action: OnboardingAction }) {
  const [state, formAction, isPending] = useActionState<
    OnboardingFormState,
    FormData
  >(action, {});
  const [step, setStep] = useState(0);
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [products, setProducts] = useState<string[]>([""]);
  const [logoName, setLogoName] = useState<string | null>(null);

  const isLastStep = step === STEPS.length - 1;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <Stepper currentStep={step} />

      <Step active={step === 0}>
        <div className="flex flex-col gap-5">
          {/* No `required` here: Chromium doesn't reliably exempt a
              required field from constraint validation just because an
              ancestor is `hidden` on a later step, so it can block
              submission on a field the user can't see or fix. The server
              action validates this instead. */}
          <Field label="Business name" name="businessName" placeholder="Acme Coffee Co" />
          <Field
            label="Category"
            name="category"
            placeholder="e.g. Cafe, Clothing brand, Fitness studio"
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What does your business do?"
              rows={3}
            />
          </div>
        </div>
      </Step>

      <Step active={step === 1}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="logo">Logo</Label>
            <label
              htmlFor="logo"
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30"
            >
              <ImagePlus className="size-5 shrink-0" />
              {logoName ?? "Click to upload a logo (PNG, JPEG, WebP, or SVG)"}
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

          <div className="flex flex-col gap-2">
            <Label>Brand colors</Label>
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
                      aria-label={`Remove color ${index + 1}`}
                      onClick={() =>
                        setColors((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </div>
              ))}
              {colors.length < 6 && (
                <button
                  type="button"
                  aria-label="Add color"
                  onClick={() => setColors((prev) => [...prev, "#888888"])}
                  className="flex size-10 items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Step>

      <Step active={step === 2}>
        <div className="flex flex-col gap-2">
          <Label>Products / services</Label>
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
                placeholder="e.g. Espresso, Wedding photography, Yoga classes"
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
            Add another
          </Button>
        </div>
      </Step>

      <Step active={step === 3}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">Preferred language</Label>
            <Select name="language" defaultValue="en">
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label="Content style / tone"
            name="tone"
            placeholder="e.g. Warm and friendly, Bold and playful, Professional"
          />
        </div>
      </Step>

      <Step active={step === 4}>
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Review your answers with Back, then Finish to go to your dashboard.
          You&apos;ll be able to fine-tune these later in Brand Settings.
        </div>
      </Step>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {isLastStep ? (
          // `key` forces React to mount a fresh element here rather than
          // mutating the Next button in place: without it, the same DOM
          // node's type flips button -> submit as part of the very click
          // that turns Next into Finish, and the browser can treat that
          // click as activating the now-submit button, silently skipping
          // the review step and submitting onboarding one click early.
          <Button key="finish" type="submit" disabled={isPending}>
            Finish
          </Button>
        ) : (
          <Button
            key="next"
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Next
          </Button>
        )}
      </div>
    </form>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((label, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent &&
                    "border-2 border-primary text-primary",
                  !isCompleted &&
                    !isCurrent &&
                    "border border-border text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-center text-[11px] font-medium whitespace-nowrap sm:block",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-2 h-px flex-1",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Step({ active, children }: { active: boolean; children: ReactNode }) {
  // The `hidden` attribute must be the only display-affecting thing on this
  // element: Tailwind's `flex`/`grid`/etc. utility classes live in a later
  // cascade layer than the browser's default `[hidden]{display:none}` rule,
  // so putting a layout class on the same element as `hidden` would win and
  // silently un-hide it (Chrome then refuses to submit the form because a
  // "hidden" required field is actually still visible and empty).
  return <div hidden={!active}>{children}</div>;
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
