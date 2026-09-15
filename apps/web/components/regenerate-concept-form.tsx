"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  returnTo,
}: {
  action: RegenerateConceptAction;
  conceptId: string;
  returnTo?: string;
}) {
  const t = useTranslations("dashboard.regenerateForm");
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
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <Label htmlFor="feedback">{t("label")}</Label>
      <Textarea
        id="feedback"
        name="feedback"
        rows={3}
        placeholder={t("placeholder")}
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
        {isPending ? t("regenerating") : t("regenerate")}
      </Button>
    </form>
  );
}
