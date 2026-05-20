"use client";

import { useState } from "react";
import {
  InProgressCard,
  type InProgressCardData,
} from "@/components/in-progress-card";
import { WatchEntryEditDialog } from "@/components/watch-entry-edit-dialog";
import type { WatchEntryWithShow } from "@/app/actions/watch-entries";

type Props = {
  cards: InProgressCardData[];
  // The other household member's name, threaded to each card's co-watch
  // toggle. Null in a single-user setup.
  partnerName: string | null;
};

export function InProgressList({ cards, partnerName }: Props) {
  const [showPaused, setShowPaused] = useState(false);
  const [editing, setEditing] = useState<WatchEntryWithShow | null>(null);

  // Watching is sub-sorted: shows you're mid-season on come before shows
  // where the current season is finished. Stable, so the underlying
  // updatedAt-desc order holds within each group.
  const watching = cards
    .filter((c) => c.entry.status === "watching")
    .sort(
      (a, b) =>
        Number(a.entry.currentSeasonCompleted) -
        Number(b.entry.currentSeasonCompleted),
    );
  const paused = cards.filter((c) => c.entry.status === "paused");
  const visible = showPaused ? [...watching, ...paused] : watching;

  if (cards.length === 0) {
    return (
      <section
        className="
          bg-empty rounded-md border border-border
          px-6 py-16 text-center
        "
      >
        <p className="font-display italic text-lg text-ink-secondary">
          Nothing in progress right now.
        </p>
        <p className="mt-3 font-body text-base text-ink-muted">
          Start something from your list — or add a new show.
        </p>
      </section>
    );
  }

  return (
    <>
      {paused.length > 0 && (
        <div className="mb-6 flex items-center justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-mono uppercase text-ink-muted">
            <input
              type="checkbox"
              checked={showPaused}
              onChange={(e) => setShowPaused(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            Show paused ({paused.length})
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="font-body text-sm italic text-ink-muted">
          Only paused entries — toggle &ldquo;Show paused&rdquo; to reveal them.
        </p>
      ) : (
        <ul className="space-y-4">
          {visible.map((data) => (
            <li key={data.entry.id}>
              <InProgressCard
                data={data}
                onEdit={() => setEditing(data.entry as WatchEntryWithShow)}
                partnerName={partnerName}
              />
            </li>
          ))}
        </ul>
      )}

      <WatchEntryEditDialog
        entry={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </>
  );
}
