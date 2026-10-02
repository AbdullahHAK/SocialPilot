"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Hand-drawn (not a brand asset) stroke icon in lucide's own visual style,
 * since lucide-react dropped brand/logo icons - used purely to signal
 * "this links to Instagram," not as a reproduction of Instagram's mark. */
export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

interface ShowcaseLightboxItemProps {
  image: string;
  alt: string;
  instagramUrl: string;
  business: string;
  businessType: string;
  viewOnInstagramLabel: string;
  children: ReactNode;
}

/** Click a thumbnail to see it large in place first (the "see them big"
 * ask), then a clear, separate step to actually leave the site for the real
 * Instagram post - two small decisions instead of one surprise navigation,
 * and the in-page enlarge also doubles as the proof moment: a skeptical
 * visitor can inspect the image closely before deciding to verify it on
 * Instagram itself. */
export function ShowcaseLightboxItem({
  image,
  alt,
  instagramUrl,
  business,
  businessType,
  viewOnInstagramLabel,
  children,
}: ShowcaseLightboxItemProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {children}
      </button>

      {open &&
        createPortal(
          // Portaled to <body> rather than rendered in place - a
          // translate/transition ancestor (Reveal, here) establishes a
          // containing block for `position: fixed` descendants, which would
          // otherwise confine this overlay to that card instead of the
          // viewport.
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-background shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              >
                <X className="size-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={alt} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{business}</p>
                  <p className="text-sm text-muted-foreground">{businessType}</p>
                </div>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105"
                >
                  <InstagramGlyph className="size-4" />
                  {viewOnInstagramLabel}
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
