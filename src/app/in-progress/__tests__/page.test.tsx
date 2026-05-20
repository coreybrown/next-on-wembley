import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetCurrentUser = vi.fn();
const mockGetInProgressEntries = vi.fn();
const mockRefreshStale = vi.fn();
const mockGetUserSubscriptions = vi.fn();
const mockRedirect = vi.fn(() => {
  throw new Error("__REDIRECT__");
});

vi.mock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/settings", () => ({
  getUserSubscriptions: mockGetUserSubscriptions,
}));
vi.mock("@/app/actions/in-progress", () => ({
  getInProgressEntries: mockGetInProgressEntries,
  refreshStaleInProgress: mockRefreshStale,
  bumpSeasonAction: vi.fn(),
  finishItAction: vi.fn(),
}));
vi.mock("@/app/actions/watch-entries", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/actions/watch-entries")
  >("@/app/actions/watch-entries");
  return {
    ...actual,
    updateWatchEntry: vi.fn(),
    deleteWatchEntry: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

const Page = (await import("@/app/in-progress/page")).default;

beforeEach(() => {
  mockGetCurrentUser.mockReset();
  mockGetInProgressEntries.mockReset();
  mockRefreshStale.mockReset();
  mockGetUserSubscriptions.mockReset();
  mockRedirect.mockClear();
});

const entryFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 7,
  showId: 100,
  status: "watching",
  currentSeason: 2,
  currentSeasonCompleted: false,
  userRating: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  show: {
    id: 100,
    tmdbId: 12,
    title: "Severance",
    posterUrl: null,
    genres: "Drama",
    totalSeasons: 3,
    totalEpisodes: 30,
    seasonsJson: JSON.stringify([
      { seasonNumber: 1, episodeCount: 9 },
      { seasonNumber: 2, episodeCount: 10 },
      { seasonNumber: 3, episodeCount: 10 },
    ]),
    tmdbRating: 8.7,
    trailerUrl: null,
    productionStatus: "Returning Series",
    lastSyncedAt: new Date(),
    providers: [{ platformKey: "apple_tv_plus" }],
  },
  ...overrides,
});

describe("<InProgressPage />", () => {
  it("redirects to /login when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    await expect(Page()).rejects.toThrow("__REDIRECT__");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(mockRefreshStale).not.toHaveBeenCalled();
    expect(mockGetInProgressEntries).not.toHaveBeenCalled();
  });

  it("calls refreshStaleInProgress BEFORE loading entries", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "corey",
      displayName: "Corey",
    });
    mockRefreshStale.mockResolvedValueOnce({ refreshed: 0 });
    mockGetInProgressEntries.mockResolvedValueOnce([]);
    mockGetUserSubscriptions.mockResolvedValueOnce([]);
    render(await Page());
    // Verify call order
    const refreshOrder = mockRefreshStale.mock.invocationCallOrder[0]!;
    const entriesOrder = mockGetInProgressEntries.mock.invocationCallOrder[0]!;
    expect(refreshOrder).toBeLessThan(entriesOrder);
  });

  it("renders user displayName + empty state when no entries", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "corey",
      displayName: "Corey",
    });
    mockRefreshStale.mockResolvedValueOnce({ refreshed: 0 });
    mockGetInProgressEntries.mockResolvedValueOnce([]);
    mockGetUserSubscriptions.mockResolvedValueOnce([]);
    render(await Page());
    expect(screen.getByText(/^\[in progress\]$/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing in progress/i)).toBeInTheDocument();
  });

  it("computes per-card display data (state-aware label, unavailable)", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "jaimie",
      displayName: "Jaimie",
    });
    mockRefreshStale.mockResolvedValueOnce({ refreshed: 0 });
    mockGetInProgressEntries.mockResolvedValueOnce([entryFixture()]);
    mockGetUserSubscriptions.mockResolvedValueOnce(["netflix"]); // not apple
    render(await Page());
    expect(screen.getByText("Severance")).toBeInTheDocument();
    // currentSeason=2, !completed → "Season 2 of 3" per progressLabel
    expect(screen.getByText(/season 2 of 3/i)).toBeInTheDocument();
    // Unavailable: show only on apple_tv_plus, user has netflix
    expect(
      screen.getByText(/unavailable on your subscriptions/i),
    ).toBeInTheDocument();
  });

  it("shows the caught-up label when current season is finished and S3 is teased", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "corey",
      displayName: "Corey",
    });
    mockRefreshStale.mockResolvedValueOnce({ refreshed: 0 });
    // Severance-like state: currentSeason=2 done, only S1+S2 released
    // (S3 announced but unaired, so seasonsJson has 2 entries), totalSeasons=3.
    mockGetInProgressEntries.mockResolvedValueOnce([
      entryFixture({
        currentSeasonCompleted: true,
        show: {
          ...entryFixture().show,
          seasonsJson: JSON.stringify([
            { seasonNumber: 1, episodeCount: 9 },
            { seasonNumber: 2, episodeCount: 10 },
          ]),
        },
      }),
    ]);
    mockGetUserSubscriptions.mockResolvedValueOnce(["apple_tv_plus"]);
    render(await Page());
    expect(
      screen.getByText(/caught up — waiting for season 3/i),
    ).toBeInTheDocument();
  });

  it("does NOT badge unavailable when user has the subscription", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "corey",
      displayName: "Corey",
    });
    mockRefreshStale.mockResolvedValueOnce({ refreshed: 0 });
    mockGetInProgressEntries.mockResolvedValueOnce([entryFixture()]);
    mockGetUserSubscriptions.mockResolvedValueOnce(["apple_tv_plus"]);
    render(await Page());
    expect(
      screen.queryByText(/unavailable on your subscriptions/i),
    ).not.toBeInTheDocument();
  });
});
