"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { EditPostDialog } from "@/components/edit-post-dialog";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { EditContentJobResult } from "@/app/dashboard/calendar/actions";

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
          {post.imageUrls[0] && (
            // Remote generated image, same pattern used elsewhere in the dashboard.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.imageUrls[0]}
              alt=""
              className="size-16 shrink-0 rounded-md object-cover"
            />
          )}
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
