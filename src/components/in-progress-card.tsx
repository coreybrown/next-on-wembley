"use client";

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

  return (
    <article
      className="
        flex items-start gap-4
        rounded-md border border-border bg-surface-elevated
        px-5 py-4
        transition-colors hover:border-border-strong
      "
    >
      {show.posterUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={show.posterUrl}
          alt=""
          width={64}
          height={96}
          className="h-[96px] w-16 flex-shrink-0 rounded-sm bg-surface-overlay object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="h-[96px] w-16 flex-shrink-0 rounded-sm bg-surface-overlay"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-lg font-medium italic text-ink">
            {show.title}
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
