import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
const mockSession = { userId: undefined as number | undefined };
const mockGetSession = vi.fn(async () => mockSession);
const mockGetTvDetails = vi.fn();
const mockGetTvProviders = vi.fn();
const mockSearchTv = vi.fn();
const mockGenerateStructured = vi.fn();
const mockGetUserContext = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/tmdb", () => ({
  getTvDetails: mockGetTvDetails,
  getTvProviders: mockGetTvProviders,
  searchTv: mockSearchTv,
}));
vi.mock("@/lib/anthropic", () => ({
  generateStructured: mockGenerateStructured,
}));
vi.mock("@/lib/rec-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/rec-context")
  >("@/lib/rec-context");
  return {
    ...actual,
    getUserContext: mockGetUserContext,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const { generateRecommendations, getLatestRunsForCurrentUser } = await import(
  "@/app/actions/recommendations"
);
const { titlesAreCompatible } = await import("@/lib/rec-titles");

describe("titlesAreCompatible", () => {
  it("matches case-insensitively after stripping articles + punctuation", () => {
    expect(titlesAreCompatible("Severance", "severance")).toBe(true);
    expect(titlesAreCompatible("The Bear", "Bear")).toBe(true);
    expect(titlesAreCompatible("M*A*S*H", "mash")).toBe(true);
    expect(titlesAreCompatible("A Million Little Things", "Million Little Things")).toBe(true);
  });

  it("rejects different shows that look similar", () => {
    expect(titlesAreCompatible("Silicon Valley", "Dark")).toBe(false);
    expect(titlesAreCompatible("Severance", "Insecure")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(titlesAreCompatible("", "Severance")).toBe(false);
    expect(titlesAreCompatible("Severance", "")).toBe(false);
  });
});

const baseContext = (overrides: Record<string, unknown> = {}) => ({
  username: "corey",
  displayName: "Corey",
  subscriptions: ["netflix"],
  watchEntries: [],
  recentVotes: [],
  ...overrides,
});

const tmdbDetails = (id: number, title: string) => ({
  tmdbId: id,
  title,
  posterUrl: null,
  genres: "Drama",
  totalSeasons: 1,
  totalEpisodes: 10,
  seasonsJson: null,
  tmdbRating: 8.0,
  productionStatus: "Returning Series",
});

const triggerUserRow = (recModel: "haiku" | "sonnet" = "haiku") => ({
  id: 1,
  username: "corey",
  displayName: "Corey",
  passcodeHash: "x",
  recModel,
  createdAt: new Date(),
});

beforeEach(() => {
  mockSession.userId = undefined;
  mockGetTvDetails.mockReset();
  mockGetTvProviders.mockReset();
  mockSearchTv.mockReset();
  mockGenerateStructured.mockReset();
  mockGetUserContext.mockReset();
  mockRevalidatePath.mockClear();
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.user.findFirst.mockReset();
  mockPrisma.recommendationRun.create.mockReset();
  mockPrisma.recommendationRun.update.mockReset();
  mockPrisma.recommendationItem.createMany.mockReset();
  mockPrisma.show.upsert.mockReset();
  mockPrisma.showProvider.deleteMany.mockReset();
  mockPrisma.showProvider.createMany.mockReset();
});

describe("generateRecommendations — auth & lookup", () => {
  it("rejects unauthenticated", async () => {
    const r = await generateRecommendations("co_watch");
    expect(r).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects when the trigger user is gone", async () => {
    mockSession.userId = 99;
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await generateRecommendations("co_watch")).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("generateRecommendations — Anthropic failure", () => {
  it("persists a failed run and returns anthropic_failed", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(baseContext());
    mockGenerateStructured.mockRejectedValueOnce(new Error("boom"));
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 1 } as never);

    const r = await generateRecommendations("corey");
    expect(r).toEqual({
      ok: false,
      error: "anthropic_failed",
      errorMessage: "boom",
    });
    expect(mockPrisma.recommendationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "boom",
        }),
      }),
    );
  });
});

