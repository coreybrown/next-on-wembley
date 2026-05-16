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

  it("returns null for unknown provider ids", () => {
    expect(tmdbProviderToPlatformKey(9999)).toBeNull();
    expect(tmdbProviderToPlatformKey(0)).toBeNull();
  });
});
