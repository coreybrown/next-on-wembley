"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { CaretLeft, CaretRight, Trash } from "@phosphor-icons/react";
import type { WatchStatus, UserRating } from "@prisma/client";
import {
  addWatchEntry,
  updateWatchEntry,
  deleteWatchEntry,
} from "@/app/actions/watch-entries";
import {
  WATCH_STATUSES,
  STATUS_LABELS,
  RATING_LABELS,
  RATING_GLYPHS,
  USER_RATINGS,
} from "@/lib/watch-entries";
import { WATCH_ENTRY_ERROR_COPY } from "@/lib/action-errors";
import { CoWatchToggle } from "@/components/co-watch-toggle";

type Entry = {
  id: number;
  status: WatchStatus;
  currentSeason: number | null;
  userRating: UserRating | null;
};

type Props = {
  tmdbId: number;
  showId: number;
  showTitle: string;
  entry: Entry | null;
  // Highest aired season number per TMDb. Caps the + button.
  maxSeason: number | null;
  // Phase 42: whether the household co-watches this show, and the other
  // member's display name. partnerName is null in a single-user setup —
  // the co-watch toggle is hidden then.
  coWatch: boolean;
  partnerName: string | null;
};

const SHOW_SEASON_FOR: WatchStatus[] = ["watching", "paused"];

