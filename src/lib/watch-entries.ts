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
