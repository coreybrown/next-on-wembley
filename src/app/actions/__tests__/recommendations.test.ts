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

const { generateRecommendations } = await import(
  "@/app/actions/recommendations"
);

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
    expect(r).toEqual({ ok: false, error: "anthropic_failed" });
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
    mockGetUserContext.mockResolvedValueOnce(baseContext({ subscriptions: ["netflix"] }));
    mockGenerateStructured.mockResolvedValueOnce({
      recommendations: [
        // 1: new pick, netflix → kept
        { tmdbId: 100, title: "A", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        // 2: new pick, only on apple_tv_plus → dropped
        { tmdbId: 101, title: "B", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        // 3: continuation, only on apple_tv_plus → kept (badged in UI)
        { tmdbId: 102, title: "C", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: true },
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
        { tmdbId: 100, title: "A", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
        // 2: only on crave (trigger only, not shared) → dropped
        { tmdbId: 101, title: "B", year: "2024", shortExplanation: "s", longExplanation: "l", isContinuation: false },
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