describe("generateRecommendations — happy path", () => {
  it("validates each rec, upserts the show, and persists 10 items", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(baseContext());
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: Array.from({ length: 10 }, (_, i) => ({
        tmdbId: 100 + i,
        title: `Show ${i}`,
        year: "2024",
        shortExplanation: `short ${i}`,
        longExplanation: `long ${i}`,
        isContinuation: false,
      })),
    });
    // Every tmdbId resolves; every show is on netflix (user's only sub).
    mockGetTvDetails.mockImplementation(async (id) => tmdbDetails(id, `Show ${id - 100}`));
    mockGetTvProviders.mockImplementation(async () => [
      { platformKey: "netflix", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.upsert.mockImplementation(
      (async (args: { where: { tmdbId: number } }) => ({
        id: 500 + args.where.tmdbId,
        tmdbId: args.where.tmdbId,
      })) as never,
    );
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({
      id: 42,
    } as never);

    const r = await generateRecommendations("corey");
    expect(r).toEqual({ ok: true, runId: 42, itemCount: 10 });
    expect(mockPrisma.recommendationItem.createMany).toHaveBeenCalledOnce();
    const payload = (mockPrisma.recommendationItem.createMany.mock.calls[0]![0] as {
      data: Array<unknown>;
    }).data;
    expect(payload).toHaveLength(10);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recs");
  });

  it("hard-excludes new picks with no provider overlap; keeps continuations", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(
      baseContext({
        subscriptions: ["netflix"],
        // T102 is in the user's watch history mid-season, so it's a valid
        // continuation candidate.
        watchEntries: [
          {
            tmdbId: 102,
            title: "T102",
            status: "watching",
            currentSeason: 1,
            currentSeasonCompleted: false,
            rating: null,
            airedSeasons: 2,
          },
        ],
      }),
    );
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        // 1: new pick, netflix → kept
        { tmdbId: 100, title: "T100", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        // 2: new pick, only on apple_tv_plus → dropped
        { tmdbId: 101, title: "T101", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        // 3: continuation, only on apple_tv_plus → kept (badged in UI)
        { tmdbId: 102, title: "T102", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: true },
      ],
    });
    mockGetTvDetails.mockImplementation(async (id) => tmdbDetails(id, `T${id}`));
    mockGetTvProviders.mockImplementation(async (id) => {
      if (id === 100) return [{ platformKey: "netflix", monetizationType: "flatrate" }];
      return [{ platformKey: "apple_tv_plus", monetizationType: "flatrate" }];
    });
    mockPrisma.show.upsert.mockImplementation(
      (async (args: { where: { tmdbId: number } }) => ({
        id: args.where.tmdbId,
        tmdbId: args.where.tmdbId,
      })) as never,
    );
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 1 } as never);

    const r = await generateRecommendations("corey");
    expect(r).toEqual({ ok: true, runId: 1, itemCount: 2 });
    const payload = (mockPrisma.recommendationItem.createMany.mock.calls[0]![0] as {
      data: Array<{ tmdbId: number; isContinuation: boolean; position: number }>;
    }).data;
    expect(payload.map((p) => p.tmdbId)).toEqual([100, 102]);
    expect(payload.map((p) => p.position)).toEqual([1, 2]);
  });

  it("drops continuations when the user finished all aired seasons (Severance-S3-unaired bug)", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(
      baseContext({
        subscriptions: ["netflix"],
        watchEntries: [
          // User caught up: finished aired S2, TMDb has no S3 episodes yet.
          {
            tmdbId: 200,
            title: "Severance",
            status: "watching",
            currentSeason: 2,
            currentSeasonCompleted: true,
            rating: "like",
            airedSeasons: 2,
          },
        ],
      }),
    );
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        { tmdbId: 100, title: "T100", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        { tmdbId: 200, title: "Severance", year: "2022", shortExplanation: "s", longExplanation: "l", isContinuation: true },
      ],
    });
    mockGetTvDetails.mockImplementation(async (id) =>
      tmdbDetails(id, id === 200 ? "Severance" : `T${id}`),
    );
    mockGetTvProviders.mockResolvedValue([
      { platformKey: "netflix", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.upsert.mockImplementation(
      (async (args: { where: { tmdbId: number } }) => ({
        id: args.where.tmdbId,
        tmdbId: args.where.tmdbId,
      })) as never,
    );
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 1 } as never);

    const r = await generateRecommendations("corey");
    expect(r).toEqual({ ok: true, runId: 1, itemCount: 1 });
    const payload = (mockPrisma.recommendationItem.createMany.mock.calls[0]![0] as {
      data: Array<{ tmdbId: number }>;
    }).data;
    expect(payload.map((p) => p.tmdbId)).toEqual([100]);
  });

  it("drops duplicate tmdbIds, keeping the higher-ranked occurrence", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(baseContext({ subscriptions: ["netflix"] }));
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        { tmdbId: 100, title: "T100", year: "2024", shortExplanation: "first", longExplanation: "l", isContinuation: false },
        // Same tmdbId again — should drop with reason duplicate_of_higher_ranked.
        { tmdbId: 100, title: "T100", year: "2024", shortExplanation: "second", longExplanation: "l", isContinuation: false },
        { tmdbId: 200, title: "T200", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
      ],
    });
    mockGetTvDetails.mockImplementation(async (id) => tmdbDetails(id, `T${id}`));
    mockGetTvProviders.mockResolvedValue([
      { platformKey: "netflix", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.upsert.mockImplementation(
      (async (args: { where: { tmdbId: number } }) => ({
        id: args.where.tmdbId,
        tmdbId: args.where.tmdbId,
      })) as never,
    );
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 1 } as never);

    const r = await generateRecommendations("corey");
    expect(r).toEqual({ ok: true, runId: 1, itemCount: 2 });
    const payload = (mockPrisma.recommendationItem.createMany.mock.calls[0]![0] as {
      data: Array<{ tmdbId: number; shortExplanation: string }>;
    }).data;
    expect(payload.map((p) => p.tmdbId)).toEqual([100, 200]);
    // Higher-ranked occurrence's text is the one kept.
    expect(payload[0]!.shortExplanation).toBe("first");
  });

  it("drops continuations the LLM invented for shows not in any user's history", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(baseContext({ subscriptions: ["netflix"] }));
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        { tmdbId: 100, title: "T100", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        // Hallucinated continuation — show isn't in the user's history.
        { tmdbId: 999, title: "T999", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: true },
      ],
    });
    mockGetTvDetails.mockImplementation(async (id) => tmdbDetails(id, `T${id}`));
    mockGetTvProviders.mockResolvedValue([
      { platformKey: "netflix", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.upsert.mockImplementation(
      (async (args: { where: { tmdbId: number } }) => ({
        id: args.where.tmdbId,
        tmdbId: args.where.tmdbId,
      })) as never,
    );
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 1 } as never);

    const r = await generateRecommendations("corey");
    expect(r).toEqual({ ok: true, runId: 1, itemCount: 1 });
    const payload = (mockPrisma.recommendationItem.createMany.mock.calls[0]![0] as {
      data: Array<{ tmdbId: number }>;
    }).data;
    expect(payload.map((p) => p.tmdbId)).toEqual([100]);
  });

  it("falls back to searchTv when the tmdb hint resolves to a DIFFERENT show", async () => {
    // The Silicon-Valley-with-Dark's-blurb scenario: LLM says title="Severance"
    // with a hallucinated tmdbId that resolves to "Silicon Valley". We must
    // reject the hint and fall through to a title search for "Severance".
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(baseContext());
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        {
          tmdbId: 1396,
          title: "Severance",
          year: "2022",
          shortExplanation: "s",
          longExplanation: "l",
          isContinuation: false,
        },
      ],
    });
    // Hint resolves — but to the wrong show.
    mockGetTvDetails.mockResolvedValueOnce(
      tmdbDetails(1396, "Silicon Valley"),
    );
    // Fallback search finds Severance.
    mockSearchTv.mockResolvedValueOnce([
      { tmdbId: 95396, title: "Severance", year: "2022", posterUrl: null },
    ]);
    mockGetTvDetails.mockResolvedValueOnce(tmdbDetails(95396, "Severance"));
    mockGetTvProviders.mockResolvedValueOnce([
      { platformKey: "netflix", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.upsert.mockResolvedValueOnce({
      id: 9,
      tmdbId: 95396,
    } as never);
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({
      id: 7,
    } as never);

    const r = await generateRecommendations("corey");
    expect(r.ok).toBe(true);
    const payload = (mockPrisma.recommendationItem.createMany.mock.calls[0]![0] as {
      data: Array<{ tmdbId: number; title: string }>;
    }).data;
    expect(payload[0]!.tmdbId).toBe(95396);
    expect(payload[0]!.title).toBe("Severance");
  });

  it("falls back to searchTv when the tmdb hint 404s", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(baseContext());
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        { tmdbId: 999_999, title: "Real Show", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
      ],
    });
    // First (hint) call rejects; search returns a different id.
    mockGetTvDetails.mockRejectedValueOnce(new Error("404"));
    mockSearchTv.mockResolvedValueOnce([
      { tmdbId: 555, title: "Real Show", year: "2024", posterUrl: null },
    ]);
    mockGetTvDetails.mockResolvedValueOnce(tmdbDetails(555, "Real Show"));
    mockGetTvProviders.mockResolvedValueOnce([
      { platformKey: "netflix", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.upsert.mockResolvedValueOnce({ id: 9, tmdbId: 555 } as never);
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 7 } as never);

    const r = await generateRecommendations("corey");
    expect(r.ok).toBe(true);
    const payload = (mockPrisma.recommendationItem.createMany.mock.calls[0]![0] as {
      data: Array<{ tmdbId: number }>;
    }).data;
    expect(payload[0]!.tmdbId).toBe(555);
  });

  it("returns no_valid_items + marks the run failed when every rec drops", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockGetUserContext.mockResolvedValueOnce(baseContext());
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        { tmdbId: 999_999, title: "Ghost", year: "", shortExplanation: "s", longExplanation: "l", isContinuation: false },
      ],
    });
    mockGetTvDetails.mockRejectedValue(new Error("404"));
    mockSearchTv.mockResolvedValueOnce([]);
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 8 } as never);

    const r = await generateRecommendations("corey");
    expect(r).toEqual({ ok: false, error: "no_valid_items" });
    expect(mockPrisma.recommendationRun.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: "failed", errorMessage: "no_valid_items" },
    });
  });
});

