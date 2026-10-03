-- CreateTable
CREATE TABLE "terms_acceptances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terms_acceptances_organizationId_idx" ON "terms_acceptances"("organizationId");
