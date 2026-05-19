import { describe, it, expect } from "vitest";
import { tmdbProviderToPlatformKey } from "@/lib/tmdb-providers";

describe("tmdbProviderToPlatformKey", () => {
  it("maps the 6 known Canadian providers", () => {
    expect(tmdbProviderToPlatformKey(8)).toBe("netflix");
    expect(tmdbProviderToPlatformKey(337)).toBe("disney_plus");
    expect(tmdbProviderToPlatformKey(350)).toBe("apple_tv_plus");
    expect(tmdbProviderToPlatformKey(230)).toBe("crave");
    expect(tmdbProviderToPlatformKey(119)).toBe("prime_video");
    expect(tmdbProviderToPlatformKey(531)).toBe("paramount_plus");
  });

  it("maps channel-variant aliases to the same parent platform", () => {
    // HBO content frequently surfaces only under the Amazon-channel id.
    expect(tmdbProviderToPlatformKey(2604)).toBe("crave");
    // Paramount+ has multiple TMDb tier + channel ids for the same library.
    expect(tmdbProviderToPlatformKey(582)).toBe("paramount_plus");
    expect(tmdbProviderToPlatformKey(1853)).toBe("paramount_plus");
    // Netflix profiles + tiers are content-equivalent for our purposes.
    expect(tmdbProviderToPlatformKey(1796)).toBe("netflix");
    // Amazon's own ad tier.
    expect(tmdbProviderToPlatformKey(2100)).toBe("prime_video");
    // Apple TV+ via Amazon Channel.
    expect(tmdbProviderToPlatformKey(2243)).toBe("apple_tv_plus");
  });

  it("returns null for unknown provider ids", () => {
    expect(tmdbProviderToPlatformKey(9999)).toBeNull();
    expect(tmdbProviderToPlatformKey(0)).toBeNull();
  });
});
