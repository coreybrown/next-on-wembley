import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const { getUserContext, intersectSubscriptions } = await import(
  "@/lib/rec-context"
);

beforeEach(() => {
  mockPrisma.user.findUnique.mockReset();
});

describe("getUserContext", () => {
  it("returns null when the user doesn't exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await getUserContext(99)).toBeNull();
  });

  it("flattens subs, watch entries, and recent votes into a single context", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "corey",
      displayName: "Corey",
      subscriptions: [{ platformKey: "netflix" }, { platformKey: "crave" }],
      watchEntries: [
        {
          status: "watching",
          currentSeason: 2,
          currentSeasonCompleted: false,
          userRating: "like",
          show: {
            tmdbId: 95396,
            title: "Severance",
            productionStatus: "Returning Series",
            // S3 announced but not aired — seasonsJson only has S1+S2.
            seasonsJson: JSON.stringify([
              { seasonNumber: 1, episodeCount: 9 },
              { seasonNumber: 2, episodeCount: 10 },
            ]),
          },
        },
      ],
      showVotes: [
        { vote: "disagree", show: { title: "Yellowstone" } },
        { vote: "agree", show: { title: "The Sopranos" } },
      ],
    } as never);

    const ctx = await getUserContext(7);
    expect(ctx).toEqual({
      username: "corey",
      displayName: "Corey",
      subscriptions: ["netflix", "crave"],
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
      ],
      recentVotes: [
        { title: "Yellowstone", vote: "disagree" },
        { title: "The Sopranos", vote: "agree" },
      ],
    });
  });

  it("queries with a recent-votes limit (don't fire-hose the prompt)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "corey",
      displayName: "Corey",
      subscriptions: [],
      watchEntries: [],
      showVotes: [],
    } as never);
    await getUserContext(7);
    const call = mockPrisma.user.findUnique.mock.calls[0]![0];
    expect(call?.select?.showVotes).toMatchObject({ take: expect.any(Number) });
  });
});

describe("intersectSubscriptions", () => {
  it("returns the intersection preserving the order of the first arg", () => {
    expect(
      intersectSubscriptions(["netflix", "crave", "apple_tv_plus"], [
        "apple_tv_plus",
        "netflix",
      ]),
    ).toEqual(["netflix", "apple_tv_plus"]);
  });

  it("returns [] when nothing overlaps", () => {
    expect(intersectSubscriptions(["netflix"], ["crave"])).toEqual([]);
  });
});
