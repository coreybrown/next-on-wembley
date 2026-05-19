-- Persist TMDb's plot summary so the Show Detail page can render it
-- alongside Claude's rec reasoning. Existing rows remain NULL until
-- their next metadata sync.

ALTER TABLE "Show" ADD COLUMN "overview" TEXT;
