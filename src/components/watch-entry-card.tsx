"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import {
  deleteWatchEntry,
  type WatchEntryWithShow,
} from "@/app/actions/watch-entries";
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
  const [removeOpen, setRemoveOpen] = useState(false);
  const [isRemoving, startRemove] = useTransition();

  const onConfirmRemove = () => {
    startRemove(async () => {
      const r = await deleteWatchEntry(entry.id);
      if (r.ok) {
        setRemoveOpen(false);
      }
    });
  };

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
        <h3 className="font-display text-lg font-medium italic text-ink truncate">
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
      <div className="flex flex-shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${show.title}`}
          className="
            inline-flex h-9 w-9 items-center justify-center
            rounded-sm border border-border bg-surface
            text-ink-secondary
            transition-colors hover:border-accent hover:text-accent
            focus-visible:outline-2 focus-visible:outline-accent-sharp
            focus-visible:outline-offset-2
          "
        >
          <PencilSimple size={16} weight="regular" />
        </button>
        <Dialog.Root open={removeOpen} onOpenChange={setRemoveOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label={`Remove ${show.title}`}
              className="
                inline-flex h-9 w-9 items-center justify-center
                rounded-sm border border-border bg-surface
                text-ink-muted
                transition-colors hover:border-danger hover:text-danger
                focus-visible:outline-2 focus-visible:outline-danger
                focus-visible:outline-offset-2
              "
            >
              <Trash size={16} weight="regular" />
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
                Remove <em className="font-medium">“{show.title}”</em>?
              </Dialog.Title>
              <Dialog.Description className="mt-2 font-body text-sm text-ink-secondary">
                Removes this show from your list with no signal either way —
                it can still be recommended in the future.
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={isRemoving}
                    className="
                      rounded-sm border border-border bg-surface px-4 py-2
                      font-mono text-mono uppercase text-ink-secondary
                      hover:border-border-strong
                      focus-visible:outline-2 focus-visible:outline-accent
                      focus-visible:outline-offset-2
                      disabled:cursor-not-allowed disabled:opacity-60
                    "
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={onConfirmRemove}
                  disabled={isRemoving}
                  className="
                    rounded-sm border border-danger bg-danger px-4 py-2
                    font-mono text-mono uppercase text-accent-fg
                    hover:opacity-90
                    focus-visible:outline-2 focus-visible:outline-danger
                    focus-visible:outline-offset-2
                    disabled:cursor-not-allowed disabled:opacity-60
                  "
                >
                  {isRemoving ? "Removing…" : "Remove"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </article>
  );
}
