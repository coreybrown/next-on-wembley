"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Plus, Check } from "@phosphor-icons/react";
import { addToWantToWatchAction } from "@/app/actions/rec-watchlist";

type Props = {
  itemId: number;
  title: string;
  // Continuations are by definition already on the user's list — the
  // button doesn't render for them. Caller passes `isContinuation` so
  // it can short-circuit before rendering.
  isContinuation: boolean;
  inWatchHistory: boolean;
};

// Phase 40. Compact "+" icon button slotting in the top-right of a
// RecCard (matching the Edit / Trash pattern on dashboard cards).
// Hides when the show is already on the user's list or is a
// continuation; the inline action surface drops from the bottom of
// the card so vote pills can read as the primary affordance.
export function WantToWatchButton({
  itemId,
  title,
  isContinuation,
  inWatchHistory,
}: Props) {
  const [, startTransition] = useTransition();
  const [optimisticOnList, setOptimisticOnList] = useOptimistic(
    inWatchHistory,
    (_, next: boolean) => next,
  );
  const [error, setError] = useState<string | null>(null);

  const onAdd = () => {
    setError(null);
    startTransition(async () => {
      setOptimisticOnList(true);
      const r = await addToWantToWatchAction(itemId);
      if (!r.ok) {
        setError(
          r.error === "already_in_history"
            ? "Already on your list."
            : "Couldn't add — try again.",
        );
      }
    });
  };

  if (isContinuation) return null;

  if (optimisticOnList) {
    return (
      <span
        title={`${title} is on your list`}
        aria-label={`${title} is on your list`}
        className="
          inline-flex h-11 w-11 items-center justify-center
          rounded-sm border border-border bg-surface
          text-ink-muted
        "
      >
        <Check size={16} weight="bold" aria-hidden />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${title} to Want to Watch`}
        title="Add to Want to Watch"
        className="
          inline-flex h-11 w-11 items-center justify-center
          rounded-sm border border-border bg-surface text-ink-secondary
          transition-colors hover:border-accent hover:text-accent
          focus-visible:outline-2 focus-visible:outline-accent-sharp
          focus-visible:outline-offset-2
        "
      >
        <Plus size={16} weight="bold" aria-hidden />
      </button>
      {error && (
        <span
          role="status"
          className="sr-only"
        >
          {error}
        </span>
      )}
    </>
  );
}
