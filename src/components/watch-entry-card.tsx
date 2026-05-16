"use client";

import { PencilSimple } from "@phosphor-icons/react";
import type { WatchEntryWithShow } from "@/app/actions/watch-entries";
import {
  STATUS_LABELS,
  RATING_LABELS,
  RATING_GLYPHS,
} from "@/lib/watch-entries";
import { InProgressActions } from "@/components/in-progress-actions";

const STATUS_PILL_COLOR: Record<string, string> = {
  want_to_watch: "bg-status-want",
  watching: "bg-status-watching",
  paused: "bg-status-paused",
  completed: "bg-status-completed",
  dropped: "bg-status-dropped",
};

type Props = {
  entry: WatchEntryWithShow;
  onEdit: () => void;
};

export function WatchEntryCard({ entry, onEdit }: Props) {
  const { show, status, currentSeason, userRating } = entry;
  const isInProgress = status === "watching" || status === "paused";
  return (
    <article
      className="
        group flex items-start gap-4
        rounded-md border border-border bg-surface-elevated
        px-4 py-3
        transition-colors hover:border-border-strong
      "
    >
      {show.posterUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={show.posterUrl}
          alt=""
          width={48}
          height={72}
          className="h-[72px] w-12 flex-shrink-0 rounded-sm bg-surface-overlay object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="h-[72px] w-12 flex-shrink-0 rounded-sm bg-surface-overlay"
        />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold text-ink truncate">
          {show.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`
              inline-flex items-center rounded-pill
              px-2 py-0.5
              font-mono text-mono uppercase tracking-wide
              text-accent-fg
              ${STATUS_PILL_COLOR[status] ?? "bg-status-want"}
            `}
          >
            {STATUS_LABELS[status]}
          </span>
          {currentSeason != null && (
            <span className="font-mono text-mono uppercase text-ink-muted">
              Season {currentSeason}
            </span>
          )}
          {userRating && (
            <span
              className="
                inline-flex items-center gap-1 rounded-pill
                border border-border bg-surface
                px-2 py-0.5
                font-mono text-mono uppercase tracking-wide text-ink-secondary
              "
            >
              <span aria-hidden>{RATING_GLYPHS[userRating]}</span>
              <span>{RATING_LABELS[userRating]}</span>
            </span>
          )}
        </div>
        {isInProgress && (
          <div className="mt-3">
            <InProgressActions entry={entry} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${show.title}`}
        className="
          inline-flex h-9 w-9 flex-shrink-0 items-center justify-center
          rounded-sm border border-border bg-surface
          text-ink-secondary
          transition-colors hover:border-accent hover:text-accent
          focus-visible:outline-2 focus-visible:outline-accent-sharp
          focus-visible:outline-offset-2
        "
      >
        <PencilSimple size={16} weight="regular" />
      </button>
    </article>
  );
}
