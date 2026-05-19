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
  addWatchEntry,
  updateWatchEntry,
  deleteWatchEntry,
  getWatchEntries,
} = await import("@/app/actions/watch-entries");

beforeEach(() => {
  mockSession.userId = undefined;
  mockGetTvDetails.mockReset();
  mockGetTvProviders.mockReset();
  mockRevalidatePath.mockClear();
  // Re-init prisma mock between tests
  for (const m of Object.values(mockPrisma)) {
    if (m && typeof m === "object" && "mockReset" in m) {
      // top-level method, skip
    }
  }
  mockPrisma.show.upsert.mockReset();
  mockPrisma.showProvider.deleteMany.mockReset();
  mockPrisma.showProvider.createMany.mockReset();
  mockPrisma.watchEntry.findUnique.mockReset();
  mockPrisma.watchEntry.create.mockReset();
  mockPrisma.watchEntry.update.mockReset();
  mockPrisma.watchEntry.delete.mockReset();
  mockPrisma.watchEntry.findMany.mockReset();
});

const metadataFixture = {
  tmdbId: 12,
  title: "Severance",
  overview: null,
  posterUrl: "https://image.tmdb.org/p.jpg",
  genres: "Drama, Sci-Fi",
  totalSeasons: 2,
  totalEpisodes: 19,
  tmdbRating: 8.7,
  productionStatus: "Returning Series",
};

const showRow = { id: 100, tmdbId: 12 } as { id: number; tmdbId: number };

