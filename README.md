# SocialPilot

AI-powered, multi-tenant SaaS that automatically generates and publishes
Instagram/Facebook content on a schedule, on-brand, with minimal customer
involvement after initial setup. See [docs/roadmap.md](docs/roadmap.md) for the
build plan and current progress.

## Stack

- **apps/web** — Next.js (App Router, TypeScript, Tailwind) — dashboard, API routes
- **apps/worker** — Node.js service (BullMQ) — scheduling and publishing jobs
- **packages/db** — Prisma schema + client, shared by web and worker
- **packages/config** — shared TypeScript/ESLint config

## Getting started

```bash
cp .env.example .env      # fill in values as needed for the phase you're on
docker compose up -d      # Postgres + Redis
pnpm install
pnpm db:migrate           # applies Prisma migrations (once schema exists)
pnpm dev                  # runs apps/web
pnpm dev:worker           # runs apps/worker, in a separate terminal
```

## Common scripts

- `pnpm lint` / `pnpm typecheck` / `pnpm test` — run across all workspaces
- `pnpm build` — build all apps
- `pnpm db:generate` — regenerate the Prisma client after a schema change
