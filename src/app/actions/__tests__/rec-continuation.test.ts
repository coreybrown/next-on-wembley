import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
const mockSession = { userId: undefined as number | undefined };
const mockGetSession = vi.fn(async () => mockSession);
const mockRevalidatePath = vi.fn();
const mockVoteOnRec = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/app/actions/rec-votes", () => ({
  voteOnRecAction: mockVoteOnRec,
}));

const { disagreeOnContinuationAction } = await import(
  "@/app/actions/rec-continuation"
);

beforeEach(() => {
  mockSession.userId = undefined;
  mockRevalidatePath.mockClear();
  mockPrisma.recommendationItem.findUnique.mockReset();
  mockPrisma.watchEntry.findUnique.mockReset();
  mockPrisma.watchEntry.update.mockReset();
  mockVoteOnRec.mockReset().mockResolvedValue({ ok: true });
});

describe("disagreeOnContinuationAction", () => {
  it("rejects unauthenticated callers", async () => {
    expect(await disagreeOnContinuationAction(1, "paused")).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(mockPrisma.watchEntry.update).not.toHaveBeenCalled();
    expect(mockVoteOnRec).not.toHaveBeenCalled();
  });

  it("returns not_found when the rec item is missing", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(null);
    expect(await disagreeOnContinuationAction(999, "paused")).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns no_watch_entry when the viewer doesn't have the show on their list", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: 200,
    } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(null);

    expect(await disagreeOnContinuationAction(42, "paused")).toEqual({
      ok: false,
      error: "no_watch_entry",
    });
    expect(mockPrisma.watchEntry.update).not.toHaveBeenCalled();
    expect(mockVoteOnRec).not.toHaveBeenCalled();
  });

  it("updates the watch entry to paused and records the Disagree vote", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: 200,
    } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce({
      id: 7,
      currentSeason: 2,
    } as never);
    mockPrisma.watchEntry.update.mockResolvedValueOnce({} as never);

    const r = await disagreeOnContinuationAction(42, "paused");

    expect(r).toEqual({ ok: true });
    // Status update + season preserved on Paused.
    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: "paused" },
    });
    expect(mockVoteOnRec).toHaveBeenCalledWith(42, "disagree");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/in-progress");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recs");
  });

  it("clears the season pointer when moving to Dropped (no progress to track)", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: 200,
    } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce({
      id: 7,
      currentSeason: 3,
    } as never);
    mockPrisma.watchEntry.update.mockResolvedValueOnce({} as never);

    await disagreeOnContinuationAction(42, "dropped");

    expect(mockPrisma.watchEntry.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        status: "dropped",
        currentSeason: null,
        currentSeasonCompleted: false,
      },
    });
  });

  it("returns vote_failed when the vote action bails (still attempts the status update first)", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: 200,
    } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce({
      id: 7,
      currentSeason: 1,
    } as never);
    mockPrisma.watchEntry.update.mockResolvedValueOnce({} as never);
    mockVoteOnRec.mockResolvedValueOnce({
      ok: false,
      error: "forbidden",
    });

    const r = await disagreeOnContinuationAction(42, "paused");

    expect(r).toEqual({ ok: false, error: "vote_failed" });
    // Status change still happened — UI sees it on the dashboard.
    expect(mockPrisma.watchEntry.update).toHaveBeenCalled();
  });
});
