"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { voteOnRecAction } from "@/app/actions/rec-votes";
import { revalidateAll } from "@/lib/revalidate";

export type ContinuationOutcome = "paused" | "dropped";

export type DisagreeOnContinuationError =
  | "unauthorized"
  | "not_found"
  | "show_unavailable"
  | "no_watch_entry"
  | "vote_failed";

export type DisagreeOnContinuationResult =
  | { ok: true }
  | { ok: false; error: DisagreeOnContinuationError };

// Phase 27. When the user clicks Disagree on a card they're currently
// Watching (a continuation), the UI opens a "Move to Paused/Dropped?"
// prompt. Resolving it: update the viewer's WatchEntry status AND
// record the Disagree vote in one server roundtrip. Cancel cancels both
// — the action only fires if the user picks an outcome.
export async function disagreeOnContinuationAction(
  itemId: number,
  outcome: ContinuationOutcome,
): Promise<DisagreeOnContinuationResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const item = await prisma.recommendationItem.findUnique({
    where: { id: itemId },
    select: { id: true, showId: true },
  });
  if (!item) return { ok: false, error: "not_found" };
  if (item.showId == null) return { ok: false, error: "show_unavailable" };

  // The viewer must have the show in their own history for the
  // continuation prompt to make sense. Defensive — the UI only opens
  // the prompt when inWatchHistory is true, but the action stays safe
  // on its own.
  const entry = await prisma.watchEntry.findUnique({
    where: {
      userId_showId: { userId: session.userId, showId: item.showId },
    },
    select: { id: true, currentSeason: true },
  });
  if (!entry) return { ok: false, error: "no_watch_entry" };

  await prisma.watchEntry.update({
    where: { id: entry.id },
    data: {
      status: outcome,
      // Dropped clears the current-season pointer — the user isn't
      // tracking progress anymore. Paused keeps it so the show can
      // resume later from the same spot.
      ...(outcome === "dropped"
        ? { currentSeason: null, currentSeasonCompleted: false }
        : {}),
    },
  });

  // Record the Disagree via the existing voting action so all the
  // ownership rules (Phase 15.1) and per-show keying (Phase 16) apply
  // unchanged.
  const voteResult = await voteOnRecAction(itemId, "disagree");
  if (!voteResult.ok) return { ok: false, error: "vote_failed" };

  // The watch-entry change shows up on the dashboard + in-progress
  // route; the vote change shows up on /recs.
  revalidateAll();
  return { ok: true };
}
