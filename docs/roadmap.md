# Roadmap

SocialPilot is built phase by phase, each phase ending in its own commit with
passing tests. Check off phases as they land.

- [x] 0. Monorepo scaffolding (pnpm workspaces, Next.js web app, worker service, CI)
- [x] 1. Full multi-tenant Prisma schema + migrations + seed
- [x] 2. Auth (signup/login/session) + organization creation + dashboard shell
      — superseded 2026-09-12 by the funnel reorder below; account creation
      now happens later in the flow, not at the start.
- [ ] 3. Stripe billing — un-deferred 2026-09-11 (client will hold the
      Stripe account). Checkout, webhook handler, customer portal, and the
      Pricing page are built with placeholder $49/mo and $470/yr plans;
      pending a real Stripe secret key + price IDs to test live. **Blocker
      found 2026-09-12**: the client is Morocco-based, which is also not on
      Stripe's supported-country list as far as we can tell — waiting to
      hear whether the client's own Stripe signup goes through; if not,
      the fallback is switching to a Merchant-of-Record processor (Paddle
      or Lemon Squeezy), which is a contained code change since all Stripe
      logic is isolated in `lib/stripe.ts` + the webhook route.
- [x] 4. Onboarding wizard / Brand Profile
- [ ] 5. Meta OAuth connect flow (Instagram/Facebook via Facebook Login for
      Business) — code complete (connect/callback routes, token encryption,
      Connected Accounts page). Reached a real Facebook OAuth dialog with
      the correct app id/redirect/scopes on 2026-09-12 after fixing missing
      Page/Instagram permissions in the Meta app dashboard (`pages_manage_posts`,
      `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
      needed to be explicitly added under Permissions and Features). Still
      pending the user completing a real Facebook login/consent to confirm
      a SocialAccount row gets created end-to-end.
- [x] 6/7. Creative brief -> AI concept generation -> approval -> Brand
      Creative Profile (2026-09-12) — built as the client's requested
      "Create Content" experience instead of the original plan's
      analyze-existing-IG-content approach: a simple prompt box with
      ready-made template buttons and optional reference image upload,
      generating 3 real `gpt-image-1.5` concepts per request, with an
      approval page that sets the org's `BrandCreativeProfile`.
- [x] 8. Weekly publishing schedule builder
- [x] Design system + full visual overhaul (real component library, color
      tokens, marketing landing page) — not a numbered phase, but a
      significant unplanned pass across everything built so far.
- [x] Funnel reorder (2026-09-12) — client wants payment and Meta connect
      to happen *before* account creation: Landing -> Pricing -> Stripe
      Checkout -> Connect Instagram/Facebook -> Create Account ->
      Onboarding. Implemented via a short-lived signed "pending signup"
      cookie (`lib/pending-signup.ts`) carrying the chosen plan, Stripe
      customer/subscription IDs, and connected Meta pages (tokens
      encrypted) until `/create-account` commits everything atomically.
      Verified end-to-end except the Stripe leg itself (see Phase 3).
- [x] 9. Automated content pipeline worker (2026-09-12) — "Generate this
      month's content" expands the publishing schedule into upcoming send
      times and generates an on-brand image + AI caption (`gpt-4o-mini`)
      for each, scheduling them as `ContentPost` rows that show up on the
      existing Content Calendar.
- [x] 10. Publishing engine (2026-09-12) — the worker polls every 60s for
      due posts and publishes for real via the Meta Graph API (Instagram's
      container-create-then-publish flow, Facebook's page photo endpoint),
      marking each post PUBLISHED or FAILED. Covered by unit tests
      (success, missing-account failure, mixed batch) against a real
      Postgres with mocked Graph API responses; a live publish to a real
      connected account is still unverified pending Phase 5's real Meta
      login.
- [x] 11. Dashboard views — Content Calendar, Brand Settings, Subscription,
      Connected Accounts, plus the new Create Content and Brand Style pages
      from Phase 6/7 above.
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
   confirmation to keep the $49/mo, $470/yr placeholders. **2026-09-12**:
   the client is Morocco-based, also apparently not Stripe-supported —
   asked them to try signing up directly to confirm; if blocked, plan is
   to switch to Paddle or Lemon Squeezy (Merchant of Record, no Stripe
   eligibility needed, payouts work via bank/Payoneer from Morocco).
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
- **Worker env vars (2026-09-12):** the worker needed `TOKEN_ENCRYPTION_KEY`
  added (same value as the web app's, in Vercel) once it started decrypting
  stored Meta access tokens to publish — `DATABASE_URL`, `DIRECT_URL`,
  `OPENAI_API_KEY`, and `REDIS_URL` were already set.
