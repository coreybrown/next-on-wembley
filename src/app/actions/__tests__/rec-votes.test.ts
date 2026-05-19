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

  it("upserts via the (itemId, userId) composite key and revalidates /recs", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
    } as never);

    const r = await voteOnRecAction(42, "agree");

    expect(r).toEqual({ ok: true });
    expect(mockPrisma.recommendationVote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemId_userId: { itemId: 42, userId: 7 } },
        create: { itemId: 42, userId: 7, vote: "agree" },
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recs");
  });

  it("bumps createdAt on re-vote so recent-votes prompt slice stays accurate", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
    } as never);

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

  it("deletes the user's vote for the item and revalidates", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationVote.deleteMany.mockResolvedValueOnce({
      count: 1,
    } as never);

    const r = await clearVoteAction(42);

    expect(r).toEqual({ ok: true });
    expect(mockPrisma.recommendationVote.deleteMany).toHaveBeenCalledWith({
      where: { itemId: 42, userId: 7 },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recs");
  });

  it("is idempotent when there's nothing to delete", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationVote.deleteMany.mockResolvedValueOnce({
      count: 0,
    } as never);

    expect(await clearVoteAction(42)).toEqual({ ok: true });
  });
});
