-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WatchEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "showId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "currentSeason" INTEGER,
    "currentSeasonCompleted" BOOLEAN NOT NULL DEFAULT false,
    "userRating" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchEntry_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WatchEntry" ("createdAt", "currentSeason", "id", "notes", "showId", "status", "updatedAt", "userId", "userRating") SELECT "createdAt", "currentSeason", "id", "notes", "showId", "status", "updatedAt", "userId", "userRating" FROM "WatchEntry";
DROP TABLE "WatchEntry";
ALTER TABLE "new_WatchEntry" RENAME TO "WatchEntry";
CREATE UNIQUE INDEX "WatchEntry_userId_showId_key" ON "WatchEntry"("userId", "showId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
