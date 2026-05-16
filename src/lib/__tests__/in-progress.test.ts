import { describe, it, expect } from "vitest";
import {
  parseSeasonsJson,
  episodesRemaining,
  progressLabel,
  isUnavailableOnSubscriptions,
  daysSince,
  releasedSeasonsCount,
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

describe("progressLabel", () => {
  it("mid-season denominator is the released ceiling, not totalSeasons", () => {
    // Severance case: TMDb totalSeasons=3 (S3 announced), released ceiling=2.
    // The label must match what the stepper allows.
    expect(
      progressLabel({
        currentSeason: 2,
        currentSeasonCompleted: false,
        totalSeasons: 3,
        releasedCeiling: 2,
      }),
    ).toBe("Season 2 of 2");
  });

  it("mid-season falls back to totalSeasons when releasedCeiling is unknown", () => {
    expect(
      progressLabel({
        currentSeason: 1,
        currentSeasonCompleted: false,
        totalSeasons: 3,
        releasedCeiling: null,
      }),
    ).toBe("Season 1 of 3");
  });

  it("mid-season with totalSeasons unknown", () => {
    expect(
      progressLabel({
        currentSeason: 2,
        currentSeasonCompleted: false,
        totalSeasons: null,
        releasedCeiling: null,
      }),
    ).toBe("Season 2, ongoing");
  });

  it("finished current season, more released available", () => {
    expect(
      progressLabel({
        currentSeason: 1,
        currentSeasonCompleted: true,
        totalSeasons: 3,
        releasedCeiling: 2,
      }),
    ).toBe("Finished Season 1 — Season 2 ready");
  });

  it("caught up at released ceiling with more announced (Severance case)", () => {
    expect(
      progressLabel({
        currentSeason: 2,
        currentSeasonCompleted: true,
        totalSeasons: 3, // S3 announced but unaired
        releasedCeiling: 2,
      }),
    ).toBe("Caught up — waiting for Season 3");
  });

  it("caught up at ceiling, nothing more teased — series ended", () => {
    expect(
      progressLabel({
        currentSeason: 3,
        currentSeasonCompleted: true,
        totalSeasons: 3,
        releasedCeiling: 3,
      }),
    ).toBe("Caught up — series ended");
  });

  it("finished current season but no released ceiling known", () => {
    expect(
      progressLabel({
        currentSeason: 2,
        currentSeasonCompleted: true,
        totalSeasons: null,
        releasedCeiling: null,
      }),
    ).toBe("Finished Season 2");
  });

  it("returns null when currentSeason is missing", () => {
    expect(
      progressLabel({
        currentSeason: null,
        currentSeasonCompleted: false,
        totalSeasons: 3,
        releasedCeiling: 2,
      }),
    ).toBeNull();
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

describe("releasedSeasonsCount", () => {
  it("returns the max season number from seasons[] when available", () => {
    const seasons = [
      { seasonNumber: 1, episodeCount: 9 },
      { seasonNumber: 2, episodeCount: 10 },
    ];
    expect(releasedSeasonsCount(seasons, 3)).toBe(2);
  });

  it("ignores totalSeasons (which may include unaired) when seasons[] is present", () => {
    // Severance scenario: TMDb says 3 seasons, but S3 is unaired
    // (episode_count: 0) and filtered out, so seasons[] only has S1/S2.
    const seasons = [
      { seasonNumber: 1, episodeCount: 9 },
      { seasonNumber: 2, episodeCount: 10 },
    ];
    expect(releasedSeasonsCount(seasons, 3)).toBe(2);
  });

  it("falls back to totalSeasons when seasons[] is empty", () => {
    expect(releasedSeasonsCount([], 2)).toBe(2);
  });

  it("returns null when both seasons[] and totalSeasons are empty/null", () => {
    expect(releasedSeasonsCount([], null)).toBeNull();
    expect(releasedSeasonsCount([], undefined)).toBeNull();
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
