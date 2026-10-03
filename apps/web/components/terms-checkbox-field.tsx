import Link from "next/link";

/** A plain native checkbox, not a shared/controlled one - it needs to work
 * (and be independently re-checked server-side) inside several separate
 * <form>s without relying on client JS to sync state between them. */
export function TermsCheckboxField({
  prefix,
  linkLabel,
}: {
  prefix: string;
  linkLabel: string;
}) {
  return (
    <label className="flex items-start gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        name="acceptedTerms"
        required
        className="mt-0.5 size-3.5 shrink-0 accent-primary"
      />
      <span>
        {prefix}{" "}
        <Link
          href="/terms"
          target="_blank"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {linkLabel}
        </Link>
      </span>
    </label>
  );
}
