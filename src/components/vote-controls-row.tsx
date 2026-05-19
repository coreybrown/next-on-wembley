"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Question,
  Plus,
  Check,
} from "@phosphor-icons/react";
import type { VoteValue } from "@prisma/client";
import { voteOnRecAction, clearVoteAction } from "@/app/actions/rec-votes";
import { addToWantToWatchAction } from "@/app/actions/rec-watchlist";

const VOTE_OPTIONS: Array<{
  value: VoteValue;
  label: string;
  Icon: typeof ThumbsUp;
}> = [
  { value: "agree", label: "Agree", Icon: ThumbsUp },
  { value: "maybe", label: "Maybe", Icon: Question },
  { value: "disagree", label: "Disagree", Icon: ThumbsDown },
];

type Props = {
  // RecommendationItem id — vote actions resolve to (showId, ownerUserId)
  // by looking up the item's run.scope, so passing the item id is enough.
  itemId: number;
  title: string;
  currentVote: VoteValue | null;
  canVote: boolean;
  isContinuation: boolean;
  inWatchHistory: boolean;
};

// Vote pills (Agree / Maybe / Disagree) + Want-to-Watch button row.
// Shared between RecCard and the Show Detail page so the affordances
// behave identically — the user can vote / add-to-WTW from either
// surface (PRD §6.6 "Voting and Add-to-WTW work the same as from the
// rec card").
export function VoteControlsRow({
  itemId,
  title,
  currentVote,
  canVote,
  isContinuation,
  inWatchHistory,
}: Props) {
  const [, startTransition] = useTransition();
  const [optimisticVote, setOptimisticVote] = useOptimistic<
    VoteValue | null,
    VoteValue | null
  >(currentVote, (_, next) => next);
  const [optimisticWtw, setOptimisticWtw] = useOptimistic(
    inWatchHistory,
    (_, next: boolean) => next,
  );
  const [wtwError, setWtwError] = useState<string | null>(null);

  const onVote = (next: VoteValue) => {
    if (!canVote) return;
    const target: VoteValue | null = optimisticVote === next ? null : next;
    startTransition(async () => {
      setOptimisticVote(target);
      if (target == null) {
        await clearVoteAction(itemId);
      } else {
        await voteOnRecAction(itemId, target);
      }
    });
  };

  const onAddToWtw = () => {
    setWtwError(null);
    startTransition(async () => {
      setOptimisticWtw(true);
      const r = await addToWantToWatchAction(itemId);
      if (!r.ok) {
        const message =
          r.error === "already_in_history"
            ? "Already on your list under another status."
            : "Couldn't add — try again.";
        setWtwError(message);
      }
    });
  };

  const showWtwButton = !isContinuation && !optimisticWtw;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={
          canVote ? `Vote on ${title}` : `${title} vote (read-only)`
        }
        className="flex items-center gap-1"
      >
        {VOTE_OPTIONS.map(({ value, label, Icon }) => {
          const selected = optimisticVote === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onVote(value)}
              disabled={!canVote}
              aria-pressed={selected}
              aria-label={label}
              title={canVote ? undefined : "Only the list owner can vote here"}
              className={`
                inline-flex items-center gap-1
                rounded-pill border px-3 py-1
                font-mono text-mono uppercase
                transition-colors
                focus-visible:outline-2 focus-visible:outline-accent
                focus-visible:outline-offset-2
                disabled:cursor-not-allowed disabled:opacity-60
                ${
                  selected
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border bg-surface text-ink-secondary hover:border-border-strong"
                }
              `}
            >
              <Icon size={14} weight={selected ? "fill" : "regular"} aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {showWtwButton && (
        <button
          type="button"
          onClick={onAddToWtw}
          className="
            inline-flex items-center gap-1
            rounded-pill border border-border bg-surface px-3 py-1
            font-mono text-mono uppercase text-ink-secondary
            transition-colors hover:border-border-strong
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          <Plus size={14} weight="bold" aria-hidden />
          <span>Want to Watch</span>
        </button>
      )}
      {!showWtwButton && !isContinuation && optimisticWtw && (
        <span
          className="
            inline-flex items-center gap-1
            font-mono text-mono uppercase text-ink-muted
          "
        >
          <Check size={14} weight="bold" aria-hidden />
          <span>On your list</span>
        </span>
      )}
      {wtwError && (
        <span
          role="status"
          className="font-mono text-mono uppercase text-ink-muted"
        >
          {wtwError}
        </span>
      )}
    </div>
  );
}
