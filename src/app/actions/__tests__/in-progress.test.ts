import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
const mockSession = { userId: undefined as number | undefined };
const mockGetSession = vi.fn(async () => mockSession);
const mockGetTvDetails = vi.fn();
const mockGetTvProviders = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/tmdb", () => ({
  getTvDetails: mockGetTvDetails,
  getTvProviders: mockGetTvProviders,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const {
  bumpSeasonAction,
  finishItAction,
  refreshShowMetadata,
  refreshStaleInProgress,
  refreshStaleAcrossHistory,
} = await import("@/app/actions/in-progress");

beforeEach(() => {
  mockSession.userId = undefined;
  mockGetTvDetails.mockReset();
  mockGetTvProviders.mockReset();
  mockRevalidatePath.mockClear();
  mockPrisma.watchEntry.findUnique.mockReset();
  mockPrisma.watchEntry.update.mockReset();
  mockPrisma.watchEntry.findMany.mockReset();
  mockPrisma.show.findUnique.mockReset();
  mockPrisma.show.update.mockReset();
  mockPrisma.showProvider.deleteMany.mockReset();
  mockPrisma.showProvider.createMany.mockReset();
});

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 7,
  showId: 100,
  status: "watching",
  currentSeason: 2,
  userRating: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  show: {
    id: 100,
    tmdbId: 12,
    title: "Severance",
    totalSeasons: 3,
    lastSyncedAt: new Date(),
  },
  ...overrides,
});

const metadataFixture = {
  tmdbId: 12,
  title: "Severance",
  overview: null,
  posterUrl: null,
  genres: "Drama",
  totalSeasons: 3,
  totalEpisodes: 30,
  seasonsJson: JSON.stringify([{ seasonNumber: 1, episodeCount: 10 }]),
  tmdbRating: 8.7,
  productionStatus: "Returning Series",
};

describe("bumpSeasonAction", () => {
  it("rejects unauthenticated", async () => {
    expect(await bumpSeasonAction(1, 1)).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("rejects invalid deltas", async () => {
    mockSession.userId = 7;
    // @ts-expect-error testing runtime guard
    expect(await bumpSeasonAction(1, 2)).toEqual({
      ok: false,
      error: "invalid_season",
    });
  });

  it("rejects entry owned by another user", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ userId: 99 }) as never,
    );
    expect(await bumpSeasonAction(1, 1)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("rejects when status is not Watching/Paused", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ status: "completed" }) as never,
    );
    expect(await bumpSeasonAction(1, 1)).toEqual({
      ok: false,
      error: "invalid_status",
    });
  });

  it("clamps at season 1 (cannot go to 0)", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ currentSeason: 1 }) as never,
    );
    expect(await bumpSeasonAction(1, -1)).toEqual({
      ok: false,
      error: "invalid_season",
    });
    expect(mockPrisma.watchEntry.update).not.toHaveBeenCalled();
  });

  it("clamps at totalSeasons when known", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ currentSeason: 3, show: { id: 100, totalSeasons: 3 } }) as never,
    );
    expect(await bumpSeasonAction(1, 1)).toEqual({
      ok: false,
      error: "invalid_season",
    });
  });

  it("allows past totalSeasons when totalSeasons is null (ongoing)", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ currentSeason: 5, show: { id: 100, totalSeasons: null } }) as never,
    );
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entry() as never);
    expect(await bumpSeasonAction(1, 1)).toEqual({ ok: true });
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { currentSeason: 6, currentSeasonCompleted: false },
    });
  });

  it("happy path: increments + revalidates both surfaces", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(entry() as never);
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entry() as never);
    expect(await bumpSeasonAction(1, 1)).toEqual({ ok: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/in-progress");
  });
});

describe("setSeasonCompletedAction", () => {
  it("rejects unauthenticated", async () => {
    const { setSeasonCompletedAction } = await import(
      "@/app/actions/in-progress"
    );
    expect(await setSeasonCompletedAction(1, true)).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("rejects when entry is not Watching/Paused", async () => {
    const { setSeasonCompletedAction } = await import(
      "@/app/actions/in-progress"
    );
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ status: "completed" }) as never,
    );
    expect(await setSeasonCompletedAction(1, true)).toEqual({
      ok: false,
      error: "invalid_status",
    });
  });

  it("toggles the flag + revalidates", async () => {
    const { setSeasonCompletedAction } = await import(
      "@/app/actions/in-progress"
    );
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(entry() as never);
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entry() as never);
    expect(await setSeasonCompletedAction(1, true)).toEqual({ ok: true });
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { currentSeasonCompleted: true },
    });
  });
});

describe("finishItAction", () => {
  it("rejects unauthenticated", async () => {
    expect(await finishItAction(1)).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("rejects entry owned by another user", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ userId: 99 }) as never,
    );
    expect(await finishItAction(1)).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects invalid rating", async () => {
    mockSession.userId = 7;
    // @ts-expect-error testing runtime guard
    expect(await finishItAction(1, "LOVE")).toEqual({
      ok: false,
      error: "invalid_rating",
    });
  });

  it("happy path without rating: completes + clears season", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(entry() as never);
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entry() as never);
    await finishItAction(1);
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "completed", currentSeason: null },
    });
  });

  it("happy path with rating: stamps it on the entry", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(entry() as never);
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entry() as never);
    await finishItAction(1, "like");
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "completed", currentSeason: null, userRating: "like" },
    });
  });

  it("does not overwrite existing rating when prompt is skipped (null)", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entry({ userRating: "like" }) as never,
    );
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entry() as never);
    await finishItAction(1, null);
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "completed", currentSeason: null },
    });
  });
});

