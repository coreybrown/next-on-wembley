-- Migrate from per-item votes to per-(user, show) votes.
-- Votes are semantically about the show, not the ephemeral rec item, so
-- they should survive RecommendationRun refreshes.

CREATE TABLE "ShowVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "showId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowVote_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShowVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ShowVote_showId_userId_key" ON "ShowVote"("showId", "userId");

-- Carry forward existing votes: dedupe (showId, userId) by keeping the
-- most recent vote per pair. Skips orphan votes whose item lost its
-- show row.
INSERT INTO "ShowVote" ("showId", "userId", "vote", "createdAt")
SELECT ri."showId", rv."userId", rv."vote", MAX(rv."createdAt")
FROM "RecommendationVote" rv
JOIN "RecommendationItem" ri ON rv."itemId" = ri."id"
WHERE ri."showId" IS NOT NULL
GROUP BY ri."showId", rv."userId";

DROP TABLE "RecommendationVote";
