import type { WatchEntryActionError } from "@/app/actions/watch-entries";

// Phase 36. Single source of truth for user-facing copy on action
// failure codes. Previously each consumer of `WatchEntryActionError`
// shipped its own ERROR_COPY map (add-show-modal, edit-dialog) or
// hand-rolled switch (show-detail-watch-controls) — easy to miss a
// case when a new union variant lands. Defining the map as
// `Record<WatchEntryActionError, string>` makes adding a variant a
// compile error here, not a silent fallback at the use site.

export const WATCH_ENTRY_ERROR_COPY: Record<WatchEntryActionError, string> = {
  unauthorized: "Session expired — please sign in again.",
  not_found: "Entry not found.",
  invalid_status: "Pick a valid status.",
  invalid_rating: "Pick a valid rating.",
  invalid_season: "Current season is only for Watching or Paused.",
  already_added: "Already on your list.",
  tmdb_unavailable: "TMDb is unavailable — try again in a moment.",
};
