import { cn } from "@/lib/utils";

// The supplied logo.png is a square app-icon/profile-picture style lockup
// (icon + wordmark + tagline + social icons all baked into one image) -
// right for a favicon, too busy shrunk into a compact navbar. The navbar
// mark is a styled text wordmark instead, in the same gold/blue language.
export function Logo({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-navy text-base font-bold text-primary-foreground">
        Y
      </span>
      {!iconOnly && (
        <span className="text-lg font-bold tracking-tight">
          YO
          <span className="text-gold">PAPI</span>
        </span>
      )}
    </span>
  );
}
