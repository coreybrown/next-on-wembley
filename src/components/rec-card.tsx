"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { RecListItemView } from "@/app/actions/recommendations";
import { VoteControlsRow } from "@/components/vote-controls-row";

const PLATFORM_NAME = new Map<string, string>(
  PLATFORMS.map((p) => [p.key, p.displayName]),
);

const VISIBLE_PROVIDERS = 2;

type Props = { item: RecListItemView };

export function RecCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);

  const visibleProviders = item.providerKeys.slice(0, VISIBLE_PROVIDERS);
  const overflowCount = item.providerKeys.length - visibleProviders.length;
  const detailHref = `/show/${item.tmdbId}?recItem=${item.id}`;

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
        <Link
          href={detailHref}
          aria-label={`Open details for ${item.title}`}
          className="
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
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
        </Link>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-lg font-bold text-ink">
            <Link
              href={detailHref}
              className="
                hover:underline focus-visible:underline
                focus-visible:outline-none
              "
            >
              {item.title}
            </Link>
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

        <VoteControlsRow
          itemId={item.id}
          title={item.title}
          currentVote={item.currentVote}
          canVote={item.canVote}
          isContinuation={item.isContinuation}
          inWatchHistory={item.inWatchHistory}
        />
      </div>
    </article>
  );
}

// Tiny helper kept here so the page can show a fallback when a platform
// key is somehow missing from PLATFORMS (defensive — shouldn't happen).
export function platformDisplayName(key: string): string {
  return PLATFORM_NAME.get(key as PlatformKey) ?? key;
}
