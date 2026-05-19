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

const { addToWantToWatchAction } = await import(
  "@/app/actions/rec-watchlist"
);

beforeEach(() => {
  mockSession.userId = undefined;
  mockRevalidatePath.mockClear();
  mockPrisma.recommendationItem.findUnique.mockReset();
  mockPrisma.watchEntry.findUnique.mockReset();
  mockPrisma.watchEntry.create.mockReset();
});

describe("addToWantToWatchAction", () => {
  it("rejects unauthenticated callers", async () => {
    expect(await addToWantToWatchAction(1)).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(mockPrisma.watchEntry.create).not.toHaveBeenCalled();
  });

  it("returns not_found when the rec item is missing", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce(null);
    expect(await addToWantToWatchAction(999)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns show_unavailable when the item's show row was deleted", async () => {
    mockSession.userId = 1;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: null,
    } as never);
    expect(await addToWantToWatchAction(42)).toEqual({
      ok: false,
      error: "show_unavailable",
    });
  });

  it("creates a want_to_watch entry on a fresh show", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: 100,
    } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce(null);

    const r = await addToWantToWatchAction(42);

    expect(r).toEqual({ ok: true });
    expect(mockPrisma.watchEntry.create).toHaveBeenCalledWith({
      data: { userId: 7, showId: 100, status: "want_to_watch" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/recs");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("is idempotent when the user already has the show as want_to_watch", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: 100,
    } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce({
      status: "want_to_watch",
    } as never);

    const r = await addToWantToWatchAction(42);

    expect(r).toEqual({ ok: true });
    expect(mockPrisma.watchEntry.create).not.toHaveBeenCalled();
  });

  it("returns already_in_history when the user has the show under another status", async () => {
    mockSession.userId = 7;
    mockPrisma.recommendationItem.findUnique.mockResolvedValueOnce({
      id: 42,
      showId: 100,
    } as never);
    mockPrisma.watchEntry.findUnique.mockResolvedValueOnce({
      status: "watching",
    } as never);

    expect(await addToWantToWatchAction(42)).toEqual({
      ok: false,
      error: "already_in_history",
    });
    expect(mockPrisma.watchEntry.create).not.toHaveBeenCalled();
  });
});
