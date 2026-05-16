import { describe, it, expect } from "vitest";
import {
  WATCH_STATUSES,
  USER_RATINGS,
  STATUS_LABELS,
  RATING_LABELS,
  RATING_GLYPHS,
  isValidStatus,
  isValidRating,
  isSeasonValidForStatus,
  shouldClearSeason,
} from "@/lib/watch-entries";

describe("WATCH_STATUSES", () => {
  it("contains exactly the 5 PRD-locked statuses", () => {
    expect(WATCH_STATUSES).toEqual([
      "want_to_watch",
      "watching",
      "paused",
      "completed",
      "dropped",
    ]);
  });
});

describe("USER_RATINGS", () => {
  it("contains exactly Like / Dislike / Meh", () => {
    expect(USER_RATINGS).toEqual(["like", "dislike", "meh"]);
  });
});

describe("labels & glyphs", () => {
  it("has a label and glyph for every value", () => {
    for (const s of WATCH_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
    for (const r of USER_RATINGS) {
      expect(RATING_LABELS[r]).toBeTruthy();
      expect(RATING_GLYPHS[r]).toBeTruthy();
    }
  });
});

describe("isValidStatus / isValidRating", () => {
  it("accepts known values", () => {
    expect(isValidStatus("watching")).toBe(true);
    expect(isValidRating("like")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidStatus("WATCHING")).toBe(false);
    expect(isValidStatus("on_hold")).toBe(false);
    expect(isValidRating("LOVE")).toBe(false);
    expect(isValidRating("")).toBe(false);
  });
});

describe("isSeasonValidForStatus", () => {
  it("null / undefined season is always valid", () => {
    for (const s of WATCH_STATUSES) {
      expect(isSeasonValidForStatus(s, null)).toBe(true);
      expect(isSeasonValidForStatus(s, undefined)).toBe(true);
    }
  });

  it("positive integer season valid only on watching/paused", () => {
    expect(isSeasonValidForStatus("watching", 3)).toBe(true);
    expect(isSeasonValidForStatus("paused", 1)).toBe(true);
    expect(isSeasonValidForStatus("want_to_watch", 1)).toBe(false);
    expect(isSeasonValidForStatus("completed", 1)).toBe(false);
    expect(isSeasonValidForStatus("dropped", 1)).toBe(false);
  });

  it("non-positive or non-integer seasons are rejected", () => {
    expect(isSeasonValidForStatus("watching", 0)).toBe(false);
    expect(isSeasonValidForStatus("watching", -1)).toBe(false);
    expect(isSeasonValidForStatus("watching", 1.5)).toBe(false);
  });
});

describe("shouldClearSeason", () => {
  it("preserves season on watching/paused", () => {
    expect(shouldClearSeason("watching")).toBe(false);
    expect(shouldClearSeason("paused")).toBe(false);
  });
  it("clears season on other statuses", () => {
    expect(shouldClearSeason("want_to_watch")).toBe(true);
    expect(shouldClearSeason("completed")).toBe(true);
    expect(shouldClearSeason("dropped")).toBe(true);
  });
});
