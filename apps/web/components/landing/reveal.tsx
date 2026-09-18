"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fades + slides a section in the first time it scrolls into view - the
 * "feels alive" touch on an otherwise static marketing page. Vertical-only
 * motion (never left/right) so it needs no RTL-specific mirroring for
 * Arabic. Starts invisible so this only affects below-the-fold content a
 * visitor can't see yet anyway; layout.tsx's <noscript> override makes sure
 * a no-JS visitor (or a crawler that skips JS) still sees everything,
 * since this being a client component means its initial state is also
 * what gets server-rendered. */
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  /** Renders as this element instead of a div - needed so wrapping a
   * <li> (e.g. inside an <ol>) doesn't insert an invalid <div> between
   * the list and its item. */
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Deferred rather than called synchronously in the effect body, per
      // react-hooks/set-state-in-effect - this is an immediate "skip the
      // animation" bailout, not a render loop.
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn(
        "reveal transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
