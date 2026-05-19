import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const { loadShowDetail } = await import("@/lib/show-detail");

beforeEach(() => {
  mockPrisma.show.findUnique.mockReset();
  mockPrisma.userSubscription.findMany.mockReset();
  mockPrisma.recommendationItem.findUnique.mockReset();
  mockPrisma.user.findUnique.mockReset();
  // The co_watch rec-context path resolves the partner via findFirst.
  // Default to null so non-co_watch tests don't have to mock it.
  mockPrisma.user.findFirst.mockReset();
  mockPrisma.user.findFirst.mockResolvedValue(null as never);
});

const showRow = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  tmdbId: 1396,
  title: "Severance",
  overview: "Mark leads a team of office workers whose memories are surgically divided between work and personal lives.",
  posterUrl: null,
  genres: "Drama",
  totalSeasons: 3,
  totalEpisodes: 19,
  seasonsJson: JSON.stringify([
    { seasonNumber: 1, episodeCount: 9 },
    { seasonNumber: 2, episodeCount: 10 },
  ]),
  tmdbRating: 8.7,
  trailerUrl: null,
  productionStatus: "Returning Series",
  providers: [{ platformKey: "apple_tv_plus" }],
  watchEntries: [],
  votes: [],
  ...overrides,
});

describe("loadShowDetail", () => {
  it("returns null when the show is not in the DB", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(null);
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([] as never);
    expect(await loadShowDetail(9999, 1, null)).toBeNull();
  });

  it("flags unavailable when none of the show's providers overlap with active subs", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(showRow() as never);
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([
      { platformKey: "netflix" },
    ] as never);
    const view = await loadShowDetail(1396, 1, null);
    expect(view?.unavailable).toBe(true);
    expect(view?.providerKeys).toEqual(["apple_tv_plus"]);
  });

  it("passes the TMDb overview through to the view", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(showRow() as never);
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([] as never);
    const view = await loadShowDetail(1396, 1, null);
    expect(view?.overview).toMatch(/Mark leads a team/);
  });

  it("computes airedSeasons from seasonsJson (ignores announced-but-unaired)", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(showRow() as never);
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([] as never);
    const view = await loadShowDetail(1396, 1, null);
    expect(view?.airedSeasons).toBe(2);
    expect(view?.totalSeasons).toBe(3);
  });

  it("returns the user's WatchEntry shape when present", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(
      showRow({
        watchEntries: [
          {
            id: 99,
            status: "watching",
            currentSeason: 2,
            currentSeasonCompleted: true,
            userRating: "like",
          },
        ],
      }) as never,
    );
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([] as never);
    const view = await loadShowDetail(1396, 1, null);
    expect(view?.userEntry).toEqual({
      id: 99,
      status: "watching",
      currentSeason: 2,
      currentSeasonCompleted: true,
      userRating: "like",
    });
  });

  it("attaches rec context for a user-scoped list, with the owner's vote", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(
      showRow({
        votes: [
          { userId: 1, vote: "agree" }, // Corey (owner)
          { userId: 2, vote: "disagree" }, // Jaimie (not relevant for "corey" scope)
        ],
      }) as never,
    );
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 77,
      isContinuation: false,
      longExplanation: "Why we like this for Corey.",
      run: { scope: "corey" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1 } as never);

    const view = await loadShowDetail(1396, 1, 77);
    expect(view?.recContext).toEqual({
      itemId: 77,
      isContinuation: false,
      longExplanation: "Why we like this for Corey.",
      currentVote: "agree",
      canVote: true,
      // No partner-vote viz on user-scoped lists.
      partnerVote: null,
      partnerLabel: null,
    });
  });

  it("marks recContext as read-only when partner is viewing the owner's list", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(
      showRow({
        votes: [{ userId: 1, vote: "agree" }], // Corey's
      }) as never,
    );
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 77,
      isContinuation: false,
      longExplanation: "Why we like this for Corey.",
      run: { scope: "corey" },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1 } as never);

    // Jaimie is viewing (userId = 2).
    const view = await loadShowDetail(1396, 2, 77);
    expect(view?.recContext?.canVote).toBe(false);
    expect(view?.recContext?.currentVote).toBe("agree");
  });

  it("co_watch rec context lets the viewer vote with their own id", async () => {
    mockPrisma.show.findUnique.mockResolvedValueOnce(
      showRow({
        votes: [
          { userId: 2, vote: "maybe" }, // Jaimie's vote
          { userId: 1, vote: "agree" }, // Corey (partner) vote
        ],
      }) as never,
    );
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 77,
      isContinuation: true,
      longExplanation: "Co-watch pick.",
      run: { scope: "co_watch" },
    } as never);
    // Partner lookup for partner-viz (M4 Phase 25). Jaimie is viewing
    // → partner is Corey (id=1).
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: 1,
      displayName: "Corey",
    } as never);

    // Jaimie viewing co_watch rec — should see her own vote, can mutate.
    const view = await loadShowDetail(1396, 2, 77);
    expect(view?.recContext?.canVote).toBe(true);
    expect(view?.recContext?.currentVote).toBe("maybe");
    // Partner viz surfaces Corey's vote.
    expect(view?.recContext?.partnerVote).toBe("agree");
    expect(view?.recContext?.partnerLabel).toBe("Corey");
  });
});
