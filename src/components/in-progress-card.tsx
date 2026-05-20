"use client";

import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react";
import type { InProgressEntry } from "@/app/actions/in-progress";
import { InProgressActions } from "@/components/in-progress-actions";

export type InProgressCardData = {
  entry: InProgressEntry;
  label: string | null;
  unavailable: boolean;
  // Phase 42: whether this show is co-watched with the household partner.
  coWatch: boolean;
};

type Props = {
  data: InProgressCardData;
  onEdit: () => void;
  // The other household member's name — null in a single-user setup,
  // which hides the co-watch toggle.
  partnerName: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  watching: "bg-status-watching text-accent-fg",
  paused: "bg-status-paused text-accent-fg",
};

export function InProgressCard({ data, onEdit, partnerName }: Props) {
  const { entry, label, unavailable, coWatch } = data;
  const { show } = entry;
  // No ?recItem — opens the plain Show Detail (no rec votes/explanation).
  const detailHref = `/show/${show.tmdbId}`;

  return (
    <article
      className="
        group flex items-start gap-4
        rounded-md border border-border bg-surface-elevated
        px-5 py-4
        transition-colors hover:border-border-strong
      "
    >
      <Link
        href={detailHref}
        aria-label={`Open details for ${show.title}`}
        className="
          flex-shrink-0
          focus-visible:outline-2 focus-visible:outline-accent
          focus-visible:outline-offset-2
        "
      >
        {show.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={show.posterUrl}
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

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-lg font-medium italic text-ink">
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
              {show.title}
            </Link>
          </h3>
          <span
            className={`
              inline-flex items-center rounded-pill
              px-2 py-0.5
              font-mono text-mono uppercase tracking-wide
              ${STATUS_BADGE[entry.status] ?? STATUS_BADGE.watching}
            `}
          >
            {entry.status === "paused" ? "Paused" : "Watching"}
          </span>
        </div>

        <p className="mt-1 font-body text-sm text-ink-secondary">
          {label}
          {show.productionStatus && (
            <>
              {label && " · "}
              <span className="text-ink-muted">
                {show.productionStatus}
                <span className="ml-1 text-ink-muted">— may change</span>
              </span>
            </>
          )}
        </p>

        {unavailable && (
          <div className="mt-2">
            <span
              className="
                inline-flex items-center rounded-pill
                bg-badge-unavailable px-2 py-0.5
                font-mono text-mono uppercase text-accent-fg
              "
            >
              Unavailable on your subscriptions
            </span>
          </div>
        )}

        <div className="mt-3">
          <InProgressActions
            entry={entry}
            coWatch={coWatch}
            partnerName={partnerName}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${show.title}`}
        className="
          inline-flex h-11 w-11 flex-shrink-0 items-center justify-center
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
