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

// Sum episodes from currentSeason + 1 to the end of seasons[].
// Returns null when we genuinely don't know (no seasons data and no
// totalEpisodes fallback) — caller renders "ongoing" copy in that case.
export function episodesRemaining(
  currentSeason: number | null | undefined,
  seasons: SeasonInfo[],
  totalEpisodes: number | null | undefined,
): number | null {
  if (currentSeason == null || currentSeason < 1) return null;
  if (seasons.length > 0) {
    let remaining = 0;
    for (const s of seasons) {
      if (s.seasonNumber > currentSeason) remaining += s.episodeCount;
    }
    return remaining;
  }
  // Fallback: even-distribution estimate from totalEpisodes / totalSeasons.
  // We don't know totalSeasons here without another arg — keep it null
  // unless the caller supplies seasons.
  if (totalEpisodes == null) return null;
  return null;
}

// Human-readable progress label per PRD §258:
//   - "Season X of Y" when totalSeasons known
//   - "Season X, ongoing" when totalSeasons unknown
//   - null when currentSeason is unknown (caller can fall back)
export function inProgressLabel(
  currentSeason: number | null | undefined,
  totalSeasons: number | null | undefined,
): string | null {
  if (currentSeason == null || currentSeason < 1) return null;
  if (totalSeasons != null && totalSeasons > 0) {
    return `Season ${currentSeason} of ${totalSeasons}`;
  }
  return `Season ${currentSeason}, ongoing`;
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
