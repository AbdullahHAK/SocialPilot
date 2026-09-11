# Roadmap

SocialPilot is built phase by phase, each phase ending in its own commit with
passing tests. Check off phases as they land.

- [x] 0. Monorepo scaffolding (pnpm workspaces, Next.js web app, worker service, CI)
- [x] 1. Full multi-tenant Prisma schema + migrations + seed
- [x] 2. Auth (signup/login/session) + organization creation + dashboard shell
- [ ] 3. ~~Stripe billing~~ — deferred indefinitely: Stripe doesn't support
      Pakistan-based accounts. Revisit with Paddle/LemonSqueezy later.
- [x] 4. Onboarding wizard / Brand Profile
- [ ] 5. Meta OAuth connect flow (Instagram/Facebook via Facebook Login for Business)
      — code complete (connect/callback routes, token encryption, Connected
      Accounts page), pending a Meta Developer App from the user for live
      end-to-end verification.
- [ ] 6. AI brand analysis job (infers style from existing IG/FB content)
      — OpenAI key now set (see below); not yet built.
- [ ] 7. Creative brief -> AI concept generation -> approval -> Brand Creative Profile
      — OpenAI key now set; not yet built.
- [x] 8. Weekly publishing schedule builder
- [x] Design system + full visual overhaul (real component library, color
      tokens, marketing landing page) — not a numbered phase, but a
      significant unplanned pass across everything built so far.
- [ ] 9. Automated content pipeline worker (idea -> image -> caption/hashtags -> formats)
- [ ] 10. Publishing engine (Graph API publishing, retries, status tracking)
- [ ] 11. Dashboard views (Content Calendar, Scheduled/Published, Accounts, Brand, Schedule, Subscription)
- [ ] 12. Polish (notifications, observability, deployment docs)

## External account dependencies

These are not blocking day-to-day code work, but are slow/manual, so it's worth
starting them early:

1. **Meta Developer App + Business Verification** — needed for real OAuth and
   Graph API publishing. App Review for scopes like `instagram_content_publish`
   can take days to weeks. Required before Phase 5 can go beyond mocked calls.
2. ~~Stripe account~~ — not available for Pakistan-based accounts; billing is
   deferred indefinitely (see Phase 3 above).
3. **OpenAI API key (done 2026-09-11):** set in local `.env`, Vercel, and
   Railway. Not used by any code yet — Phase 6/7 aren't built. Per the
   user, image generation should use `gpt-image-1.5` at `medium` quality.
4. **Object storage (done 2026-09-11):** Cloudflare R2, bucket
   `socialpilot-assets`, public via its r2.dev URL. Used by the Phase 4
   onboarding wizard for logo uploads.
5. **Production hosting (decided 2026-09-11):** Vercel (web app) + Neon
   (pooled Postgres) + Railway (worker service + Redis). Local dev is
   unaffected — it still uses Docker Compose (Postgres + Redis).

## Live environments

- **Web (Vercel)**: https://web-ten-opal-64.vercel.app — project
  `abdullahhaks-projects/web`, root directory `apps/web`.
- **Worker + Redis (Railway)**: project `socialpilot`
  (`b2096130-3719-4e59-bbf8-4c5263f47bc6`), services `worker` and `Redis`.
- **Database**: Neon project, `neondb`. Migrations applied via
  `prisma migrate deploy` against the direct (non-pooled) connection string.
- **Auto-deploy (confirmed working 2026-09-11):** pushes to `main` auto-build
  and deploy both the web app (Vercel, via its GitHub integration) and the
  worker (Railway, via an explicit deployment trigger — Railway's GitHub App
  being merely "authorized" wasn't enough on its own, it also had to be
  *installed* on the repo, and a `deploymentTriggerCreate` mutation was
  needed since `railway add --repo` alone doesn't create one).
