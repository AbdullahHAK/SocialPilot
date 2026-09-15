"use client";

import { Download, Loader2, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState, useTransition } from "react";
import { EditPostDialog } from "@/components/edit-post-dialog";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { EditContentJobResult } from "@/app/dashboard/calendar/actions";

/**
 * Hovering the thumbnail reveals the same image full-size, centered over
 * everything, with a download button. This needs real hover-tracking
 * state (not pure CSS :hover/group-hover) because the enlarged preview is
 * centered on the whole screen, detached from the small thumbnail - the
 * cursor has to cross page content that's neither element to get from one
 * to the other, which would otherwise close it before ever reaching the
 * download button. A short grace period on close (cancelled if the cursor
 * lands back on either the thumbnail or the enlarged image) bridges that
 * gap, same pattern used by most hover-triggered flyout menus.
 */
function ImageZoomPreview({ imageUrl }: { imageUrl: string }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openNow() {
    cancelClose();
    setOpen(true);
  }

  function closeSoon() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 300);
  }

  return (
    <div className="shrink-0" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      {/* Remote generated image, same pattern used elsewhere in the dashboard. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="size-16 shrink-0 cursor-zoom-in rounded-md object-cover"
      />

      {/* Purely decorative dimmed backdrop - always pointer-events-none so
          it can never block/steal hover from whatever's underneath, even
          while "open" (the real hover target is the inner box below). */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/70 opacity-0 transition-opacity duration-150",
          open && "opacity-100",
        )}
      >
        <div
          className={cn("pointer-events-none relative", open && "pointer-events-auto")}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
          />
          <a
            href={`/api/download-image?url=${encodeURIComponent(imageUrl)}`}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-lg backdrop-blur-sm transition-colors hover:bg-white"
          >
            <Download className="size-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

// A card's status is derived (in calendar/page.tsx) from its ContentJob and
// ContentPublication together, not read off a single field - GENERATING
// and SCHEDULED both mean "not published yet" but distinguish whether the
// shared creative exists yet at all.
export const STATUS_BADGE_VARIANT = {
  GENERATING: "secondary",
  SCHEDULED: "default",
  PUBLISHING: "default",
  PUBLISHED: "success",
  FAILED: "destructive",
  RETRYING: "outline",
  CANCELLED: "secondary",
} as const;

export type CalendarPostStatus = keyof typeof STATUS_BADGE_VARIANT;

export interface CalendarPost {
  jobId: string;
  platform: "INSTAGRAM" | "FACEBOOK";
  status: CalendarPostStatus;
  caption: string | null;
  imageUrls: string[];
  scheduledFor: string;
}

export function PostHoverCard({
  post,
  editAction,
  deleteAction,
  children,
}: {
  post: CalendarPost;
  editAction: (formData: FormData) => Promise<EditContentJobResult>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const formattedTime = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(post.scheduledFor));

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const formData = new FormData();
    formData.set("jobId", post.jobId);
    formData.set("platform", post.platform);
    startTransition(async () => {
      await deleteAction(formData);
    });
  }

  return (
    <HoverCard onOpenChange={(open) => !open && setConfirmingDelete(false)}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent>
        <div className="flex gap-3">
          {post.imageUrls[0] && <ImageZoomPreview imageUrl={post.imageUrls[0]} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {post.platform === "INSTAGRAM" ? (
                <InstagramIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FacebookIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <Badge variant={STATUS_BADGE_VARIANT[post.status]} className="text-[10px]">
                {post.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formattedTime}</p>
          </div>
        </div>

        <p className="mt-3 max-h-24 overflow-y-auto text-sm whitespace-pre-wrap">
          {post.caption || "(no caption)"}
        </p>

        <div className="mt-3 flex justify-end gap-1.5 border-t border-border pt-3">
          <EditPostDialog
            jobId={post.jobId}
            caption={post.caption ?? ""}
            scheduledForIso={post.scheduledFor}
            status={post.status}
            platform={post.platform}
            action={editAction}
            trigger={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            }
          />
          <Button
            type="button"
            variant={confirmingDelete ? "destructive" : "outline"}
            size="sm"
            onClick={handleDeleteClick}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            {confirmingDelete ? "Confirm delete?" : "Delete"}
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