// Phase 20c. Inline-edit controls on /show/[tmdbId]. Empty state =
// quick-add buttons (one per status). Populated state = status pills +
// season stepper + rating pills + Remove. Each control auto-saves via
// router.refresh(), matching the dashboard's no-form-no-modal feel.
export function ShowDetailWatchControls({
  tmdbId,
  showId,
  showTitle,
  entry,
  maxSeason,
  coWatch,
  partnerName,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAfter = () => router.refresh();

  const onAdd = (status: WatchStatus) => {
    setError(null);
    startTransition(async () => {
      const r = await addWatchEntry({
        tmdbId,
        status,
        currentSeason: status === "watching" ? 1 : null,
      });
      if (!r.ok) setError(WATCH_ENTRY_ERROR_COPY[r.error]);
      else refreshAfter();
    });
  };

  const onChangeStatus = (next: WatchStatus) => {
    if (!entry || entry.status === next) return;
    setError(null);
    startTransition(async () => {
      const r = await updateWatchEntry({ id: entry.id, status: next });
      if (!r.ok) setError(WATCH_ENTRY_ERROR_COPY[r.error]);
      else refreshAfter();
    });
  };

  const onSeasonDelta = (delta: 1 | -1) => {
    if (!entry || entry.currentSeason == null) return;
    const next = entry.currentSeason + delta;
    if (next < 1) return;
    if (maxSeason != null && next > maxSeason) return;
    setError(null);
    startTransition(async () => {
      const r = await updateWatchEntry({ id: entry.id, currentSeason: next });
      if (!r.ok) setError(WATCH_ENTRY_ERROR_COPY[r.error]);
      else refreshAfter();
    });
  };

  const onChangeRating = (next: UserRating) => {
    if (!entry) return;
    const target: UserRating | null = entry.userRating === next ? null : next;
    setError(null);
    startTransition(async () => {
      const r = await updateWatchEntry({
        id: entry.id,
        userRating: target,
      });
      if (!r.ok) setError(WATCH_ENTRY_ERROR_COPY[r.error]);
      else refreshAfter();
    });
  };

  const onConfirmRemove = () => {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteWatchEntry(entry.id);
      if (!r.ok) {
        setError("Couldn't remove — try again.");
      } else {
        setRemoveOpen(false);
        refreshAfter();
      }
    });
  };

  // ---- empty state ---------------------------------------------------

  if (!entry) {
    return (
      <div className="mt-2 space-y-3">
        <p className="font-body text-base text-ink-muted">
          Not on your list yet. Add it as…
        </p>
        <div className="flex flex-wrap gap-2">
          {WATCH_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onAdd(s)}
              className="
                inline-flex items-center gap-1
                rounded-pill border border-border bg-surface px-3 py-1
                font-mono text-mono uppercase text-ink-secondary
                transition-colors hover:border-accent hover:text-accent
                focus-visible:outline-2 focus-visible:outline-accent
                focus-visible:outline-offset-2
              "
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="font-mono text-mono text-danger">
            [{error}]
          </p>
        )}
      </div>
    );
  }

  // ---- populated state -----------------------------------------------

  const seasonVisible = SHOW_SEASON_FOR.includes(entry.status);
  const canDec = entry.currentSeason != null && entry.currentSeason > 1;
  const canInc =
    entry.currentSeason != null &&
    (maxSeason == null || entry.currentSeason < maxSeason);

  return (
    <div className="mt-2 space-y-4">
      <div
        role="group"
        aria-label="Status"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="font-mono text-mono uppercase text-ink-muted">
          Status
        </span>
        {WATCH_STATUSES.map((s) => {
          const selected = entry.status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChangeStatus(s)}
              aria-pressed={selected}
              className={`
                rounded-pill border px-3 py-1
                font-mono text-mono uppercase
                transition-colors
                focus-visible:outline-2 focus-visible:outline-accent
                focus-visible:outline-offset-2
                ${
                  selected
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border bg-surface text-ink-secondary hover:border-border-strong"
                }
              `}
            >
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      {seasonVisible && entry.currentSeason != null && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-mono uppercase text-ink-muted">
            Season
          </span>
          <button
            type="button"
            onClick={() => onSeasonDelta(-1)}
            disabled={!canDec}
            aria-label="Previous season"
            className="
              inline-flex h-8 w-8 items-center justify-center
              rounded-sm border border-border bg-surface text-ink-secondary
              hover:border-accent hover:text-accent
              disabled:cursor-not-allowed disabled:opacity-30
              focus-visible:outline-2 focus-visible:outline-accent
              focus-visible:outline-offset-2
            "
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          <span
            aria-live="polite"
            className="min-w-12 text-center font-mono text-mono uppercase text-ink"
          >
            S{entry.currentSeason}
          </span>
          <button
            type="button"
            onClick={() => onSeasonDelta(1)}
            disabled={!canInc}
            aria-label="Next season"
            className="
              inline-flex h-8 w-8 items-center justify-center
              rounded-sm border border-border bg-surface text-ink-secondary
              hover:border-accent hover:text-accent
              disabled:cursor-not-allowed disabled:opacity-30
              focus-visible:outline-2 focus-visible:outline-accent
              focus-visible:outline-offset-2
            "
          >
            <CaretRight size={14} weight="bold" />
          </button>
          {maxSeason != null && (
            <span className="font-mono text-mono uppercase text-ink-muted">
              of {maxSeason} aired
            </span>
          )}
        </div>
      )}

      <div
        role="group"
        aria-label="Rating"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="font-mono text-mono uppercase text-ink-muted">
          Rating
        </span>
        {USER_RATINGS.map((r) => {
          const selected = entry.userRating === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onChangeRating(r)}
              aria-pressed={selected}
              aria-label={RATING_LABELS[r]}
              className={`
                inline-flex items-center gap-1
                rounded-pill border px-3 py-1
                font-mono text-mono uppercase
                transition-colors
                focus-visible:outline-2 focus-visible:outline-accent
                focus-visible:outline-offset-2
                ${
                  selected
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border bg-surface text-ink-secondary hover:border-border-strong"
                }
              `}
            >
              <span aria-hidden>{RATING_GLYPHS[r]}</span>
              <span>{RATING_LABELS[r]}</span>
            </button>
          );
        })}
      </div>

      {partnerName && (
        <div
          role="group"
          aria-label="Watching together"
          className="space-y-2"
        >
          <span className="font-mono text-mono uppercase text-ink-muted">
            Together
          </span>
          <CoWatchToggle
            showId={showId}
            coWatch={coWatch}
            partnerName={partnerName}
          />
          <p className="font-body text-sm text-ink-muted">
            {coWatch
              ? `Status and season progress sync with ${partnerName}. Ratings stay personal.`
              : `Link this show with ${partnerName} so season progress stays in step on both lists.`}
          </p>
        </div>
      )}

      <div className="flex items-center justify-end">
        <Dialog.Root open={removeOpen} onOpenChange={setRemoveOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label={`Remove ${showTitle} from your list`}
              className="
                inline-flex items-center gap-1
                rounded-sm border border-border bg-surface px-3 py-1
                font-mono text-mono uppercase text-ink-muted
                transition-colors hover:border-danger hover:text-danger
                focus-visible:outline-2 focus-visible:outline-danger
                focus-visible:outline-offset-2
              "
            >
              <Trash size={14} weight="regular" aria-hidden />
              <span>Remove</span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay
              className="
                fixed inset-0 z-40 bg-surface-overlay/70 backdrop-blur-sm
              "
            />
            <Dialog.Content
              className="
                fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm
                -translate-x-1/2 -translate-y-1/2
                rounded-md border border-border-strong bg-surface-elevated
                p-6 focus:outline-none
              "
            >
              <Dialog.Title className="font-display text-xl font-bold text-ink">
                Remove <em className="font-medium">“{showTitle}”</em>?
              </Dialog.Title>
              <Dialog.Description className="mt-2 font-body text-sm text-ink-secondary">
                Removes this show from your list with no signal either way —
                it can still be recommended in the future.
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="
                      rounded-sm border border-border bg-surface px-4 py-2
                      font-mono text-mono uppercase text-ink-secondary
                      hover:border-border-strong
                      focus-visible:outline-2 focus-visible:outline-accent
                      focus-visible:outline-offset-2
                    "
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={onConfirmRemove}
                  className="
                    rounded-sm border border-danger bg-danger px-4 py-2
                    font-mono text-mono uppercase text-accent-fg
                    hover:opacity-90
                    focus-visible:outline-2 focus-visible:outline-danger
                    focus-visible:outline-offset-2
                  "
                >
                  Remove
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {error && (
        <p role="alert" className="font-mono text-mono text-danger">
          [{error}]
        </p>
      )}
    </div>
  );
}

