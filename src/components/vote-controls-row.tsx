"use client";

import { useOptimistic, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
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
import {
  disagreeOnContinuationAction,
  type ContinuationOutcome,
} from "@/app/actions/rec-continuation";

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
  // Co-watch only (M4 Phase 25). The partner's vote on this show.
  // Display-only — rendered as a small "Partner: …" line next to the
  // vote pills. Null on user-scoped lists or when the partner hasn't
  // voted yet.
  partnerVote?: VoteValue | null;
  // Display name to attribute the partner vote to (e.g. "Jaimie:").
  // Falls back to "Partner" when not provided.
  partnerLabel?: string;
};

// Vote pills (Agree / Maybe / Disagree) + Want-to-Watch button row.
// Shared between RecCard and the Show Detail page so the affordances
// behave identically — the user can vote / add-to-WTW from either
// surface (PRD §6.6 "Voting and Add-to-WTW work the same as from the
// rec card").
const VOTE_LABEL: Record<VoteValue, string> = {
  agree: "Agree",
  maybe: "Maybe",
  disagree: "Disagree",
};

export function VoteControlsRow({
  itemId,
  title,
  currentVote,
  canVote,
  isContinuation,
  inWatchHistory,
  partnerVote = null,
  partnerLabel = "Partner",
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
  // Phase 27. When the viewer clicks Disagree on a card they're currently
  // Watching (continuation), open a "Move to Paused/Dropped?" dialog
  // before recording the vote. The dialog gates the vote — Cancel
  // discards it; Paused/Dropped commits both the status change and the
  // Disagree atomically via disagreeOnContinuationAction.
  const [continuationPromptOpen, setContinuationPromptOpen] = useState(false);

  const submitVote = (target: VoteValue | null) => {
    startTransition(async () => {
      setOptimisticVote(target);
      if (target == null) {
        await clearVoteAction(itemId);
      } else {
        await voteOnRecAction(itemId, target);
      }
    });
  };

  const onVote = (next: VoteValue) => {
    if (!canVote) return;
    const target: VoteValue | null = optimisticVote === next ? null : next;
    // Disagree on a continuation the VIEWER owns → prompt first.
    // Continuations the viewer doesn't personally own (e.g. co_watch
    // continuation that's only in the partner's history) skip the
    // prompt since there's no WatchEntry to update on this user.
    if (target === "disagree" && isContinuation && inWatchHistory) {
      setContinuationPromptOpen(true);
      return;
    }
    submitVote(target);
  };

  const onResolveContinuation = (outcome: ContinuationOutcome) => {
    startTransition(async () => {
      setOptimisticVote("disagree");
      setContinuationPromptOpen(false);
      const r = await disagreeOnContinuationAction(itemId, outcome);
      if (!r.ok) {
        // Rollback the optimistic disagree if the server bailed.
        setOptimisticVote(currentVote);
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
    <>
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

      {partnerVote && (
        <span
          className="
            inline-flex items-center gap-1
            font-mono text-mono uppercase text-ink-muted
          "
          title={`${partnerLabel}: ${VOTE_LABEL[partnerVote]}`}
        >
          <span>{partnerLabel}:</span>
          <span
            className={`
              inline-flex items-center gap-1 rounded-pill border px-2 py-0.5
              ${
                partnerVote === "agree"
                  ? "border-accent text-accent"
                  : partnerVote === "disagree"
                    ? "border-danger text-danger"
                    : "border-border text-ink-secondary"
              }
            `}
          >
            {(() => {
              const Icon =
                partnerVote === "agree"
                  ? ThumbsUp
                  : partnerVote === "disagree"
                    ? ThumbsDown
                    : Question;
              return <Icon size={12} weight="fill" aria-hidden />;
            })()}
            <span>{VOTE_LABEL[partnerVote]}</span>
          </span>
        </span>
      )}

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

    <Dialog.Root open={continuationPromptOpen} onOpenChange={setContinuationPromptOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed inset-0 z-40 bg-surface-overlay/70 backdrop-blur-sm
          "
        />
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md
            -translate-x-1/2 -translate-y-1/2
            rounded-md border border-border-strong bg-surface-elevated
            p-6 focus:outline-none
          "
        >
          <Dialog.Title className="font-display text-xl font-bold text-ink">
            Step back from <em className="font-medium">“{title}”</em>?
          </Dialog.Title>
          <Dialog.Description className="mt-2 font-body text-sm text-ink-secondary">
            You&rsquo;re currently Watching this show. A Disagree usually
            means you&rsquo;re done with it — pick how to update your list,
            and we&rsquo;ll record the Disagree for future recs.
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
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
              onClick={() => onResolveContinuation("paused")}
              className="
                rounded-sm border border-border bg-surface px-4 py-2
                font-mono text-mono uppercase text-ink
                hover:border-accent hover:text-accent
                focus-visible:outline-2 focus-visible:outline-accent
                focus-visible:outline-offset-2
              "
            >
              Move to Paused
            </button>
            <button
              type="button"
              onClick={() => onResolveContinuation("dropped")}
              className="
                rounded-sm border border-danger bg-danger px-4 py-2
                font-mono text-mono uppercase text-accent-fg
                hover:opacity-90
                focus-visible:outline-2 focus-visible:outline-danger
                focus-visible:outline-offset-2
              "
            >
              Move to Dropped
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}
