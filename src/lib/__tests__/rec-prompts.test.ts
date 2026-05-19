import { describe, it, expect } from "vitest";
import {
  REC_SYSTEM_PROMPT,
  buildUserPrompt,
  RECOMMENDATIONS_SCHEMA,
  type UserContext,
} from "@/lib/rec-prompts";

const corey: UserContext = {
  username: "corey",
  displayName: "Corey",
  subscriptions: ["netflix", "apple_tv_plus"],
  watchEntries: [
    {
      tmdbId: 95396,
      title: "Severance",
      status: "watching",
      currentSeason: 2,
      currentSeasonCompleted: false,
      rating: "like",
      airedSeasons: 2,
    },
    {
      tmdbId: 136315,
      title: "The Bear",
      status: "completed",
      currentSeason: null,
      currentSeasonCompleted: false,
      rating: "like",
      airedSeasons: 3,
    },
  ],
  recentVotes: [
    { title: "The Sopranos", vote: "agree" },
    { title: "Yellowstone", vote: "disagree" },
  ],
};

const jaimie: UserContext = {
  username: "jaimie",
  displayName: "Jaimie",
  subscriptions: ["netflix", "crave"],
  watchEntries: [
    {
      tmdbId: 124364,
      title: "Shogun",
      status: "completed",
      currentSeason: null,
      currentSeasonCompleted: false,
      rating: "like",
      airedSeasons: 1,
    },
  ],
  recentVotes: [],
};

describe("REC_SYSTEM_PROMPT", () => {
  it("is stable across calls (load-bearing for prompt caching)", () => {
    // Read it twice; must be byte-identical. Any timestamp / random
    // interpolation here would break the 5-min cache.
    const a = REC_SYSTEM_PROMPT;
    const b = REC_SYSTEM_PROMPT;
    expect(a).toBe(b);
  });

  it("defers the candidate count to the user prompt and declares the JSON-only constraint", () => {
    // System prompt stays generic so per-scope counts (10 for personal,
    // 25 for co-watch) can vary without invalidating the prompt cache.
    expect(REC_SYSTEM_PROMPT).toMatch(/the user prompt requests/i);
    expect(REC_SYSTEM_PROMPT).toMatch(/canada/i);
    expect(REC_SYSTEM_PROMPT).toMatch(/no prose|only the json|no preamble/i);
  });

  it("forbids platform name-drops in explanations", () => {
    expect(REC_SYSTEM_PROMPT).toMatch(/do not mention.*platform/i);
    expect(REC_SYSTEM_PROMPT).toMatch(/netflix.*crave.*apple/i);
  });

  it("requires coherence between tmdbId / title / explanations", () => {
    expect(REC_SYSTEM_PROMPT).toMatch(/same show/i);
  });

  it("describes the three list scopes", () => {
    expect(REC_SYSTEM_PROMPT).toMatch(/co_watch/);
    expect(REC_SYSTEM_PROMPT).toMatch(/corey/i);
    expect(REC_SYSTEM_PROMPT).toMatch(/jaimie/i);
  });
});

