"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { OnboardingFormState } from "@/app/onboarding/actions";

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
    <form action={formAction} className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-3 text-xs font-medium text-gray-500">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "text-black" : ""}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <Step active={step === 0}>
        <div className="flex flex-col gap-4">
          {/* No `required` here: Chromium doesn't reliably exempt a
              required field from constraint validation just because an
              ancestor is `hidden` on a later step, so it can block
              submission on a field the user can't see or fix. The server
              action validates this instead. */}
          <Field label="Business name" name="businessName" />
          <Field
            label="Category"
            name="category"
            placeholder="e.g. Cafe, Clothing brand, Fitness studio"
          />
          <TextArea
            label="Description"
            name="description"
            placeholder="What does your business do?"
          />
        </div>
      </Step>

      <Step active={step === 1}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Logo
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? null)}
              className="text-sm font-normal"
            />
            {logoName && (
              <span className="text-xs font-normal text-gray-500">
                Selected: {logoName}
              </span>
            )}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Brand colors</span>
            <div className="flex flex-wrap gap-3">
              {colors.map((color, index) => (
                <div key={index} className="flex items-center gap-1">
                  <input
                    type="color"
                    name="colors"
                    value={color}
                    onChange={(e) =>
                      setColors((prev) =>
                        prev.map((c, i) => (i === index ? e.target.value : c)),
                      )
                    }
                    className="h-9 w-9 cursor-pointer rounded border border-gray-300"
                  />
                  {colors.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setColors((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="text-xs text-gray-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {colors.length < 6 && (
              <button
                type="button"
                onClick={() => setColors((prev) => [...prev, "#888888"])}
                className="self-start text-xs underline"
              >
                + Add color
              </button>
            )}
          </div>
        </div>
      </Step>

      <Step active={step === 2}>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Products / services</span>
          {products.map((product, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                name="productsServices"
                value={product}
                onChange={(e) =>
                  setProducts((prev) =>
                    prev.map((p, i) => (i === index ? e.target.value : p)),
                  )
                }
                placeholder="e.g. Espresso, Wedding photography, Yoga classes"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {products.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setProducts((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="text-xs text-gray-400"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setProducts((prev) => [...prev, ""])}
            className="self-start text-xs underline"
          >
            + Add another
          </button>
        </div>
      </Step>

      <Step active={step === 3}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Preferred language
            <select
              name="language"
              defaultValue="en"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Content style / tone"
            name="tone"
            placeholder="e.g. Warm and friendly, Bold and playful, Professional"
          />
        </div>
      </Step>

      <Step active={step === 4}>
        <div className="flex flex-col gap-2 text-sm text-gray-600">
          <p>
            Review your answers with Back, then Finish to go to your
            dashboard. You&apos;ll be able to fine-tune these later in Brand
            Settings.
          </p>
        </div>
      </Step>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Back
        </button>
        {isLastStep ? (
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Finish
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Next
          </button>
        )}
      </div>
    </form>
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
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <textarea
        name={name}
        placeholder={placeholder}
        rows={3}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}
