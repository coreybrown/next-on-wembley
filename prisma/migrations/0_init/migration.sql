-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('want_to_watch', 'watching', 'paused', 'completed', 'dropped');

-- CreateEnum
CREATE TYPE "UserRating" AS ENUM ('like', 'dislike', 'meh');

-- CreateEnum
CREATE TYPE "RecModel" AS ENUM ('haiku', 'sonnet');

-- CreateEnum
CREATE TYPE "RecScope" AS ENUM ('co_watch', 'corey', 'jaimie');

-- CreateEnum
CREATE TYPE "RecRunStatus" AS ENUM ('ok', 'failed');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('agree', 'disagree', 'maybe');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passcodeHash" TEXT NOT NULL,
    "recModel" "RecModel" NOT NULL DEFAULT 'haiku',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "platformKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" SERIAL NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "posterUrl" TEXT,
    "genres" TEXT,
    "totalSeasons" INTEGER,
    "totalEpisodes" INTEGER,
    "seasonsJson" TEXT,
    "tmdbRating" DOUBLE PRECISION,
    "trailerUrl" TEXT,
    "productionStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowProvider" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "platformKey" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'CA',
    "monetizationType" TEXT NOT NULL DEFAULT 'flatrate',

    CONSTRAINT "ShowProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "showId" INTEGER NOT NULL,
    "status" "WatchStatus" NOT NULL,
    "currentSeason" INTEGER,
    "currentSeasonCompleted" BOOLEAN NOT NULL DEFAULT false,
    "userRating" "UserRating",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationRun" (
    "id" SERIAL NOT NULL,
    "triggeredBy" INTEGER NOT NULL,
    "scope" "RecScope" NOT NULL,
    "modelId" TEXT NOT NULL,
    "mood" TEXT,
    "status" "RecRunStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "showId" INTEGER,
    "title" TEXT NOT NULL,
    "year" TEXT,
    "posterUrl" TEXT,
    "shortExplanation" TEXT NOT NULL,
    "longExplanation" TEXT NOT NULL,
    "isContinuation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecommendationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoWatch" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowVote" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "vote" "VoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCallLog" (
    "id" SERIAL NOT NULL,
    "modelId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuationDetectionLog" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tmdbNewEpisodeAirDate" TIMESTAMP(3) NOT NULL,
    "firstSurfacedAt" TIMESTAMP(3),

    CONSTRAINT "ContinuationDetectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_platformKey_key" ON "UserSubscription"("userId", "platformKey");

-- CreateIndex
CREATE UNIQUE INDEX "Show_tmdbId_key" ON "Show"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowProvider_showId_platformKey_region_monetizationType_key" ON "ShowProvider"("showId", "platformKey", "region", "monetizationType");

-- CreateIndex
CREATE UNIQUE INDEX "WatchEntry_userId_showId_key" ON "WatchEntry"("userId", "showId");

-- CreateIndex
CREATE UNIQUE INDEX "CoWatch_showId_key" ON "CoWatch"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowVote_showId_userId_key" ON "ShowVote"("showId", "userId");

-- CreateIndex
CREATE INDEX "LlmCallLog_createdAt_idx" ON "LlmCallLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowProvider" ADD CONSTRAINT "ShowProvider_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchEntry" ADD CONSTRAINT "WatchEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchEntry" ADD CONSTRAINT "WatchEntry_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationRun" ADD CONSTRAINT "RecommendationRun_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoWatch" ADD CONSTRAINT "CoWatch_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowVote" ADD CONSTRAINT "ShowVote_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowVote" ADD CONSTRAINT "ShowVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuationDetectionLog" ADD CONSTRAINT "ContinuationDetectionLog_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

