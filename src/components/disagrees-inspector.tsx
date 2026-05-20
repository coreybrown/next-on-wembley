"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { clearOwnVoteOnShowAction } from "@/app/actions/rec-votes";
import type { DisagreedShow } from "@/app/actions/recommendations";

type Props = {
  shows: DisagreedShow[];
};

// Phase 28. Collapsible "Buried disagrees" panel rendered at the bottom
// of the viewer's own user-scoped Picks tab. Lists every show the
// viewer has Disagreed on; one-click "Bring back" clears the vote so
// the show can resurface in future refreshes (and immediately reappear
// in the current list if it's persisted there).
export function DisagreesInspector({ shows }: Props) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [optimisticShows, removeShow] = useOptimistic<
    DisagreedShow[],
    number
  >(shows, (state, removedShowId) =>
    state.filter((s) => s.showId !== removedShowId),
  );

  if (shows.length === 0) return null;

  const onBringBack = (showId: number) => {
    startTransition(async () => {
      removeShow(showId);
      await clearOwnVoteOnShowAction(showId);
    });
  };

  return (
    <section
      aria-label="Hidden Disagrees"
      className="mt-8 rounded-md border border-dashed border-border bg-surface-elevated/40 p-4"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="
          inline-flex w-full items-center justify-between gap-2
          font-mono text-mono uppercase text-ink-secondary
          transition-colors hover:text-ink
          focus-visible:outline-2 focus-visible:outline-accent
          focus-visible:outline-offset-2
        "
      >
        <span>Buried disagrees ({optimisticShows.length})</span>
        {open ? (
          <CaretUp size={14} weight="bold" aria-hidden />
        ) : (
          <CaretDown size={14} weight="bold" aria-hidden />
        )}
      </button>
      {open && (
        <>
          <p className="mt-3 font-body text-sm text-ink-muted">
            Shows you&rsquo;ve Disagreed on. Hidden from your Picks. Bring one
            back to clear the vote and let it resurface in future refreshes.
          </p>
          <ul className="mt-3 space-y-2">
            {optimisticShows.map((s) => (
              <li
                key={s.showId}
                className="
                  flex items-center gap-3
                  rounded-sm border border-border bg-surface
                  px-3 py-2
                "
              >
                {s.posterUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={s.posterUrl}
                    alt=""
                    width={36}
                    height={54}
                    className="h-[54px] w-9 flex-shrink-0 rounded-sm bg-surface-overlay object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="h-[54px] w-9 flex-shrink-0 rounded-sm bg-surface-overlay"
                  />
                )}
                <span className="flex-1 font-body text-base text-ink truncate">
                  {s.title}
                </span>
                <button
                  type="button"
                  onClick={() => onBringBack(s.showId)}
                  aria-label={`Bring ${s.title} back into recommendations`}
                  className="
                    inline-flex items-center gap-1
                    rounded-pill border border-border bg-surface px-3 py-1
                    font-mono text-mono uppercase text-ink-secondary
                    transition-colors hover:border-accent hover:text-accent
                    focus-visible:outline-2 focus-visible:outline-accent
                    focus-visible:outline-offset-2
                  "
                >
                  <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
                  <span>Bring back</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
