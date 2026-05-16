import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSession = { userId: undefined as number | undefined };
const mockGetSession = vi.fn(async () => mockSession);
const mockSearchTv = vi.fn();

vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/tmdb", () => ({ searchTv: mockSearchTv }));

const { searchShows } = await import("@/app/actions/search");

beforeEach(() => {
  mockSession.userId = undefined;
  mockSearchTv.mockReset();
});

describe("searchShows", () => {
  it("returns unauthorized when no session", async () => {
    const res = await searchShows("severance");
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(mockSearchTv).not.toHaveBeenCalled();
  });

  it("returns the TMDb results when authenticated", async () => {
    mockSession.userId = 1;
    const results = [
      { tmdbId: 1, title: "Severance", year: "2022", posterUrl: null },
    ];
    mockSearchTv.mockResolvedValueOnce(results);
    expect(await searchShows("severance")).toEqual({ ok: true, results });
    expect(mockSearchTv).toHaveBeenCalledWith("severance");
  });

  it("returns unavailable when TMDb throws", async () => {
    mockSession.userId = 1;
    mockSearchTv.mockRejectedValueOnce(new Error("boom"));
    expect(await searchShows("x")).toEqual({ ok: false, error: "unavailable" });
  });
});
