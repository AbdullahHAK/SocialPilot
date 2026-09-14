-- CreateEnum
CREATE TYPE "ContentJobStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContentJobOrigin" AS ENUM ('SLOT', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "ContentPublicationStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "content_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "platforms" "Platform"[],
    "origin" "ContentJobOrigin" NOT NULL DEFAULT 'SLOT',
    "status" "ContentJobStatus" NOT NULL DEFAULT 'PENDING',
    "caption" TEXT,
    "hashtags" TEXT[],
    "masterImageUrl" TEXT,
    "storyImageUrl" TEXT,
    "creativeMetadata" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_publications" (
    "id" TEXT NOT NULL,
    "contentJobId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "ContentPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "externalPostId" TEXT,
    "externalStoryId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_jobs_organizationId_idx" ON "content_jobs"("organizationId");

-- CreateIndex
CREATE INDEX "content_jobs_status_idx" ON "content_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "content_jobs_organizationId_scheduledFor_key" ON "content_jobs"("organizationId", "scheduledFor");

-- CreateIndex
CREATE INDEX "content_publications_status_idx" ON "content_publications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "content_publications_contentJobId_platform_key" ON "content_publications"("contentJobId", "platform");

-- AddForeignKey
ALTER TABLE "content_jobs" ADD CONSTRAINT "content_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_publications" ADD CONSTRAINT "content_publications_contentJobId_fkey" FOREIGN KEY ("contentJobId") REFERENCES "content_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
