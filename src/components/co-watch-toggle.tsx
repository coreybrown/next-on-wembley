"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UsersThree } from "@phosphor-icons/react";
import { setCoWatchAction } from "@/app/actions/co-watch";
import type { WatchProgress } from "@/lib/watch-entries";

// Confirmation copy naming the state both profiles snapped to on enable.
function syncNotice(synced: WatchProgress, partnerName: string): string {
  const who = `you and ${partnerName}`;
  switch (synced.status) {
    case "completed":
      return `Synced — marked Completed for ${who}.`;
    case "watching":
      return `Synced — ${who} are now Watching S${synced.currentSeason ?? 1}.`;
    case "paused":
      return `Synced — ${who} are now Paused at S${synced.currentSeason ?? 1}.`;
    case "want_to_watch":
      return `Synced — ${who} both have this as Want to Watch.`;
    case "dropped":
      return `Synced — marked Dropped for ${who}.`;
  }
}

const NOTICE_TIMEOUT_MS = 6000;

type Props = {
  showId: number;
  coWatch: boolean;
  // The other household member's display name. The toggle is only
  // rendered when a partner exists, so this is always set by the caller.
  partnerName: string;
};

// Phase 42: the "watching together" toggle, shared between the Show
// Detail watch controls and the in-progress card actions. Flipping it on
// links the show across both profiles (status / season sync); flipping
// it off unlinks. After a toggle it surfaces a short-lived notice naming
// the synced state, which auto-dismisses so it can't read as stale once
// the user makes further edits.
export function CoWatchToggle({ showId, coWatch, partnerName }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const onToggle = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await setCoWatchAction(showId, !coWatch);
      if (!r.ok) {
        setError("Couldn’t update co-watch — try again.");
        return;
      }
      if (r.on && r.synced && r.partnerName) {
        setNotice(syncNotice(r.synced, r.partnerName));
      } else if (!r.on && r.partnerName) {
        setNotice(`No longer syncing with ${r.partnerName}.`);
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={coWatch}
        // "On" is an accent *outline*, not a filled surface — on an
        // in-progress card the season-state toggle already owns the one
        // filled-accent slot; a second fill would muddy the hierarchy.
        className={`
          inline-flex items-center gap-1
          rounded-pill border px-3 py-1
          font-mono text-mono uppercase
          transition-colors
          focus-visible:outline-2 focus-visible:outline-accent
          focus-visible:outline-offset-2
          ${
            coWatch
              ? "border-accent bg-surface text-accent"
              : "border-border bg-surface text-ink-secondary hover:border-border-strong"
          }
        `}
      >
        <UsersThree
          size={14}
          weight={coWatch ? "fill" : "regular"}
          aria-hidden
        />
        <span>
          {coWatch
            ? `Watching with ${partnerName}`
            : `Watch with ${partnerName}`}
        </span>
      </button>
      {notice && (
        <p role="status" className="font-mono text-mono text-accent">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="font-mono text-mono text-danger">
          [{error}]
        </p>
      )}
    </div>
  );
}
