import { describe, it, expect } from "vitest";
import {
  parseSeasonsJson,
  episodesRemaining,
  inProgressLabel,
  isUnavailableOnSubscriptions,
  daysSince,
} from "@/lib/in-progress";

describe("parseSeasonsJson", () => {
  it("returns [] for null / undefined / empty", () => {
    expect(parseSeasonsJson(null)).toEqual([]);
    expect(parseSeasonsJson(undefined)).toEqual([]);
    expect(parseSeasonsJson("")).toEqual([]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseSeasonsJson("{bad")).toEqual([]);
    expect(parseSeasonsJson("null")).toEqual([]);
    expect(parseSeasonsJson('{"not":"array"}')).toEqual([]);
  });

  it("keeps only well-shaped entries with positive counts", () => {
    const raw = JSON.stringify([
      { seasonNumber: 1, episodeCount: 9 },
      { seasonNumber: 0, episodeCount: 5 }, // specials, filtered
      { seasonNumber: 2, episodeCount: 0 }, // empty, filtered
      { seasonNumber: 3, episodeCount: 10 },
      { wrong: "shape" },
    ]);
    expect(parseSeasonsJson(raw)).toEqual([
      { seasonNumber: 1, episodeCount: 9 },
      { seasonNumber: 3, episodeCount: 10 },
    ]);
  });

  it("sorts by season number ascending", () => {
    const raw = JSON.stringify([
      { seasonNumber: 3, episodeCount: 10 },
      { seasonNumber: 1, episodeCount: 9 },
      { seasonNumber: 2, episodeCount: 7 },
    ]);
    expect(parseSeasonsJson(raw).map((s) => s.seasonNumber)).toEqual([
      1, 2, 3,
    ]);
  });
});

describe("episodesRemaining", () => {
  const seasons = [
    { seasonNumber: 1, episodeCount: 9 },
    { seasonNumber: 2, episodeCount: 10 },
    { seasonNumber: 3, episodeCount: 10 },
  ];

  it("sums episodes from seasons after currentSeason", () => {
    expect(episodesRemaining(1, seasons, null)).toBe(20);
    expect(episodesRemaining(2, seasons, null)).toBe(10);
    expect(episodesRemaining(3, seasons, null)).toBe(0);
  });

  it("returns 0 when currentSeason equals or exceeds last known season", () => {
    expect(episodesRemaining(3, seasons, null)).toBe(0);
    expect(episodesRemaining(99, seasons, null)).toBe(0);
  });

  it("returns null when currentSeason is missing", () => {
    expect(episodesRemaining(null, seasons, 30)).toBeNull();
    expect(episodesRemaining(undefined, seasons, 30)).toBeNull();
    expect(episodesRemaining(0, seasons, 30)).toBeNull();
  });

  it("returns null when seasons[] is empty and we have no estimate", () => {
    expect(episodesRemaining(2, [], null)).toBeNull();
    expect(episodesRemaining(2, [], 30)).toBeNull(); // intentional per PRD §258
  });
});

describe("inProgressLabel", () => {
  it("renders 'Season X of Y' when totalSeasons known", () => {
    expect(inProgressLabel(2, 3)).toBe("Season 2 of 3");
  });

  it("renders 'Season X, ongoing' when totalSeasons unknown", () => {
    expect(inProgressLabel(2, null)).toBe("Season 2, ongoing");
    expect(inProgressLabel(2, 0)).toBe("Season 2, ongoing");
  });

  it("returns null when currentSeason is missing", () => {
    expect(inProgressLabel(null, 3)).toBeNull();
    expect(inProgressLabel(0, 3)).toBeNull();
  });
});

describe("isUnavailableOnSubscriptions", () => {
  it("false when the show has no providers (unknown availability)", () => {
    expect(isUnavailableOnSubscriptions([], ["netflix"])).toBe(false);
    expect(isUnavailableOnSubscriptions([], [])).toBe(false);
  });

  it("false when any provider overlaps with user subs", () => {
    expect(
      isUnavailableOnSubscriptions(["netflix", "crave"], ["netflix"]),
    ).toBe(false);
    expect(
      isUnavailableOnSubscriptions(["paramount_plus"], ["paramount_plus"]),
    ).toBe(false);
  });

  it("true when providers exist but none match", () => {
    expect(
      isUnavailableOnSubscriptions(["paramount_plus"], ["netflix"]),
    ).toBe(true);
    expect(isUnavailableOnSubscriptions(["netflix"], [])).toBe(true);
  });
});

describe("daysSince", () => {
  it("computes fractional days between two dates", () => {
    const now = new Date("2026-05-20T00:00:00Z");
    const then = new Date("2026-05-13T00:00:00Z");
    expect(daysSince(then, now)).toBe(7);
  });

  it("returns 0 for the same instant", () => {
    const d = new Date();
    expect(daysSince(d, d)).toBe(0);
  });
});
