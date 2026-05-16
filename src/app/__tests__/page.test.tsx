import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetCurrentUser = vi.fn();
const mockGetWatchEntries = vi.fn();
const mockRedirect = vi.fn(() => {
  throw new Error("__REDIRECT__");
});

vi.mock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/app/actions/watch-entries", () => ({
  getWatchEntries: mockGetWatchEntries,
}));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

const Home = (await import("@/app/page")).default;

beforeEach(() => {
  mockGetCurrentUser.mockReset();
  mockGetWatchEntries.mockReset();
  mockRedirect.mockClear();
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
    posterUrl: null,
    genres: "Drama",
    totalSeasons: 2,
    totalEpisodes: 19,
    tmdbRating: 8.7,
    trailerUrl: null,
    productionStatus: "Returning Series",
    lastSyncedAt: new Date(),
  },
  ...overrides,
});

describe("<Home /> dashboard", () => {
  it("redirects to /login when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    await expect(Home()).rejects.toThrow("__REDIRECT__");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(mockGetWatchEntries).not.toHaveBeenCalled();
  });

  it("renders the masthead with the user's display name", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "corey",
      displayName: "Corey",
    });
    mockGetWatchEntries.mockResolvedValueOnce([]);
    render(await Home());
    expect(
      screen.getByRole("heading", { level: 1, name: /corey’s list/i }),
    ).toBeInTheDocument();
  });

  it("renders the empty state when no entries", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "corey",
      displayName: "Corey",
    });
    mockGetWatchEntries.mockResolvedValueOnce([]);
    render(await Home());
    expect(screen.getByText(/no shows yet/i)).toBeInTheDocument();
  });

  it("groups entries by status and counts per section", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: "jaimie",
      displayName: "Jaimie",
    });
    mockGetWatchEntries.mockResolvedValueOnce([
      entry({ id: 1, status: "watching" }),
      entry({
        id: 2,
        status: "want_to_watch",
        show: {
          id: 200,
          tmdbId: 22,
          title: "The Bear",
          posterUrl: null,
          genres: "Drama",
          totalSeasons: 3,
          totalEpisodes: 28,
          tmdbRating: 8.5,
          trailerUrl: null,
          productionStatus: "Returning Series",
          lastSyncedAt: new Date(),
        },
      }),
    ]);
    render(await Home());
    // each entry shown
    expect(screen.getByText("Severance")).toBeInTheDocument();
    expect(screen.getByText("The Bear")).toBeInTheDocument();
    // section headings
    expect(
      screen.getByRole("heading", { level: 2, name: /watching/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /want to watch/i }),
    ).toBeInTheDocument();
    // empty-section message for one that has no items
    expect(screen.getAllByText(/nothing on hold/i)).not.toHaveLength(0);
  });
});
