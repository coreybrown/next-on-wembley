import type { WatchStatus, UserRating } from "@prisma/client";

export const WATCH_STATUSES = [
  "want_to_watch",
  "watching",
  "paused",
  "completed",
  "dropped",
] as const satisfies readonly WatchStatus[];

export const USER_RATINGS = [
  "like",
  "dislike",
  "meh",
] as const satisfies readonly UserRating[];

export const STATUS_LABELS: Record<WatchStatus, string> = {
  want_to_watch: "Want to Watch",
  watching: "Watching",
  paused: "Paused",
  completed: "Completed",
  dropped: "Dropped",
};

export const RATING_LABELS: Record<UserRating, string> = {
  like: "Liked",
  dislike: "Disliked",
  meh: "Meh",
};

export const RATING_GLYPHS: Record<UserRating, string> = {
  like: "👍",
  dislike: "👎",
  meh: "😐",
};

export function isValidStatus(s: string): s is WatchStatus {
  return (WATCH_STATUSES as readonly string[]).includes(s);
}

export function isValidRating(r: string): r is UserRating {
  return (USER_RATINGS as readonly string[]).includes(r);
}

// currentSeason is only meaningful on Watching / Paused (in-progress states).
// On other statuses it should be null. When provided, must be a positive int.
export function isSeasonValidForStatus(
  status: WatchStatus,
  currentSeason: number | null | undefined,
): boolean {
  if (currentSeason == null) return true;
  if (!Number.isInteger(currentSeason) || currentSeason < 1) return false;
  return status === "watching" || status === "paused";
}

// On a status change away from Watching/Paused, currentSeason should be cleared.
export function shouldClearSeason(nextStatus: WatchStatus): boolean {
  return nextStatus !== "watching" && nextStatus !== "paused";
}

// Phase 42: the subset of WatchEntry fields mirrored between both users
// when a show is co-watched. Ratings and notes are deliberately excluded
// — those are personal taste signals, not shared progress.
export type WatchProgress = {
  status: WatchStatus;
  currentSeason: number | null;
  currentSeasonCompleted: boolean;
};

// "How far along" a watch state is, as a single comparable number.
// Completed dominates everything; watching/paused rank by season then
// the season-completed flag; want_to_watch / dropped count as "not
// started" (a dropped show clears its season — there's no progress to
// resume from).
function progressRank(s: WatchProgress): number {
  switch (s.status) {
    case "completed":
      return 1_000_000;
    case "watching":
    case "paused":
      return (s.currentSeason ?? 1) * 10 + (s.currentSeasonCompleted ? 1 : 0);
    case "want_to_watch":
    case "dropped":
      return 0;
  }
}

// Picks the further-along of two watch states for co-watch sync. When a
// show is first marked co-watched, both profiles snap to this result so
// neither partner loses progress. Ties resolve to `a` (the toggling
// user's own state).
export function furtherAlongProgress(
  a: WatchProgress,
  b: WatchProgress | null,
): WatchProgress {
  if (!b) return a;
  return progressRank(b) > progressRank(a) ? b : a;
}
