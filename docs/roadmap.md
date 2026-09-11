# Roadmap

SocialPilot is built phase by phase, each phase ending in its own commit with
passing tests. Check off phases as they land.

- [x] 0. Monorepo scaffolding (pnpm workspaces, Next.js web app, worker service, CI)
- [x] 1. Full multi-tenant Prisma schema + migrations + seed
- [x] 2. Auth (signup/login/session) + organization creation + dashboard shell
- [ ] 3. Stripe billing (Checkout, webhooks, customer portal, plan gating)
- [ ] 4. Onboarding wizard / Brand Profile
- [ ] 5. Meta OAuth connect flow (Instagram/Facebook via Facebook Login for Business)
- [ ] 6. AI brand analysis job (infers style from existing IG/FB content)
- [ ] 7. Creative brief -> AI concept generation -> approval -> Brand Creative Profile
- [ ] 8. Weekly publishing schedule builder
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
2. **Stripe account** — test-mode keys are enough to build Phase 3.
3. **OpenAI API key** — only needed once Phase 6 (AI brand analysis) starts.
4. **Object storage** (e.g. Cloudflare R2 or AWS S3) — needed from Phase 4
   onward for logos and generated images.
5. **Production hosting (decided 2026-09-11):** Vercel (web app) + Neon
   (pooled Postgres) + Railway (worker service + Redis). Local dev is
   unaffected — it still uses Docker Compose (Postgres + Redis).

## Live environments

- **Web (Vercel)**: https://web-ten-opal-64.vercel.app — project
  `abdullahhaks-projects/web`, root directory `apps/web`. Deployed via
  `vercel deploy --prod` from the repo root (CLI-driven, not git-triggered
  yet — see below).
- **Worker + Redis (Railway)**: project `socialpilot`
  (`b2096130-3719-4e59-bbf8-4c5263f47bc6`), services `worker` and `Redis`.
  Deployed via `railway up --service worker` (also CLI-driven for now).
- **Database**: Neon project, `neondb`. Migrations applied via
  `prisma migrate deploy` against the direct (non-pooled) connection string.
- **Auto-deploy (as of 2026-09-11):** both platforms' GitHub Apps are
  authorized for `AbdullahHAK/SocialPilot` and connected — pushes to `main`
  now auto-build and deploy the web app (Vercel) and the worker (Railway).
  No more CLI-driven manual deploys needed for routine changes.
