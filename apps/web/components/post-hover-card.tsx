"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { EditPostDialog } from "@/components/edit-post-dialog";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { EditContentPostResult } from "@/app/dashboard/calendar/actions";

const STATUS_BADGE_VARIANT = {
  DRAFT: "secondary",
  QUEUED: "secondary",
  SCHEDULED: "default",
  PUBLISHED: "success",
  FAILED: "destructive",
} as const;

export interface CalendarPost {
  id: string;
  platform: "INSTAGRAM" | "FACEBOOK";
  status: "DRAFT" | "QUEUED" | "SCHEDULED" | "PUBLISHED" | "FAILED";
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
  editAction: (formData: FormData) => Promise<EditContentPostResult>;
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
    formData.set("postId", post.id);
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
            // eslint-disable-next-line @next/next/no-img-element -- remote
            // generated image, same pattern used elsewhere in the dashboard.
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
            postId={post.id}
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