describe("refreshShowMetadata", () => {
  it("returns false when the show does not exist", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(null);
    expect(await refreshShowMetadata(999)).toBe(false);
  });

  it("returns false (and does not write) on TMDb failure", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce({
      id: 100,
      tmdbId: 12,
    } as never);
    mockGetTvDetails.mockRejectedValueOnce(new Error("boom"));
    mockGetTvProviders.mockResolvedValueOnce([]);
    expect(await refreshShowMetadata(100)).toBe(false);
    expect(mockPrisma.show.update).not.toHaveBeenCalled();
  });

  it("happy path: updates show + replaces providers", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce({
      id: 100,
      tmdbId: 12,
    } as never);
    mockGetTvDetails.mockResolvedValueOnce(metadataFixture);
    mockGetTvProviders.mockResolvedValueOnce([
      { platformKey: "netflix", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.update.mockResolvedValueOnce({} as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.showProvider.createMany.mockResolvedValueOnce({ count: 1 } as never);
    expect(await refreshShowMetadata(100)).toBe(true);
    expect(mockPrisma.show.update).toHaveBeenCalled();
    expect(mockPrisma.showProvider.deleteMany).toHaveBeenCalledWith({
      where: { showId: 100 },
    });
    expect(mockPrisma.showProvider.createMany).toHaveBeenCalledWith({
      data: [
        { showId: 100, platformKey: "netflix", monetizationType: "flatrate" },
      ],
    });
  });
});

describe("refreshStaleInProgress", () => {
  it("returns refreshed=0 when unauthenticated", async () => {
    expect(await refreshStaleInProgress()).toEqual({ refreshed: 0 });
    expect(mockPrisma.watchEntry.findMany).not.toHaveBeenCalled();
  });

  it("skips shows synced within the threshold (with seasonsJson present)", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([
      {
        id: 1,
        show: {
          id: 100,
          lastSyncedAt: new Date(),
          seasonsJson: "[]",
        },
      },
    ] as never);
    expect(await refreshStaleInProgress()).toEqual({ refreshed: 0 });
    expect(mockPrisma.show.findUnique).not.toHaveBeenCalled();
  });

  it("refreshes pre-Phase-6 rows that still have seasonsJson=null, even if fresh", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([
      {
        id: 1,
        show: {
          id: 100,
          lastSyncedAt: new Date(), // very fresh — would normally skip
          seasonsJson: null, // but pre-migration; force refresh
        },
      },
    ] as never);
    mockPrisma.show.findUnique.mockResolvedValueOnce({
      id: 100,
      tmdbId: 12,
    } as never);
    mockGetTvDetails.mockResolvedValueOnce(metadataFixture);
    mockGetTvProviders.mockResolvedValueOnce([]);
    mockPrisma.show.update.mockResolvedValueOnce({} as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValueOnce({ count: 0 } as never);
    expect(await refreshStaleInProgress()).toEqual({ refreshed: 1 });
  });

  it("refreshes stale shows and dedupes by show id", async () => {
    mockSession.userId = 7;
    const stale = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([
      { id: 1, show: { id: 100, lastSyncedAt: stale, seasonsJson: "[]" } },
      { id: 2, show: { id: 100, lastSyncedAt: stale, seasonsJson: "[]" } }, // dup
      { id: 3, show: { id: 200, lastSyncedAt: stale, seasonsJson: "[]" } },
    ] as never);
    // each refresh call: show.findUnique returns truthy, TMDb resolves OK
    mockPrisma.show.findUnique.mockResolvedValue({
      id: 100,
      tmdbId: 12,
    } as never);
    mockGetTvDetails.mockResolvedValue(metadataFixture);
    mockGetTvProviders.mockResolvedValue([]);
    mockPrisma.show.update.mockResolvedValue({} as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValue({ count: 0 } as never);
    const r = await refreshStaleInProgress();
    expect(r.refreshed).toBe(2);
  });
});

describe("refreshStaleAcrossHistory", () => {
  it("returns refreshed=0 when unauthenticated", async () => {
    expect(await refreshStaleAcrossHistory()).toEqual({ refreshed: 0 });
    expect(mockPrisma.watchEntry.findMany).not.toHaveBeenCalled();
  });

  it("spans EVERY status, not just watching/paused (Phase 30)", async () => {
    mockSession.userId = 7;
    const stale = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([
      // Completed entry — refreshStaleInProgress would skip these,
      // but refreshStaleAcrossHistory should include them.
      { id: 1, show: { id: 100, lastSyncedAt: stale, seasonsJson: "[]" } },
      { id: 2, show: { id: 200, lastSyncedAt: stale, seasonsJson: "[]" } },
    ] as never);
    mockPrisma.show.findUnique.mockResolvedValue({
      id: 100,
      tmdbId: 12,
    } as never);
    mockGetTvDetails.mockResolvedValue(metadataFixture);
    mockGetTvProviders.mockResolvedValue([]);
    mockPrisma.show.update.mockResolvedValue({} as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValue({
      count: 0,
    } as never);

    const r = await refreshStaleAcrossHistory();
    expect(r.refreshed).toBe(2);
    // Verify the query DOES NOT filter on status — that's the
    // load-bearing difference vs refreshStaleInProgress.
    const queryArgs = mockPrisma.watchEntry.findMany.mock.calls.at(-1)![0]!;
    expect(queryArgs.where).toEqual({ userId: 7 });
  });

  it("skips shows synced within the threshold", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([
      {
        id: 1,
        show: {
          id: 100,
          lastSyncedAt: new Date(),
          seasonsJson: "[]",
        },
      },
    ] as never);
    expect(await refreshStaleAcrossHistory()).toEqual({ refreshed: 0 });
    expect(mockPrisma.show.findUnique).not.toHaveBeenCalled();
  });
});
