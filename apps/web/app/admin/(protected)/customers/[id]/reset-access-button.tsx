"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetAccessAction, type ResetAccessState } from "./actions";

export function ResetAccessButton({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const [state, formAction, isPending] = useActionState<ResetAccessState, FormData>(
    (prev) => resetAccessAction(organizationId, userId, prev),
    {},
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          Reset access
        </Button>
      </form>
      {state.temporaryPassword && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
          New temporary password (shown once - copy it now):{" "}
          <code className="font-mono font-semibold">{state.temporaryPassword}</code>
        </p>
      )}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
