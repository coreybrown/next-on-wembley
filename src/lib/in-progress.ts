import type { SeasonInfo } from "@/lib/tmdb";

export type { SeasonInfo };

// Parse the JSON-encoded seasons array stored on Show.seasonsJson.
// Returns [] if the string is missing, malformed, or contains no
// well-shaped entries. Defensive on purpose — TMDb's payload can change
// and we never want a render to crash on bad data.
export function parseSeasonsJson(raw: string | null | undefined): SeasonInfo[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (s): s is SeasonInfo =>
        typeof s === "object" &&
        s !== null &&
        "seasonNumber" in s &&
        "episodeCount" in s &&
        typeof (s as { seasonNumber: unknown }).seasonNumber === "number" &&
        typeof (s as { episodeCount: unknown }).episodeCount === "number" &&
        (s as SeasonInfo).seasonNumber > 0 &&
        (s as SeasonInfo).episodeCount > 0,
    )
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

// Human-readable progress label that distinguishes mid-season,
// between-seasons (current season finished, more available), and
// caught-up-on-all-released (waiting for next season or series ended).
//   - "Season X of Y" / "Season X, ongoing" when mid-season
//   - "Finished Season X — Season X+1 ready" between seasons
//   - "Caught up — waiting for Season X+1" when at the released ceiling
//     and TMDb hints at more seasons (totalSeasons > releasedCeiling)
//   - "Caught up — series ended" at the ceiling when nothing more is
//     teased (totalSeasons <= releasedCeiling)
//   - null when we don't even know currentSeason — caller falls back.
export function progressLabel(args: {
  currentSeason: number | null | undefined;
  currentSeasonCompleted: boolean;
  totalSeasons: number | null | undefined;
  releasedCeiling: number | null | undefined;
}): string | null {
  const { currentSeason, currentSeasonCompleted, totalSeasons, releasedCeiling } =
    args;
  if (currentSeason == null || currentSeason < 1) return null;

  if (!currentSeasonCompleted) {
    // Denominator should match the stepper's ceiling — released seasons,
    // not TMDb's `number_of_seasons` which can include announced-but-
    // unaired entries. Fall back to totalSeasons only when we have no
    // per-season data at all (very old cache rows).
    const denominator =
      releasedCeiling != null && releasedCeiling > 0
        ? releasedCeiling
        : totalSeasons != null && totalSeasons > 0
          ? totalSeasons
          : null;
    if (denominator != null) {
      return `Season ${currentSeason} of ${denominator}`;
    }
    return `Season ${currentSeason}, ongoing`;
  }

  // Completed-current-season branch.
  if (releasedCeiling == null) {
    return `Finished Season ${currentSeason}`;
  }
  if (currentSeason < releasedCeiling) {
    return `Finished Season ${currentSeason} — Season ${currentSeason + 1} ready`;
  }
  // At or past the released ceiling.
  if (totalSeasons != null && totalSeasons > releasedCeiling) {
    return `Caught up — waiting for Season ${releasedCeiling + 1}`;
  }
  return "Caught up — series ended";
}

// True when the show has at least one Canadian flatrate provider AND
// none of those providers overlap with the user's active subscriptions.
// PRD §105: a show with NO providers is treated as available (we can't
// prove it's unavailable). PRD §163 keeps the entry visible either way.
export function isUnavailableOnSubscriptions(
  showProviderKeys: readonly string[],
  userSubKeys: readonly string[],
): boolean {
  if (showProviderKeys.length === 0) return false;
  const subs = new Set(userSubKeys);
  return !showProviderKeys.some((k) => subs.has(k));
}

// Days since a date; used to gate the metadata refresh in M2 Phase 7.
export function daysSince(when: Date, now: Date = new Date()): number {
  const ms = now.getTime() - when.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

// Highest season number the user can be on. TMDb's `number_of_seasons`
// counts announced-but-unaired seasons (e.g. Severance S3 with
// episode_count: 0, air_date: null), which would let the +/- stepper
// advance into a season nobody can watch yet. The seasons array — already
// filtered to seasonNumber > 0 AND episodeCount > 0 by getTvDetails — is
// the source of truth. Falls back to totalSeasons only when we have no
// per-season data at all (e.g. very old cache row).
export function releasedSeasonsCount(
  seasons: SeasonInfo[],
  totalSeasonsFallback: number | null | undefined,
): number | null {
  if (seasons.length > 0) {
    return seasons[seasons.length - 1].seasonNumber;
  }
  return totalSeasonsFallback ?? null;
}
