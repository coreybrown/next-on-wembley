import { describe, it, expect } from "vitest";
import { PLATFORMS, isValidPlatformKey } from "@/lib/platforms";

describe("PLATFORMS", () => {
  it("has 5 platforms with distinct keys", () => {
    expect(PLATFORMS).toHaveLength(5);
    expect(new Set(PLATFORMS.map((p) => p.key)).size).toBe(5);
  });

  it("includes the Canadian-subscription baseline (Netflix, Disney+, Apple TV+, Crave, Prime Video)", () => {
    const keys = PLATFORMS.map((p) => p.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "netflix",
        "disney_plus",
        "apple_tv_plus",
        "crave",
        "prime_video",
      ]),
    );
  });
});

describe("isValidPlatformKey", () => {
  it.each(PLATFORMS.map((p) => p.key))("accepts %s", (key) => {
    expect(isValidPlatformKey(key)).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(isValidPlatformKey("hulu")).toBe(false);
    expect(isValidPlatformKey("")).toBe(false);
    expect(isValidPlatformKey("Netflix")).toBe(false);
  });
});
