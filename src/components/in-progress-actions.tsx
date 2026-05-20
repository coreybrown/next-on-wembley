"use client";

import { useState, useTransition } from "react";
import { CaretLeft, CaretRight, CheckCircle } from "@phosphor-icons/react";
import type { UserRating } from "@prisma/client";
import {
  bumpSeasonAction,
  finishItAction,
  setSeasonCompletedAction,
} from "@/app/actions/in-progress";
import type { WatchEntryWithShow } from "@/app/actions/watch-entries";
import {
  USER_RATINGS,
  RATING_GLYPHS,
  RATING_LABELS,
} from "@/lib/watch-entries";
import {
  parseSeasonsJson,
  releasedSeasonsCount,
} from "@/lib/in-progress";
import { CoWatchToggle } from "@/components/co-watch-toggle";

type Props = {
  entry: WatchEntryWithShow;
  // Phase 42: co-watch state for this show + the partner's name. The
  // toggle is hidden when partnerName is null (single-user setup).
  coWatch: boolean;
  partnerName: string | null;
};

export function InProgressActions({ entry, coWatch, partnerName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = entry.currentSeason ?? 1;
  // Ceiling = highest released season number, not TMDb's
  // `number_of_seasons` (which counts announced-but-unaired seasons).
  const ceiling = releasedSeasonsCount(
    parseSeasonsJson(entry.show.seasonsJson),
    entry.show.totalSeasons,
  );
  const canMinus = current > 1;
  const canPlus = ceiling == null || current < ceiling;

  const bump = (delta: 1 | -1) => {
    setError(null);
    startTransition(async () => {
      const r = await bumpSeasonAction(entry.id, delta);
      if (!r.ok) setError("Couldn’t update season.");
    });
  };

  const toggleSeasonDone = () => {
    setError(null);
    startTransition(async () => {
      const r = await setSeasonCompletedAction(
        entry.id,
        !entry.currentSeasonCompleted,
      );
      if (!r.ok) setError("Couldn’t update season.");
    });
  };

  const finish = (rating: UserRating | null) => {
    setError(null);
    startTransition(async () => {
      const r = await finishItAction(entry.id, rating);
      if (!r.ok) setError("Couldn’t finish.");
      else setShowRatingPrompt(false);
    });
  };

  if (showRatingPrompt) {
    return (
      <div
        role="group"
        aria-label="Quick rating before completing"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="font-mono text-mono uppercase text-ink-muted">
          Quick rating?
        </span>
        {USER_RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => finish(r)}
            disabled={isPending}
            aria-label={`Finished — ${RATING_LABELS[r]}`}
            className="
              inline-flex items-center gap-1
              rounded-md border border-border bg-surface
              px-3 py-1.5
              font-body text-sm text-ink
              transition-colors hover:border-accent hover:text-accent
              disabled:cursor-not-allowed disabled:opacity-50
              focus-visible:outline-2 focus-visible:outline-accent
              focus-visible:outline-offset-2
            "
          >
            <span aria-hidden>{RATING_GLYPHS[r]}</span>
            <span>{RATING_LABELS[r]}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => finish(null)}
          disabled={isPending}
          className="
            font-mono text-mono uppercase text-ink-muted
            underline-offset-2 hover:underline hover:text-ink
            disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => setShowRatingPrompt(false)}
          disabled={isPending}
          className="
            font-mono text-mono uppercase text-ink-muted
            underline-offset-2 hover:underline hover:text-ink
            disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          Cancel
        </button>
        {error && (
          <span role="alert" className="font-mono text-mono text-danger">
            [{error}]
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface">
          <button
            type="button"
            onClick={() => bump(-1)}
            disabled={!canMinus || isPending}
            aria-label="Previous season"
            className="
              inline-flex h-8 w-8 items-center justify-center
              text-ink-secondary
              transition-colors hover:text-accent
              disabled:cursor-not-allowed disabled:opacity-30
              focus-visible:outline-2 focus-visible:outline-accent
              focus-visible:outline-offset-2
            "
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <span
            aria-hidden
            className="px-2 font-mono text-mono uppercase text-ink-secondary"
          >
            S{current}
          </span>
          <button
            type="button"
            onClick={() => bump(1)}
            disabled={!canPlus || isPending}
            aria-label="Next season"
            className="
              inline-flex h-8 w-8 items-center justify-center
              text-ink-secondary
              transition-colors hover:text-accent
              disabled:cursor-not-allowed disabled:opacity-30
              focus-visible:outline-2 focus-visible:outline-accent
              focus-visible:outline-offset-2
            "
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleSeasonDone}
          disabled={isPending}
          aria-pressed={entry.currentSeasonCompleted}
          title={
            entry.currentSeasonCompleted
              ? `Click to mark Season ${current} not finished`
              : `Click to mark Season ${current} complete`
          }
          // Phase 39: the label is the CURRENT STATE, not the action.
          // "Watching S2" / "Completed S2" so the user can read where
          // they are at a glance; clicking flips state. Filled-accent
          // signals which state is the "active marker" right now.
          className={`
            inline-flex items-center gap-2
            rounded-md border px-3 py-1.5
            font-body text-sm
            transition-colors
            disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
            ${
              entry.currentSeasonCompleted
                ? "border-accent bg-accent text-accent-fg hover:opacity-90"
                : "border-border bg-surface text-ink hover:border-accent hover:text-accent"
            }
          `}
        >
          {entry.currentSeasonCompleted
            ? `Completed S${current}`
            : `Watching S${current}`}
        </button>
        <button
          type="button"
          onClick={() => setShowRatingPrompt(true)}
          disabled={isPending}
          className="
            inline-flex items-center gap-2
            rounded-md border border-border bg-surface
            px-3 py-1.5
            font-body text-sm text-ink
            transition-colors hover:border-accent hover:text-accent
            disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          <CheckCircle size={16} weight="regular" aria-hidden />
          <span>Finished it</span>
        </button>
        {error && (
          <span role="alert" className="font-mono text-mono text-danger">
            [{error}]
          </span>
        )}
      </div>
      {partnerName && (
        <CoWatchToggle
          showId={entry.showId}
          coWatch={coWatch}
          partnerName={partnerName}
        />
      )}
    </div>
  );
}
