import { describe, it, expect } from "vitest";
import { tmdbProviderToPlatformKey } from "@/lib/tmdb-providers";

describe("tmdbProviderToPlatformKey", () => {
  it("maps the 5 known Canadian providers", () => {
    expect(tmdbProviderToPlatformKey(8)).toBe("netflix");
    expect(tmdbProviderToPlatformKey(337)).toBe("disney_plus");
    expect(tmdbProviderToPlatformKey(350)).toBe("apple_tv_plus");
    expect(tmdbProviderToPlatformKey(230)).toBe("crave");
    expect(tmdbProviderToPlatformKey(119)).toBe("prime_video");
  });

  it("returns null for unknown provider ids (incl. Paramount+ 531 — deferred)", () => {
    expect(tmdbProviderToPlatformKey(531)).toBeNull();
    expect(tmdbProviderToPlatformKey(9999)).toBeNull();
  });
});
