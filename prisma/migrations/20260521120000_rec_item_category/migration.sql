-- CreateEnum
CREATE TYPE "RecItemCategory" AS ENUM ('new_show', 'new_season', 'continue_watching');

-- CreateEnum
CREATE TYPE "RecFocus" AS ENUM ('mixed', 'discover', 'new_seasons', 'queue');

-- AlterTable
ALTER TABLE "RecommendationRun" ADD COLUMN "focus" "RecFocus";

-- AlterTable: add category, backfill from isContinuation, then drop the boolean.
-- Old runs can't distinguish new_season precisely (no watch state at migrate
-- time) — they map to continue_watching and get regenerated on the next refresh.
ALTER TABLE "RecommendationItem" ADD COLUMN "category" "RecItemCategory" NOT NULL DEFAULT 'new_show';
UPDATE "RecommendationItem" SET "category" = 'continue_watching' WHERE "isContinuation" = true;
ALTER TABLE "RecommendationItem" DROP COLUMN "isContinuation";