describe("generateRecommendations — co_watch scope", () => {
  it("pulls both users' contexts and gates by SHARED subscriptions", async () => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockResolvedValueOnce(triggerUserRow() as never);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 2 } as never);
    // Trigger user has netflix+crave; other has netflix+apple. Shared = netflix.
    mockGetUserContext.mockResolvedValueOnce(
      baseContext({ subscriptions: ["netflix", "crave"] }),
    );
    mockGetUserContext.mockResolvedValueOnce(
      baseContext({ subscriptions: ["netflix", "apple_tv_plus"] }),
    );
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        // 1: on netflix (shared) → kept
        { tmdbId: 100, title: "T100", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        // 2: only on crave (trigger only, not shared) → dropped
        { tmdbId: 101, title: "T101", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
      ],
    });
    mockGetTvDetails.mockImplementation(async (id) => tmdbDetails(id, `T${id}`));
    mockGetTvProviders.mockImplementation(async (id) => {
      if (id === 100) return [{ platformKey: "netflix", monetizationType: "flatrate" }];
      return [{ platformKey: "crave", monetizationType: "flatrate" }];
    });
    mockPrisma.show.upsert.mockImplementation(
      (async (args: { where: { tmdbId: number } }) => ({
        id: args.where.tmdbId,
        tmdbId: args.where.tmdbId,
      })) as never,
    );
    mockPrisma.recommendationRun.create.mockResolvedValueOnce({ id: 11 } as never);

    const r = await generateRecommendations("co_watch");
    expect(r).toEqual({ ok: true, runId: 11, itemCount: 1 });
  });
});

