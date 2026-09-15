import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { getMetaPageChoice } from "@/lib/meta-page-choice";
import { getSession } from "@/lib/session";
import { chooseMetaPageAction } from "./actions";

export default async function ChoosePagePage() {
  const [session, choice] = await Promise.all([
    getSession(),
    getMetaPageChoice(),
  ]);
  if (!choice) {
    redirect(session ? "/dashboard/accounts" : "/connect");
  }
  const t = await getTranslations("connect.choosePage");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
      >
        <div className="aspect-1155/678 w-[60rem] bg-gradient-to-tr from-primary/25 via-primary/10 to-transparent opacity-40" />
      </div>

      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>

      <Link href="/" className="mb-8">
        <Logo />
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>
            {t("description", { count: choice.choices.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {choice.choices.map((page) => (
            <form key={page.id} action={chooseMetaPageAction}>
              <input type="hidden" name="pageId" value={page.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-start text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <span className="flex items-center gap-2.5">
                  <FacebookIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{page.name}</span>
                </span>
                {page.hasInstagram && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    <InstagramIcon className="size-3" />
                    <CheckCircle2 className="size-3" />
                  </span>
                )}
              </button>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
