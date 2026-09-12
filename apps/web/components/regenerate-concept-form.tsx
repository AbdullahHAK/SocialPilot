"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import type { RegenerateConceptFormState } from "@/app/dashboard/create/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type RegenerateConceptAction = (
  state: RegenerateConceptFormState,
  formData: FormData,
) => Promise<RegenerateConceptFormState>;

export function RegenerateConceptForm({
  action,
  conceptId,
}: {
  action: RegenerateConceptAction;
  conceptId: string;
}) {
  const [state, formAction, isPending] = useActionState<
    RegenerateConceptFormState,
    FormData
  >(action, {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <input type="hidden" name="conceptId" value={conceptId} />
      <Label htmlFor="feedback">Not quite right? Describe what to change</Label>
      <Textarea
        id="feedback"
        name="feedback"
        rows={3}
        placeholder="e.g. Make the background darker, make the chicken larger, use more of our brand colors."
        className="resize-none"
      />
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={isPending}
        className="w-fit gap-2"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {isPending ? "Regenerating…" : "Regenerate with changes"}
      </Button>
    </form>
  );
}
