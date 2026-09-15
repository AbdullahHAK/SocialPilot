"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import type { CreateContentFormState } from "@/app/dashboard/create/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TEMPLATES = [
  {
    emoji: "🍔",
    label: "Product Promotion",
    prompt:
      "Create a promotional post for our crispy chicken burger with a special weekend offer.",
  },
  {
    emoji: "🔥",
    label: "Special Offer",
    prompt:
      "Create an eye-catching post announcing a limited-time 20% discount on all orders this week.",
  },
  {
    emoji: "🆕",
    label: "New Product",
    prompt:
      "Create an exciting announcement post introducing our new spicy chicken wrap.",
  },
  {
    emoji: "🎉",
    label: "Weekend Promotion",
    prompt:
      "Create a fun, festive post promoting a buy-one-get-one-free weekend deal.",
  },
  {
    emoji: "📱",
    label: "Instagram Story",
    prompt:
      "Create a bold, vertical Instagram Story design announcing today's lunch special.",
  },
];

export type CreateContentAction = (
  state: CreateContentFormState,
  formData: FormData,
) => Promise<CreateContentFormState>;

export function CreateContentForm({
  action,
  returnTo,
  remainingBrandStyleRevisions,
}: {
  action: CreateContentAction;
  returnTo?: string;
  remainingBrandStyleRevisions: number;
}) {
  const [state, formAction, isPending] = useActionState<
    CreateContentFormState,
    FormData
  >(action, {});
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setFiles((prev) => [...prev, ...Array.from(fileList)].slice(0, 4));
  }

  // The visible upload control is reset after each pick so users can add
  // images across multiple selections; this hidden input carries the
  // accumulated set into the form submit.
  useEffect(() => {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    if (fileInputRef.current) {
      fileInputRef.current.files = transfer.files;
    }
  }, [files]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          What do you want to create?
        </h1>
        <p className="mt-1 text-muted-foreground">
          Describe your post in plain English. YOPAPI&apos;s AI will
          generate one on-brand image concept for you to review.
        </p>
      </div>

      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        You have {remainingBrandStyleRevisions} of 10 Brand Style revisions
        left this month. Craft your prompt carefully and describe exactly
        what you want for the best result.
      </p>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.label}
            type="button"
            onClick={() => setPrompt(template.prompt)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <span aria-hidden>{template.emoji}</span>
            {template.label}
          </button>
        ))}
      </div>

      <Textarea
        name="prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        placeholder="e.g. Create a promotional post for our crispy chicken burger with a special weekend offer."
        className="resize-none text-base"
      />

      <div className="flex flex-col gap-2">
        <Label>Add images (optional)</Label>
        <p className="text-sm text-muted-foreground">
          Product photos, your logo, or anything you&apos;d like the AI to
          use as inspiration.
        </p>
        <label
          htmlFor="referenceImages"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30"
        >
          <ImagePlus className="size-5 shrink-0" />
          Click to upload images
        </label>
        <input
          id="referenceImages"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => addFiles(e.target.files)}
          className="sr-only"
        />
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
              >
                {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="file"
          name="referenceImages"
          multiple
          hidden
          ref={fileInputRef}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !prompt.trim() || remainingBrandStyleRevisions <= 0}
        className="w-fit gap-2"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {isPending ? "Generating concept…" : "Generate concept"}
      </Button>
    </form>
  );
}
