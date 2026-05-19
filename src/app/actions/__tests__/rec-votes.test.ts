import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
const mockSession = { userId: undefined as number | undefined };
const mockGetSession = vi.fn(async () => mockSession);
const mockRevalidatePath = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const { voteOnRecAction, clearVoteAction } = await import(
  "@/app/actions/rec-votes"
);

beforeEach(() => {
  mockSession.userId = undefined;
  mockRevalidatePath.mockClear();
  mockPrisma.recommendationItem.findUnique.mockReset();
  mockPrisma.recommendationVote.upsert.mockReset();
  mockPrisma.recommendationVote.deleteMany.mockReset();
  mockPrisma.user.findUnique.mockReset();
});

const coWatchItem = (id = 42) => ({ id, run: { scope: "co_watch" } });
const userScopedItem = (scope: "corey" | "jaimie", id = 42) => ({
  id,
  run: { scope },
});

describe("voteOnRecAction", () => {
  it("rejects unauthenticated callers", async () => {
    expect(await voteOnRecAction(1, "agree")).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(mockPrisma.recommendationVote.upsert).not.toHaveBeenCalled();
  });

  it("returns not_found when the rec item is missing", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(null);
    expect(await voteOnRecAction(999, "agree")).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(mockPrisma.recommendationVote.upsert).not.toHaveBeenCalled();
  });

  it("rejects with forbidden when the viewer doesn't own a user-scoped list", async () => {
    // Jaimie (userId=2) tries to vote on a Corey-scoped item.
    mockSession.userId = 2;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(
      userScopedItem("corey") as never,
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1 } as never);

    expect(await voteOnRecAction(42, "agree")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mockPrisma.recommendationVote.upsert).not.toHaveBeenCalled();
  });

  it("upserts under the OWNER's userId for user-scoped lists", async () => {
    // Corey (userId=1) voting on his own scope-corey item.
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(
      userScopedItem("corey") as never,
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1 } as never);

    const r = await voteOnRecAction(42, "agree");

    expect(r).toEqual({ ok: true });
    expect(mockPrisma.recommendationVote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemId_userId: { itemId: 42, userId: 1 } },
        create: { itemId: 42, userId: 1, vote: "agree" },
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recs");
  });

  it("co_watch scope lets either user vote under their own id", async () => {
    mockSession.userId = 2;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(
      coWatchItem() as never,
    );

    const r = await voteOnRecAction(42, "maybe");

    expect(r).toEqual({ ok: true });
    expect(mockPrisma.recommendationVote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { itemId: 42, userId: 2, vote: "maybe" },
      }),
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("bumps createdAt on re-vote so recent-votes prompt slice stays accurate", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(
      coWatchItem() as never,
    );

    await voteOnRecAction(42, "disagree");

    const arg = mockPrisma.recommendationVote.upsert.mock.calls[0]![0];
    expect(arg.update).toMatchObject({ vote: "disagree" });
    expect(arg.update.createdAt).toBeInstanceOf(Date);
  });
});

describe("clearVoteAction", () => {
  it("rejects unauthenticated callers", async () => {
    expect(await clearVoteAction(1)).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(mockPrisma.recommendationVote.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the owner's vote for the item and revalidates", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(
      userScopedItem("corey") as never,
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1 } as never);
    mockPrisma.recommendationVote.deleteMany.mockResolvedValueOnce({
      count: 1,
    } as never);

    const r = await clearVoteAction(42);

    expect(r).toEqual({ ok: true });
    expect(mockPrisma.recommendationVote.deleteMany).toHaveBeenCalledWith({
      where: { itemId: 42, userId: 1 },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recs");
  });

  it("rejects partner attempts to clear another user's vote", async () => {
    mockSession.userId = 2;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(
      userScopedItem("corey") as never,
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1 } as never);

    expect(await clearVoteAction(42)).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(mockPrisma.recommendationVote.deleteMany).not.toHaveBeenCalled();
  });

  it("is idempotent when there's nothing to delete", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(
      coWatchItem() as never,
    );
    mockPrisma.recommendationVote.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);

    expect(await clearVoteAction(42)).toEqual({ ok: true });
  });
});