describe("buildUserPrompt", () => {
  it("co_watch includes both display names and shared subs", () => {
    const out = buildUserPrompt({
      scope: "co_watch",
      primary: corey,
      other: jaimie,
      sharedSubscriptions: ["netflix"],
    });
    expect(out).toContain("List: co_watch");
    expect(out).toContain("Corey");
    expect(out).toContain("Jaimie");
    expect(out).toContain("Shared active subscriptions");
    expect(out).toContain("netflix");
  });

  it("co_watch includes both users' watch histories", () => {
    const out = buildUserPrompt({
      scope: "co_watch",
      primary: corey,
      other: jaimie,
      sharedSubscriptions: ["netflix"],
    });
    expect(out).toContain("Severance");
    expect(out).toContain("Shogun");
    expect(out).toContain("status=Watching");
    expect(out).toContain("season=2");
  });

  it("co_watch includes vote signals from both users", () => {
    const out = buildUserPrompt({
      scope: "co_watch",
      primary: corey,
      other: jaimie,
      sharedSubscriptions: [],
    });
    expect(out).toContain("Yellowstone");
    expect(out).toContain("Disagree");
  });

  it("co_watch throws without an `other` user", () => {
    expect(() =>
      buildUserPrompt({ scope: "co_watch", primary: corey }),
    ).toThrow(/other.*context/i);
  });

  it("user-scope prompt has only the primary user's data", () => {
    const out = buildUserPrompt({ scope: "corey", primary: corey });
    expect(out).toContain("Corey");
    expect(out).not.toContain("Shogun"); // Jaimie's show
    expect(out).not.toContain("Shared active subscriptions");
  });

  it("renders '(none yet)' for empty history + votes", () => {
    const empty: UserContext = {
      ...corey,
      watchEntries: [],
      recentVotes: [],
    };
    const out = buildUserPrompt({ scope: "corey", primary: empty });
    expect(out).toMatch(/none yet/i);
  });

  it("flags zero subscriptions explicitly", () => {
    const noSubs: UserContext = { ...corey, subscriptions: [] };
    const out = buildUserPrompt({ scope: "corey", primary: noSubs });
    expect(out).toMatch(/every show will be unavailable/i);
  });

  it("includes the mood line when provided", () => {
    const out = buildUserPrompt({
      scope: "corey",
      primary: corey,
      mood: "Something dark and slow-paced",
    });
    expect(out).toContain("Mood: Something dark and slow-paced");
  });

  it("omits the mood line for empty/whitespace input", () => {
    const out = buildUserPrompt({ scope: "corey", primary: corey, mood: "   " });
    expect(out).not.toMatch(/^Mood:/m);
  });

  it("trailing instruction reinforces the requested candidate count (default)", () => {
    const out = buildUserPrompt({ scope: "corey", primary: corey });
    expect(out).toMatch(/exactly 16.*candidate/i);
  });

  it("respects an explicit candidateCount (e.g. co-watch's larger pool)", () => {
    const out = buildUserPrompt({
      scope: "co_watch",
      primary: corey,
      other: jaimie,
      sharedSubscriptions: ["netflix"],
      candidateCount: 32,
    });
    expect(out).toMatch(/exactly 32.*candidate/i);
  });

  it("includes a 'Vote combinations on shared shows' section for co-watch when given (Phase 26)", () => {
    const out = buildUserPrompt({
      scope: "co_watch",
      primary: corey,
      other: jaimie,
      sharedSubscriptions: [],
      voteCombinations: [
        { title: "The Sopranos", primaryVote: "agree", otherVote: "disagree" },
        { title: "Yellowstone", primaryVote: "disagree", otherVote: "disagree" },
      ],
    });
    expect(out).toMatch(/vote combinations on shared shows/i);
    expect(out).toContain("The Sopranos: Corey: Agree, Jaimie: Disagree");
    expect(out).toContain("Yellowstone: Corey: Disagree, Jaimie: Disagree");
  });

  it("omits the Vote-combinations section for user-scoped lists", () => {
    const out = buildUserPrompt({
      scope: "corey",
      primary: corey,
      voteCombinations: [
        { title: "Anything", primaryVote: "agree", otherVote: "agree" },
      ],
    });
    expect(out).not.toMatch(/vote combinations on shared shows/i);
  });

  it("system prompt teaches the co-watch split rule (Phase 26)", () => {
    expect(REC_SYSTEM_PROMPT).toMatch(/co-watch split rule/i);
    expect(REC_SYSTEM_PROMPT).toMatch(/agree \+ disagree.*demote/i);
  });
});

describe("RECOMMENDATIONS_SCHEMA", () => {
  it("has every required field for an item", () => {
    const itemProps = (
      RECOMMENDATIONS_SCHEMA.properties.recommendations.items
        .properties
    ) as Record<string, unknown>;
    expect(Object.keys(itemProps).sort()).toEqual([
      "isContinuation",
      "longExplanation",
      "shortExplanation",
      "title",
      "tmdbId",
      "year",
    ]);
  });

  it("forbids additionalProperties at every object level", () => {
    expect(RECOMMENDATIONS_SCHEMA.additionalProperties).toBe(false);
    expect(
      RECOMMENDATIONS_SCHEMA.properties.recommendations.items
        .additionalProperties,
    ).toBe(false);
  });
});
