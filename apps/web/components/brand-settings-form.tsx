"use client";

import { ImagePlus, Plus, X } from "lucide-react";
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
      <Card>
        <CardHeader>
          <CardTitle>Business basics</CardTitle>
          <CardDescription>
            The core details SocialPilot uses to keep content on-brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              name="businessName"
              defaultValue={defaults.businessName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              defaultValue={defaults.category}
              placeholder="e.g. Cafe, Clothing brand, Fitness studio"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={defaults.description}
              rows={3}
              placeholder="What does your business do?"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo & colors</CardTitle>
          <CardDescription>
            Used to keep generated visuals consistent with your brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="logo">Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                // Either a blob: URL from a freshly-selected file (which
                // next/image's optimizer can't fetch) or a low-stakes small
                // thumbnail of an already-hosted logo - not worth the
                // optimizer for either case.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Current logo"
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
                {logoPreview ? "Replace logo" : "Upload a logo"}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products & services</CardTitle>
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
                placeholder="e.g. Espresso, Wedding photography, Yoga classes"
              />
              {products.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove product"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language & tone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language">Preferred language</Label>
            <Select name="language" defaultValue={defaults.language}>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tone">Content style / tone</Label>
            <Input
              id="tone"
              name="tone"
              defaultValue={defaults.tone}
              placeholder="e.g. Warm and friendly, Bold and playful, Professional"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          Save changes
        </Button>
        {state.success && (
          <p className="text-sm font-medium text-success">Saved.</p>
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
