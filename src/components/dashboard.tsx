"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { WatchStatus } from "@prisma/client";
import { SearchInput } from "@/components/search-input";
import { WatchEntryCard } from "@/components/watch-entry-card";
import { AddShowModal } from "@/components/add-show-modal";
import { WatchEntryEditDialog } from "@/components/watch-entry-edit-dialog";
import type { TmdbSearchResult } from "@/lib/tmdb";
import type { WatchEntryWithShow } from "@/app/actions/watch-entries";
import { STATUS_LABELS } from "@/lib/watch-entries";

// Engagement-ordered: in-progress / queued first, archived states last.
const SECTION_ORDER: readonly WatchStatus[] = [
  "watching",
  "want_to_watch",
  "paused",
  "completed",
  "dropped",
] as const;

const EMPTY_COPY: Record<WatchStatus, string> = {
  watching: "Nothing in flight.",
  want_to_watch: "No queue yet — search to add something.",
  paused: "Nothing on hold.",
  completed: "Nothing in the archive.",
  dropped: "No retirements yet.",
};

type Props = {
  entries: WatchEntryWithShow[];
  displayName: string;
  // Phase 42: showIds the household co-watches. Splits the Watching
  // section into "Together" / "On your own" subgroups and feeds each
  // in-progress card's co-watch toggle.
  coWatchedShowIds: number[];
  // The other household member's name — null in a single-user setup.
  partnerName: string | null;
};

export function Dashboard({
  entries,
  displayName,
  coWatchedShowIds,
  partnerName,
}: Props) {
  const [pendingAdd, setPendingAdd] = useState<TmdbSearchResult | null>(null);
  const [editing, setEditing] = useState<WatchEntryWithShow | null>(null);

  const grouped = SECTION_ORDER.map((status) => ({
    status,
    items: entries.filter((e) => e.status === status),
  }));

  const totalEntries = entries.length;
  const coWatchedSet = new Set(coWatchedShowIds);

  const renderEntryList = (items: WatchEntryWithShow[]) => (
    <ul className="space-y-3">
      {items.map((entry) => (
        <li key={entry.id}>
          <WatchEntryCard
            entry={entry}
            onEdit={() => setEditing(entry)}
            coWatch={coWatchedSet.has(entry.showId)}
            partnerName={partnerName}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <main className="bg-page mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-8 sm:py-12">
      <header className="mb-10">
        <p className="font-mono text-mono uppercase text-ink-muted">
          [a quiet borough · 2026]
        </p>
        <h1 className="mt-3 font-display text-2xl font-black text-ink leading-none sm:text-4xl">
          {displayName}&rsquo;s list
        </h1>
        <div aria-hidden className="mt-3 h-[2px] w-16 bg-accent-sharp" />
      </header>

      <section className="mb-12">
        <SearchInput onSelect={(r) => setPendingAdd(r)} />
      </section>

      {totalEntries === 0 ? (
        <section
          className="
            bg-empty rounded-md border border-border
            px-6 py-16 text-center
          "
        >
          <p className="font-display italic text-lg text-ink-secondary">
            No shows yet.
          </p>
          <p className="mt-3 font-body text-base text-ink-muted">
            Search above to add your first show.
          </p>
        </section>
      ) : (
        <div className="space-y-12">
          {grouped.map(({ status, items }) => (
            <section key={status}>
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <h2 className="font-mono text-mono uppercase tracking-wide text-ink-muted">
                  {STATUS_LABELS[status]}
                  <span className="ml-2 text-ink-muted/60">
                    ({items.length})
                  </span>
                </h2>
                {status === "watching" && items.length > 0 && (
                  <Link
                    href="/in-progress"
                    className="
                      inline-flex items-center gap-1
                      font-mono text-mono uppercase text-ink-muted
                      transition-colors hover:text-ink
                      focus-visible:outline-2 focus-visible:outline-accent
                      focus-visible:outline-offset-2
                    "
                  >
                    <span>View In-Progress</span>
                    <ArrowRight size={14} weight="regular" aria-hidden />
                  </Link>
                )}
              </div>
              {items.length === 0 ? (
                <p className="font-body text-sm italic text-ink-muted">
                  {EMPTY_COPY[status]}
                </p>
              ) : status === "watching" &&
                items.some((e) => coWatchedSet.has(e.showId)) ? (
                // Phase 42: split Watching into co-watched vs. solo. Only
                // when at least one show is co-watched — a flat list reads
                // cleaner when there's nothing to distinguish.
                (() => {
                  const together = items.filter((e) =>
                    coWatchedSet.has(e.showId),
                  );
                  const solo = items.filter(
                    (e) => !coWatchedSet.has(e.showId),
                  );
                  return (
                    <div className="space-y-6">
                      <div>
                        <h3 className="mb-3 font-mono text-mono uppercase text-ink-muted">
                          Together
                          <span className="ml-2 text-ink-muted/60">
                            ({together.length})
                          </span>
                        </h3>
                        {renderEntryList(together)}
                      </div>
                      {solo.length > 0 && (
                        <div>
                          <h3 className="mb-3 font-mono text-mono uppercase text-ink-muted">
                            On your own
                            <span className="ml-2 text-ink-muted/60">
                              ({solo.length})
                            </span>
                          </h3>
                          {renderEntryList(solo)}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                renderEntryList(items)
              )}
            </section>
          ))}
        </div>
      )}

      <AddShowModal
        show={pendingAdd}
        onOpenChange={(open) => !open && setPendingAdd(null)}
      />
      <WatchEntryEditDialog
        entry={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </main>
  );
}
