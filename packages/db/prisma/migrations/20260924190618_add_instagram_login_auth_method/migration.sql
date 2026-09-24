-- CreateEnum
CREATE TYPE "SocialAuthMethod" AS ENUM ('FACEBOOK_LOGIN', 'INSTAGRAM_LOGIN');

-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN     "authMethod" "SocialAuthMethod" NOT NULL DEFAULT 'FACEBOOK_LOGIN';
