-- CreateTable
CREATE TABLE "RecommendationRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "triggeredBy" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "mood" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationRun_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "RecommendationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RecommendationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RecommendationItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContinuationDetectionLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "showId" INTEGER NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tmdbNewEpisodeAirDate" DATETIME NOT NULL,
    "firstSurfacedAt" DATETIME,
    CONSTRAINT "ContinuationDetectionLog_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passcodeHash" TEXT NOT NULL,
    "recModel" TEXT NOT NULL DEFAULT 'haiku',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "displayName", "id", "passcodeHash", "username") SELECT "createdAt", "displayName", "id", "passcodeHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationVote_itemId_userId_key" ON "RecommendationVote"("itemId", "userId");
