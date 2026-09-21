-- CreateEnum
CREATE TYPE "PublishMode" AS ENUM ('POST_AND_STORY', 'STORY_ONLY', 'POST_ONLY');

-- AlterTable
ALTER TABLE "publishing_schedules" ADD COLUMN     "includeCaption" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publishMode" "PublishMode" NOT NULL DEFAULT 'POST_AND_STORY';

-- AlterTable
ALTER TABLE "content_jobs" ADD COLUMN     "imagesDeletedAt" TIMESTAMP(3);
