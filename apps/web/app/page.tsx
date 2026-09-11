import {
  CalendarClock,
  Image as ImageIcon,
  Link2,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons/social";
import { Logo } from "@/components/logo";

const FEATURES = [
  {
    icon: ImageIcon,
    title: "AI-generated content",
    description:
      "On-brand images, captions, and hashtags generated automatically for every post — no prompting required once your style is set.",
  },
  {
    icon: CalendarClock,
    title: "Runs on your schedule",
    description:
      "Set the days, times, and platforms you want to publish. SocialPilot handles the rest, week after week.",
  },
  {
    icon: Palette,
    title: "Learns your brand",
    description:
      "SocialPilot analyzes your existing content and approved creative direction to keep every post visually consistent.",
  },
  {
    icon: InstagramIcon,
    title: "Instagram & Facebook",
    description:
      "Publishes native Posts and Stories directly through Meta's official APIs — formatted correctly for each platform.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    description:
      "Connect accounts with Meta OAuth. We never ask for — or see — your Instagram or Facebook password.",
  },
  {
    icon: Sparkles,
    title: "Built for teams",
    description:
      "Every account is fully isolated. Manage one brand or many, each with its own schedule, style, and connected accounts.",
  },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Tell us about your business",
    description:
      "Brand name, category, colors, logo, products, and tone — set up once during onboarding.",
  },
  {
    number: "02",
    title: "Connect Instagram & Facebook",
    description:
      "Securely link your accounts through Meta's official login. No passwords, ever.",
  },
  {
    number: "03",
    title: "Approve your creative style",
    description:
      "Describe what you want, review AI-generated concepts, and approve the direction that fits your brand.",
  },
  {
    number: "04",
    title: "Set your schedule and go",
    description:
      "Pick your days and times. SocialPilot generates and publishes content automatically from there.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
          >
            <div className="aspect-1155/678 w-[72rem] bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent opacity-40" />
          </div>

          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:items-center lg:py-32">
            <div className="flex flex-col items-start gap-6">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <Sparkles className="size-3.5 text-primary" />
                AI-powered social media management
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Your social media, run by AI —{" "}
                <span className="text-primary">on autopilot</span>.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground text-pretty">
                SocialPilot connects your Instagram and Facebook, learns your
                brand&apos;s visual style, and automatically creates and
                publishes on-brand content — every week, without you lifting
                a finger.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signup">Get started free</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                No credit card required to set up your brand and schedule.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 to-transparent blur-2xl" />
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                  <span className="size-2.5 rounded-full bg-destructive/60" />
                  <span className="size-2.5 rounded-full bg-yellow-500/60" />
                  <span className="size-2.5 rounded-full bg-success/60" />
                  <span className="ml-3 text-xs font-medium text-muted-foreground">
                    This week&apos;s schedule
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-border">
                  {[
                    { day: "Monday", time: "9:00 AM", platform: "Instagram" },
                    { day: "Wednesday", time: "5:30 PM", platform: "Facebook" },
                    { day: "Friday", time: "11:00 AM", platform: "Instagram" },
                  ].map((row) => (
                    <div
                      key={row.day}
                      className="flex items-center justify-between px-4 py-3.5 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <ImageIcon className="size-4" />
                        </span>
                        <div>
                          <p className="font-medium">{row.day}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.time}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{row.platform}</Badge>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Sparkles className="size-4" />
                      </span>
                      <p className="text-muted-foreground">
                        AI generates content automatically
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Set it up once. It runs every week.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Four steps between you and a fully automated content
                pipeline.
              </p>
            </div>

            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.number} className="flex flex-col gap-3">
                  <span className="text-sm font-semibold text-primary">
                    {step.number}
                  </span>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need, nothing you have to manage
            </h2>
            <p className="mt-4 text-muted-foreground">
              SocialPilot replaces the busywork of running social media with
              a system that just works in the background.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-col items-center gap-6 rounded-2xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16">
              <Link2 className="size-8" />
              <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance">
                Connect your accounts and let SocialPilot take it from here.
              </h2>
              <Button asChild size="lg" variant="secondary">
                <Link href="/signup">Get started free</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SocialPilot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
