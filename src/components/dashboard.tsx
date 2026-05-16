"use client";

import { useState } from "react";
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
};

export function Dashboard({ entries, displayName }: Props) {
  const [pendingAdd, setPendingAdd] = useState<TmdbSearchResult | null>(null);
  const [editing, setEditing] = useState<WatchEntryWithShow | null>(null);

  const grouped = SECTION_ORDER.map((status) => ({
    status,
    items: entries.filter((e) => e.status === status),
  }));

  const totalEntries = entries.length;

  return (
    <main className="bg-page mx-auto min-h-svh max-w-3xl px-6 py-16 sm:px-8 sm:py-20">
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
              <h2 className="mb-4 font-mono text-mono uppercase tracking-wide text-ink-muted">
                {STATUS_LABELS[status]}
                <span className="ml-2 text-ink-muted/60">({items.length})</span>
              </h2>
              {items.length === 0 ? (
                <p className="font-body text-sm italic text-ink-muted">
                  {EMPTY_COPY[status]}
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((entry) => (
                    <li key={entry.id}>
                      <WatchEntryCard
                        entry={entry}
                        onEdit={() => setEditing(entry)}
                      />
                    </li>
                  ))}
                </ul>
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
