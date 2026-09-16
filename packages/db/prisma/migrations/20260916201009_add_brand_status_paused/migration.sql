-- This schema is shared with the `yopapi` branch against the same
-- production database - that branch's own migrations already created
-- these exact objects there. Every statement below is written to be safe
-- to run whether or not that's already happened (a fresh database, e.g.
-- local dev or CI, needs all of it; the shared production database needs
-- none of it but must not error).

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "OrgBrand" AS ENUM ('SOCIALPILOT', 'YOPAPI');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "brand" "OrgBrand" NOT NULL DEFAULT 'SOCIALPILOT';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';
