"use client";

import { useTranslations } from "next-intl";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * The fork Meta forces on us: Facebook Login (requires the Instagram
 * account to have a linked Facebook Page) vs. Instagram API with
 * Instagram Login (no Page needed, but only ever connects Instagram - no
 * Facebook Page publishing). These are two different OAuth apps/domains
 * under the hood, so the choice has to be made before either redirect
 * starts - there's no way to begin one flow and fall back to the other
 * mid-authorization. A business with no Facebook Page behind their
 * Instagram was a real dead end before this existed: Facebook Login is
 * the *only* path that can ever connect a Facebook Page, so it stays the
 * first, recommended option for anyone who has one.
 */
export function ConnectMetaDialog({
  trigger,
  triggerLabel,
}: {
  trigger?: React.ReactNode;
  triggerLabel?: string;
}) {
  const t = useTranslations("dashboard.accounts.connectDialog");

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <Button>{triggerLabel ?? t("openButton")}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <a
            href="/api/meta/connect"
            className="flex items-start gap-3 rounded-lg border border-border p-4 text-start transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FacebookIcon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t("withFacebook.title")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("withFacebook.description")}
              </span>
            </span>
          </a>

          <a
            href="/api/instagram/connect"
            className="flex items-start gap-3 rounded-lg border border-border p-4 text-start transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <InstagramIcon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t("instagramOnly.title")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("instagramOnly.description")}
              </span>
            </span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
