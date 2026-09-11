# Roadmap

SocialPilot is built phase by phase, each phase ending in its own commit with
passing tests. Check off phases as they land.

- [x] 0. Monorepo scaffolding (pnpm workspaces, Next.js web app, worker service, CI)
- [x] 1. Full multi-tenant Prisma schema + migrations + seed
- [x] 2. Auth (signup/login/session) + organization creation + dashboard shell
- [ ] 3. Stripe billing — un-deferred 2026-09-11 (client will hold the
      Stripe account). Checkout, webhook handler, customer portal, and the
      Subscription page are built with placeholder $49/mo and $470/yr
      plans; pending a real Stripe secret key + price IDs to test live.
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
- [x] 11. Dashboard views — Content Calendar (real month grid, empty until
      Phase 9/10 populate it), Brand Settings (edit the Phase 4 profile),
      and Subscription (see Phase 3) all built ahead of schedule since none
      of them need Meta. Scheduled/Published are just calendar filters once
      there's real data; Connected Accounts was already done in Phase 5.
- [ ] 12. Polish (notifications, observability, deployment docs)

## External account dependencies

These are not blocking day-to-day code work, but are slow/manual, so it's worth
starting them early:

1. **Meta Developer App + Business Verification** — needed for real OAuth and
   Graph API publishing. App Review for scopes like `instagram_content_publish`
   can take days to weeks. Required before Phase 5 can go beyond mocked calls.
2. **Stripe account** — the client will hold this one (not available for
   Pakistan-based accounts, which is why it was deferred until now). Need a
   Secret Key, Webhook Signing Secret, and either two Price IDs or just
   confirmation to keep the $49/mo, $470/yr placeholders.
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