const entryRow = (overrides: Partial<{
  id: number;
  userId: number;
  showId: number;
  status: string;
  currentSeason: number | null;
  userRating: string | null;
}> = {}) => ({
  id: 1,
  userId: 7,
  showId: 100,
  status: "watching",
  currentSeason: 2,
  userRating: null,
  notes: null,
  show: {
    id: 100,
    tmdbId: 12,
    totalSeasons: null,
    seasonsJson: null,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("addWatchEntry", () => {
  it("rejects unauthenticated", async () => {
    const r = await addWatchEntry({ tmdbId: 1, status: "want_to_watch" });
    expect(r).toEqual({ ok: false, error: "unauthorized" });
    expect(mockGetTvDetails).not.toHaveBeenCalled();
  });

  it("rejects invalid status", async () => {
    mockSession.userId = 7;
    const r = await addWatchEntry({
      tmdbId: 1,
      // @ts-expect-error testing runtime guard
      status: "WATCHING",
    });
    expect(r).toEqual({ ok: false, error: "invalid_status" });
  });

  it("rejects season set on a non-in-progress status", async () => {
    mockSession.userId = 7;
    const r = await addWatchEntry({
      tmdbId: 1,
      status: "want_to_watch",
      currentSeason: 2,
    });
    expect(r).toEqual({ ok: false, error: "invalid_season" });
  });

  it("rejects invalid rating", async () => {
    mockSession.userId = 7;
    const r = await addWatchEntry({
      tmdbId: 1,
      status: "want_to_watch",
      // @ts-expect-error testing runtime guard
      userRating: "love",
    });
    expect(r).toEqual({ ok: false, error: "invalid_rating" });
  });

  it("returns tmdb_unavailable when TMDb fails", async () => {
    mockSession.userId = 7;
    mockGetTvDetails.mockRejectedValueOnce(new Error("boom"));
    mockGetTvProviders.mockResolvedValueOnce([]);
    const r = await addWatchEntry({ tmdbId: 1, status: "want_to_watch" });
    expect(r).toEqual({ ok: false, error: "tmdb_unavailable" });
  });

  it("rejects duplicates", async () => {
    mockSession.userId = 7;
    mockGetTvDetails.mockResolvedValueOnce(metadataFixture);
    mockGetTvProviders.mockResolvedValueOnce([]);
    mockPrisma.show.upsert.mockResolvedValueOnce(showRow as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow() as never,
    );
    const r = await addWatchEntry({ tmdbId: 12, status: "want_to_watch" });
    expect(r).toEqual({ ok: false, error: "already_added" });
    expect(mockPrisma.watchEntry.create).not.toHaveBeenCalled();
  });

  it("happy path: upserts show, writes providers, creates entry, revalidates", async () => {
    mockSession.userId = 7;
    mockGetTvDetails.mockResolvedValueOnce(metadataFixture);
    mockGetTvProviders.mockResolvedValueOnce([
      { platformKey: "netflix", monetizationType: "flatrate" },
      { platformKey: "crave", monetizationType: "flatrate" },
    ]);
    mockPrisma.show.upsert.mockResolvedValueOnce(showRow as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.showProvider.createMany.mockResolvedValueOnce({ count: 2 } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(null);
    mockPrisma.watchEntry.create.mockResolvedValueOnce(entryRow() as never);

    const r = await addWatchEntry({
      tmdbId: 12,
      status: "watching",
      currentSeason: 2,
      userRating: "like",
    });
    expect(r).toEqual({ ok: true });

    expect(mockPrisma.show.upsert).toHaveBeenCalledOnce();
    expect(mockPrisma.showProvider.deleteMany).toHaveBeenCalledWith({
      where: { showId: 100 },
    });
    expect(mockPrisma.showProvider.createMany).toHaveBeenCalledWith({
      data: [
        {
          showId: 100,
          platformKey: "netflix",
          monetizationType: "flatrate",
        },
        {
          showId: 100,
          platformKey: "crave",
          monetizationType: "flatrate",
        },
      ],
    });
    expect(mockPrisma.watchEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 7,
        showId: 100,
        status: "watching",
        currentSeason: 2,
        userRating: "like",
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("clears season when status is not watching/paused", async () => {
    mockSession.userId = 7;
    mockGetTvDetails.mockResolvedValueOnce(metadataFixture);
    mockGetTvProviders.mockResolvedValueOnce([]);
    mockPrisma.show.upsert.mockResolvedValueOnce(showRow as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(null);
    mockPrisma.watchEntry.create.mockResolvedValueOnce(entryRow() as never);

    await addWatchEntry({ tmdbId: 12, status: "completed" });
    expect(mockPrisma.watchEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentSeason: null }),
      }),
    );
  });

  it("skips provider createMany when TMDb returns no flatrate providers", async () => {
    mockSession.userId = 7;
    mockGetTvDetails.mockResolvedValueOnce(metadataFixture);
    mockGetTvProviders.mockResolvedValueOnce([]);
    mockPrisma.show.upsert.mockResolvedValueOnce(showRow as never);
    mockPrisma.showProvider.deleteMany.mockResolvedValueOnce({ count: 0 } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(null);
    mockPrisma.watchEntry.create.mockResolvedValueOnce(entryRow() as never);

    await addWatchEntry({ tmdbId: 12, status: "want_to_watch" });
    expect(mockPrisma.showProvider.createMany).not.toHaveBeenCalled();
  });
});

describe("updateWatchEntry", () => {
  it("rejects unauthenticated", async () => {
    const r = await updateWatchEntry({ id: 1, status: "watching" });
    expect(r).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects when entry is missing", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(null);
    const r = await updateWatchEntry({ id: 9 });
    expect(r).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects when entry belongs to a different user", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow({ userId: 99 }) as never,
    );
    const r = await updateWatchEntry({ id: 1, status: "completed" });
    expect(r).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects invalid status", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow() as never,
    );
    const r = await updateWatchEntry({
      id: 1,
      // @ts-expect-error testing runtime guard
      status: "ON_HOLD",
    });
    expect(r).toEqual({ ok: false, error: "invalid_status" });
  });

  it("rejects season invalid for the resulting status", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow({ status: "watching", currentSeason: 1 }) as never,
    );
    // patch only the season (status stays "watching"): non-integer season
    const r = await updateWatchEntry({ id: 1, currentSeason: 0 });
    expect(r).toEqual({ ok: false, error: "invalid_season" });
  });

  it("clears currentSeason on transition away from watching/paused", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow({ status: "watching", currentSeason: 2 }) as never,
    );
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entryRow() as never);
    await updateWatchEntry({ id: 1, status: "completed" });
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "completed", currentSeason: null },
    });
  });

  it("happy path: applies patch + revalidates", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow() as never,
    );
    mockPrisma.watchEntry.update.mockResolvedValueOnce(entryRow() as never);
    const r = await updateWatchEntry({ id: 1, userRating: "like" });
    expect(r).toEqual({ ok: true });
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { userRating: "like" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("deleteWatchEntry", () => {
  it("rejects unauthenticated", async () => {
    const r = await deleteWatchEntry(1);
    expect(r).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects missing entry", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(null);
    const r = await deleteWatchEntry(1);
    expect(r).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects entry owned by another user", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow({ userId: 99 }) as never,
    );
    const r = await deleteWatchEntry(1);
    expect(r).toEqual({ ok: false, error: "not_found" });
    expect(mockPrisma.watchEntry.delete).not.toHaveBeenCalled();
  });

  it("happy path: deletes + revalidates", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(
      entryRow() as never,
    );
    mockPrisma.watchEntry.delete.mockResolvedValueOnce(entryRow() as never);
    const r = await deleteWatchEntry(1);
    expect(r).toEqual({ ok: true });
    expect(mockPrisma.watchEntry.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("getWatchEntries", () => {
  it("returns [] for unauthenticated", async () => {
    expect(await getWatchEntries()).toEqual([]);
    expect(mockPrisma.watchEntry.findMany).not.toHaveBeenCalled();
  });

  it("queries by userId and includes show", async () => {
    mockSession.userId = 7;
    mockPrisma.watchEntry.findMany.mockResolvedValueOnce([] as never);
    await getWatchEntries();
    expect(mockPrisma.watchEntry.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      include: { show: true },
      orderBy: [{ updatedAt: "desc" }],
    });
  });
});
