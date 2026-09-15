-- CreateEnum
CREATE TYPE "ConceptKind" AS ENUM ('BRAND_STYLE', 'LOGO');

-- AlterTable
ALTER TABLE "content_jobs" ADD COLUMN     "generatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "creative_concepts" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "kind" "ConceptKind" NOT NULL DEFAULT 'BRAND_STYLE';
