import type { PlatformKey } from "@/lib/platforms";

// TMDb provider_id values for our 6 Canadian platforms.
// Source: GET /watch/providers/tv?watch_region=CA on TMDb.
const TMDB_PROVIDER_ID_TO_PLATFORM: Record<number, PlatformKey> = {
  8: "netflix",
  337: "disney_plus",
  350: "apple_tv_plus",
  230: "crave",
  119: "prime_video",
  531: "paramount_plus",
};

export function tmdbProviderToPlatformKey(
  providerId: number,
): PlatformKey | null {
  return TMDB_PROVIDER_ID_TO_PLATFORM[providerId] ?? null;
}
