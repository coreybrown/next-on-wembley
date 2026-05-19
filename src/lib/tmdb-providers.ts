import type { PlatformKey } from "@/lib/platforms";

// TMDb provider_id values for our 6 Canadian platforms.
// Source: GET /watch/providers/tv?watch_region=CA on TMDb.
//
// TMDb's CA data is uneven: the same Crave/Paramount+/Netflix library
// shows up under multiple provider_ids depending on the access path
// (standalone app, Amazon Channel add-on, Apple TV Channel, ad-supported
// tier, etc.). Anyone who subscribes to the parent service can watch all
// of it regardless of how TMDb tagged it, so every alias maps to the same
// PlatformKey. The 2604 ("Crave Amazon Channel") alias is load-bearing —
// HBO titles like Succession and Westworld only surface under that id in
// CA, not under 230 (plain Crave).
const TMDB_PROVIDER_ID_TO_PLATFORM: Record<number, PlatformKey> = {
  // Netflix
  8: "netflix",
  175: "netflix", // Netflix Kids
  1796: "netflix", // Netflix Standard with Ads
  // Disney+
  337: "disney_plus",
  // Apple TV+
  350: "apple_tv_plus",
  2243: "apple_tv_plus", // Apple TV Amazon Channel
  // Crave
  230: "crave",
  2604: "crave", // Crave Amazon Channel
  // Amazon Prime Video
  119: "prime_video",
  2100: "prime_video", // Amazon Prime Video with Ads
  // Paramount+
  531: "paramount_plus",
  582: "paramount_plus", // Paramount+ Amazon Channel
  1853: "paramount_plus", // Paramount Plus Apple TV Channel
  2303: "paramount_plus", // Paramount Plus Premium
  2304: "paramount_plus", // Paramount Plus Basic with Ads
};

export function tmdbProviderToPlatformKey(
  providerId: number,
): PlatformKey | null {
  return TMDB_PROVIDER_ID_TO_PLATFORM[providerId] ?? null;
}