describe("getLatestRunsForCurrentUser — disagree filter", () => {
  beforeEach(() => {
    mockPrisma.userSubscription.findMany.mockReset();
    mockPrisma.watchEntry.findMany.mockReset();
    mockPrisma.recommendationRun.findFirst.mockReset();
    // user.findUnique gets called once per username (corey, jaimie) for
    // the owner-vote lookup. Default to deterministic ids: 1=corey, 2=jaimie.
    mockPrisma.user.findUnique.mockImplementation((args: never) => {
      const a = args as { where?: { username?: string } };
      if (a.where?.username === "corey") return { id: 1 } as never;
      if (a.where?.username === "jaimie") return { id: 2 } as never;
      return null as never;
    });
  });

  const runWithItems = (scope: "co_watch" | "corey" | "jaimie") => ({
    id: 1,
    scope,
    modelId: "claude-haiku-4-5",
    mood: null,
    createdAt: new Date("2026-05-19T00:00:00Z"),
    items: [
      {
        id: 10,
        position: 1,
        tmdbId: 100,
        showId: 1000,
        title: "Keeper",
        year: "2024",
        posterUrl: null,
        shortExplanation: "s",
        longExplanation: "l",
        isContinuation: false,
        show: { providers: [{ platformKey: "netflix" }], votes: [] },
      },
      {
        id: 11,
        position: 2,
        tmdbId: 200,
        showId: 1001,
        title: "Disliked",
        year: "2024",
        posterUrl: null,
        shortExplanation: "s",
        longExplanation: "l",
        isContinuation: false,
        show: {
          providers: [{ platformKey: "netflix" }],
          votes: [{ vote: "disagree" }],
        },
      },
      {
        id: 12,
        position: 3,
        tmdbId: 300,
        showId: 1002,
        title: "Still in",
        year: "2024",
        posterUrl: null,
        shortExplanation: "s",
        longExplanation: "l",
        isContinuation: false,
        show: { providers: [{ platformKey: "netflix" }], votes: [] },
      },
    ],
  });

  it("hides disagreed items in user-scoped lists and renumbers positions", async () => {
    mockSession.userId = 7;
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([
      { platformKey: "netflix" },
    ] as never);
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.recommendationRun.findFirst
      .mockResolvedValueOnce(runWithItems("co_watch") as never)
      .mockResolvedValueOnce(runWithItems("corey") as never)
      .mockResolvedValueOnce(null);

    const result = await getLatestRunsForCurrentUser();
    expect(result.corey?.items.map((i) => i.title)).toEqual([
      "Keeper",
      "Still in",
    ]);
    expect(result.corey?.items.map((i) => i.position)).toEqual([1, 2]);
  });

  it("keeps disagreed items visible on the co_watch list (M4's split-rule will handle it)", async () => {
    mockSession.userId = 7;
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([
      { platformKey: "netflix" },
    ] as never);
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.recommendationRun.findFirst
      .mockResolvedValueOnce(runWithItems("co_watch") as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await getLatestRunsForCurrentUser();
    expect(result.co_watch?.items.map((i) => i.title)).toEqual([
      "Keeper",
      "Disliked",
      "Still in",
    ]);
    expect(result.co_watch?.items[1]?.currentVote).toBe("disagree");
  });
});
