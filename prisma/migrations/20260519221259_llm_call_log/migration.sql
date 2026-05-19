-- Per-call Anthropic spend log so we can enforce the PRD §10 monthly
-- budget cap and warn at 75%.

CREATE TABLE "LlmCallLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "LlmCallLog_createdAt_idx" ON "LlmCallLog"("createdAt");
