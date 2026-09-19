"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { AddBusinessFormState } from "@/app/dashboard/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddBusinessForm({
  action,
}: {
  action: (state: AddBusinessFormState, formData: FormData) => Promise<AddBusinessFormState>;
}) {
  const t = useTranslations("dashboard.addBusiness");
  const [state, formAction, isPending] = useActionState<AddBusinessFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessName">{t("businessName")}</Label>
        <Input id="businessName" name="businessName" placeholder={t("businessNamePlaceholder")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activationCode">{t("activationCode")}</Label>
        <Input id="activationCode" name="activationCode" placeholder={t("activationCodePlaceholder")} />
        <p className="text-xs text-muted-foreground">{t("activationCodeHint")}</p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
