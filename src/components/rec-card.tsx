"use client";

import { useState, useOptimistic, useTransition } from "react";
import {
  CaretDown,
  CaretUp,
  ThumbsUp,
  ThumbsDown,
  Question,
  Plus,
  Check,
} from "@phosphor-icons/react";
import type { VoteValue } from "@prisma/client";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { RecListItemView } from "@/app/actions/recommendations";
import { voteOnRecAction, clearVoteAction } from "@/app/actions/rec-votes";
import { addToWantToWatchAction } from "@/app/actions/rec-watchlist";

const PLATFORM_NAME = new Map<string, string>(
  PLATFORMS.map((p) => [p.key, p.displayName]),
);

const VISIBLE_PROVIDERS = 2;

const VOTE_OPTIONS: Array<{
  value: VoteValue;
  label: string;
  Icon: typeof ThumbsUp;
}> = [
  { value: "agree", label: "Agree", Icon: ThumbsUp },
  { value: "maybe", label: "Maybe", Icon: Question },
  { value: "disagree", label: "Disagree", Icon: ThumbsDown },
];

type Props = { item: RecListItemView };

export function RecCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  const [optimisticVote, setOptimisticVote] = useOptimistic<
    VoteValue | null,
    VoteValue | null
  >(item.currentVote, (_, next) => next);
  // Local optimistic flag for WTW since the server-revalidated state
  // (inWatchHistory: true) flips the prop after the next render.
  const [optimisticWtw, setOptimisticWtw] = useOptimistic(
    item.inWatchHistory,
    (_, next: boolean) => next,
  );
  const [wtwError, setWtwError] = useState<string | null>(null);

  const visibleProviders = item.providerKeys.slice(0, VISIBLE_PROVIDERS);
  const overflowCount = item.providerKeys.length - visibleProviders.length;

  const onVote = (next: VoteValue) => {
    if (!item.canVote) return;
    // Toggle off when re-clicking the already-selected pill.
    const target: VoteValue | null = optimisticVote === next ? null : next;
    startTransition(async () => {
      setOptimisticVote(target);
      if (target == null) {
        await clearVoteAction(item.id);
      } else {
        await voteOnRecAction(item.id, target);
      }
    });
  };

  const onAddToWtw = () => {
    setWtwError(null);
    startTransition(async () => {
      setOptimisticWtw(true);
      const r = await addToWantToWatchAction(item.id);
      if (!r.ok) {
        // Revalidation will revert optimisticWtw on the next render; show
        // the error inline so the user knows why nothing changed.
        const message =
          r.error === "already_in_history"
            ? "Already on your list under another status."
            : "Couldn't add — try again.";
        setWtwError(message);
      }
    });
  };

  // Continuations are by definition already on the user's list, so the
  // WTW button is meaningless there. Otherwise hide once the show is
  // already in history.
  const showWtwButton = !item.isContinuation && !optimisticWtw;

  return (
    <article
      className="
        flex items-start gap-4
        rounded-md border border-border bg-surface-elevated
        px-5 py-4
        transition-colors hover:border-border-strong
      "
    >
      <div className="flex flex-shrink-0 flex-col items-center gap-2">
        <span
          aria-label={`Position ${item.position}`}
          className="font-display text-2xl font-black text-ink-muted"
        >
          {item.position}
        </span>
        {item.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.posterUrl}
            alt=""
            width={64}
            height={96}
            className="h-[96px] w-16 rounded-sm bg-surface-overlay object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="h-[96px] w-16 rounded-sm bg-surface-overlay"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-lg font-bold text-ink">
            {item.title}
            {item.year && (
              <span className="ml-2 font-mono text-mono uppercase text-ink-muted">
                {item.year}
              </span>
            )}
          </h3>
          {item.isContinuation && (
            <span
              className="
                inline-flex items-center rounded-pill
                bg-status-watching px-2 py-0.5
                font-mono text-mono uppercase tracking-wide text-accent-fg
              "
            >
              Continuation
            </span>
          )}
        </div>

        <p className="mt-2 font-body text-base text-ink">
          {expanded ? item.longExplanation : item.shortExplanation}
        </p>
        {item.longExplanation !== item.shortExplanation && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="
              mt-2 inline-flex items-center gap-1
              font-mono text-mono uppercase text-ink-muted
              transition-colors hover:text-ink
              focus-visible:outline-2 focus-visible:outline-accent
              focus-visible:outline-offset-2
            "
          >
            {expanded ? (
              <>
                <CaretUp size={12} weight="bold" aria-hidden />
                <span>Show less</span>
              </>
            ) : (
              <>
                <CaretDown size={12} weight="bold" aria-hidden />
                <span>Show more</span>
              </>
            )}
          </button>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {visibleProviders.map((key) => (
            <span
              key={key}
              className="
                inline-flex items-center rounded-pill
                border border-border bg-surface
                px-2 py-0.5
                font-mono text-mono uppercase text-ink-secondary
              "
            >
              {PLATFORM_NAME.get(key) ?? key}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="font-mono text-mono uppercase text-ink-muted">
              +{overflowCount} more
            </span>
          )}
          {item.providerKeys.length === 0 && !item.unavailable && (
            <span className="font-mono text-mono uppercase text-ink-muted">
              Availability unknown
            </span>
          )}
          {item.unavailable && (
            <span
              className="
                inline-flex items-center rounded-pill
                bg-badge-unavailable px-2 py-0.5
                font-mono text-mono uppercase text-accent-fg
              "
            >
              Unavailable on your subscriptions
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={
              item.canVote
                ? `Vote on ${item.title}`
                : `${item.title} vote (read-only)`
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
                  disabled={!item.canVote}
                  aria-pressed={selected}
                  aria-label={label}
                  title={
                    item.canVote
                      ? undefined
                      : "Only the list owner can vote here"
                  }
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
          {!showWtwButton && !item.isContinuation && optimisticWtw && (
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
      </div>
    </article>
  );
}

// Tiny helper kept here so the page can show a fallback when a platform
// key is somehow missing from PLATFORMS (defensive — shouldn't happen).
export function platformDisplayName(key: string): string {
  return PLATFORM_NAME.get(key as PlatformKey) ?? key;
}
