"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import type { GenerateLogoFormState } from "@/app/dashboard/logo/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type GenerateLogoAction = (
  state: GenerateLogoFormState,
  formData: FormData,
) => Promise<GenerateLogoFormState>;

export function GenerateLogoForm({ action }: { action: GenerateLogoAction }) {
  const [state, formAction, isPending] = useActionState<
    GenerateLogoFormState,
    FormData
  >(action, {});
  const [prompt, setPrompt] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Textarea
        name="prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="e.g. Create a modern logo for a premium crispy chicken restaurant called DC Chicken. Bold, memorable, suitable for a fast-food brand."
        className="resize-none text-base"
      />

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !prompt.trim()}
        className="w-fit gap-2"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {isPending ? "Generating logo concepts…" : "Generate 3 logo concepts"}
      </Button>
    </form>
  );
}
