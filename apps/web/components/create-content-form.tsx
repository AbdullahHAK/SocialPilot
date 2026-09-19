"use client";

import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useActionState, useState, useTransition } from "react";
import type { CreateContentFormState } from "@/app/dashboard/create/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REFERENCE_IMAGE_MAX_BYTES, REFERENCE_IMAGE_MAX_COUNT } from "@/lib/validation";

// labelKey is UI copy (translated) - prompt is sent to the AI model as an
// English instruction fragment and deliberately stays English in every
// locale, same as the content-engine's own prompt-building code.
const TEMPLATES = [
  {
    emoji: "🍔",
    labelKey: "productPromotion",
    prompt:
      "Create a promotional post for our crispy chicken burger with a special weekend offer.",
  },
  {
    emoji: "🔥",
    labelKey: "specialOffer",
    prompt:
      "Create an eye-catching post announcing a limited-time 20% discount on all orders this week.",
  },
  {
    emoji: "🆕",
    labelKey: "newProduct",
    prompt:
      "Create an exciting announcement post introducing our new spicy chicken wrap.",
  },
  {
    emoji: "🎉",
    labelKey: "weekendPromotion",
    prompt:
      "Create a fun, festive post promoting a buy-one-get-one-free weekend deal.",
  },
  {
    emoji: "📱",
    labelKey: "instagramStory",
    prompt:
      "Create a bold, vertical Instagram Story design announcing today's lunch special.",
  },
] as const;

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
  const t = useTranslations("dashboard.createForm");
  const tErrors = useTranslations("dashboard.create.errors");
  const [state, formAction, isActionPending] = useActionState<
    CreateContentFormState,
    FormData
  >(action, {});
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const isPending = isUploading || isActionPending;

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const oversized = incoming.some((file) => file.size > REFERENCE_IMAGE_MAX_BYTES);
    setUploadError(oversized ? tErrors("imageTooLarge") : null);
    setFiles((prev) =>
      [...prev, ...incoming.filter((file) => file.size <= REFERENCE_IMAGE_MAX_BYTES)].slice(
        0,
        REFERENCE_IMAGE_MAX_COUNT,
      ),
    );
  }

  // Files never travel through this Server Action's own request body - each
  // one goes straight from the browser to Vercel Blob (see
  // app/api/reference-image-upload/route.ts), since Vercel's platform
  // enforces a hard ~4.5MB request body limit on every function regardless
  // of any app-level config (confirmed live: a 413 FUNCTION_PAYLOAD_TOO_LARGE
  // at just over 4.2MB), and a real multi-photo upload routinely exceeds
  // that. Only the resulting small URLs are submitted to the real action.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    startUpload(async () => {
      const referenceImageUrls: string[] = [];
      try {
        await Promise.all(
          files.map(async (file) => {
            const blob = await upload(`reference/${file.name}`, file, {
              access: "public",
              handleUploadUrl: "/api/reference-image-upload",
            });
            referenceImageUrls.push(blob.url);
          }),
        );
      } catch (error) {
        console.error("Reference image upload failed", error);
        setUploadError(tErrors("generationFailed"));
        return;
      }

      const formData = new FormData();
      formData.set("prompt", prompt);
      if (returnTo) formData.set("returnTo", returnTo);
      referenceImageUrls.forEach((url) => formData.append("referenceImageUrls", url));
      formAction(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        {t("revisionsWarning", { count: remainingBrandStyleRevisions })}
      </p>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.labelKey}
            type="button"
            onClick={() => setPrompt(template.prompt)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <span aria-hidden>{template.emoji}</span>
            {t(`templates.${template.labelKey}`)}
          </button>
        ))}
      </div>

      <Textarea
        name="prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        placeholder={t("promptPlaceholder")}
        className="resize-none text-base"
      />

      <div className="flex flex-col gap-2">
        <Label>{t("addImages")}</Label>
        <p className="text-sm text-muted-foreground">{t("addImagesHint")}</p>
        {files.length < REFERENCE_IMAGE_MAX_COUNT ? (
          <label
            htmlFor="referenceImages"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <ImagePlus className="size-5 shrink-0" />
            {t("clickToUpload")}
          </label>
        ) : (
          <p className="rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">
            {t("maxImagesReached", { max: REFERENCE_IMAGE_MAX_COUNT })}
          </p>
        )}
        <input
          id="referenceImages"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => addFiles(e.target.files)}
          disabled={files.length >= REFERENCE_IMAGE_MAX_COUNT}
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
                  aria-label={t("removeFile", { name: file.name })}
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
      </div>

      {(uploadError || state.error) && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {uploadError ?? state.error}
        </p>
      )}

      {isPending && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {t("stayOnPage")}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !prompt.trim() || remainingBrandStyleRevisions <= 0}
        className="w-fit gap-2"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {isPending ? t("generating") : t("generate")}
      </Button>
    </form>
  );
}
