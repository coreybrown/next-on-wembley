"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { PLATFORMS } from "@/lib/platforms";
import type { RecListItemView } from "@/app/actions/recommendations";
import { VoteControlsRow } from "@/components/vote-controls-row";
import { WantToWatchButton } from "@/components/want-to-watch-button";

const PLATFORM_NAME = new Map<string, string>(
  PLATFORMS.map((p) => [p.key, p.displayName]),
);

const VISIBLE_PROVIDERS = 2;

type Props = {
  item: RecListItemView;
  // Display name to attribute the partner vote to on Co-watch cards
  // (M4 Phase 25). Falls back to "Partner" when omitted.
  partnerLabel?: string;
};

export function RecCard({ item, partnerLabel }: Props) {
  const visibleProviders = item.providerKeys.slice(0, VISIBLE_PROVIDERS);
  const overflowCount = item.providerKeys.length - visibleProviders.length;
  const detailHref = `/show/${item.tmdbId}?recItem=${item.id}`;

  return (
    <article
      aria-labelledby={`rec-${item.id}-title`}
      className="
        group flex items-start gap-4
        rounded-md border border-border bg-surface-elevated
        px-5 py-4
        transition-colors hover:border-border-strong
        focus-within:outline-2 focus-within:outline-accent-sharp
        focus-within:outline-offset-2
      "
    >
      <div className="flex flex-shrink-0 flex-col items-center gap-2">
        <span
          aria-label={`Position ${item.position}`}
          className="font-mono text-mono uppercase text-ink-muted"
        >
          {item.position.toString().padStart(2, "0")}
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
              className="
                h-[96px] w-16 rounded-sm bg-surface-overlay object-cover
                transition-transform duration-200 ease-out
                group-hover:-translate-y-0.5 group-hover:-rotate-[0.5deg]
                motion-reduce:transform-none motion-reduce:transition-none
              "
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
          <h3
            id={`rec-${item.id}-title`}
            className="font-display text-lg font-medium italic text-ink"
          >
            {/* Accent underline draws left-to-right on card hover via a
                background-size transition (DESIGN_SPEC §5.1). */}
            <Link
              href={detailHref}
              className="
                bg-gradient-to-r from-accent-sharp to-accent-sharp
                bg-[length:0%_2px] bg-left-bottom bg-no-repeat
                transition-[background-size] duration-200 ease-out
                group-hover:bg-[length:100%_2px]
                focus-visible:bg-[length:100%_2px]
                focus-visible:outline-none
                motion-reduce:transition-none
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
                border border-border px-2 py-0.5
                font-mono text-mono uppercase tracking-wide text-ink-muted
              "
            >
              Continuation
            </span>
          )}
        </div>

        <p className="mt-2 font-body text-md font-medium text-ink">
          {item.shortExplanation}
        </p>
        <Link
          href={detailHref}
          aria-label={`See details for ${item.title}`}
          className="
            mt-2 inline-flex items-center gap-1
            font-mono text-mono uppercase text-ink-muted
            transition-colors hover:text-ink
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          <span>See details</span>
          <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>

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
          partnerVote={item.partnerVote}
          partnerLabel={partnerLabel}
        />
      </div>
      {/* Add-to-Want-to-Watch — a flow-laid-out right column (renders
          null for continuations), so it never overlaps the description. */}
      <WantToWatchButton
        itemId={item.id}
        title={item.title}
        isContinuation={item.isContinuation}
        inWatchHistory={item.inWatchHistory}
      />
    </article>
  );
}
