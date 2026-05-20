import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockDeleteWatchEntry = vi.fn();
vi.mock("@/app/actions/watch-entries", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/actions/watch-entries")
  >("@/app/actions/watch-entries");
  return {
    ...actual,
    deleteWatchEntry: mockDeleteWatchEntry,
  };
});

const { WatchEntryCard } = await import("@/components/watch-entry-card");

beforeEach(() => {
  mockDeleteWatchEntry.mockReset().mockResolvedValue({ ok: true });
});

const baseEntry = {
  id: 1,
  userId: 7,
  showId: 100,
  status: "watching" as const,
  currentSeason: 2,
  currentSeasonCompleted: false,
  userRating: "like" as const,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  show: {
    id: 100,
    tmdbId: 12,
    title: "Severance",
    overview: null,
    posterUrl: null,
    genres: "Drama",
    totalSeasons: 2,
    totalEpisodes: 19,
    seasonsJson: null,
    tmdbRating: 8.7,
    trailerUrl: null,
    productionStatus: "Returning Series",
    lastSyncedAt: new Date(),
  },
};

describe("WatchEntryCard", () => {
  it("renders title, status pill, season, and rating", () => {
    render(<WatchEntryCard entry={baseEntry} onEdit={() => {}} coWatch={false} partnerName={null} />);
    expect(screen.getByText("Severance")).toBeInTheDocument();
    expect(screen.getByText(/^watching$/i)).toBeInTheDocument();
    expect(screen.getByText(/season 2/i)).toBeInTheDocument();
    expect(screen.getByText(/^liked$/i)).toBeInTheDocument();
  });

  it("hides season pill when currentSeason is null", () => {
    render(
      <WatchEntryCard
        entry={{ ...baseEntry, currentSeason: null }}
        onEdit={() => {}}
        coWatch={false}
        partnerName={null}
      />,
    );
    expect(screen.queryByText(/season/i)).not.toBeInTheDocument();
  });

  it("hides rating pill when userRating is null", () => {
    render(
      <WatchEntryCard
        entry={{ ...baseEntry, userRating: null }}
        onEdit={() => {}}
        coWatch={false}
        partnerName={null}
      />,
    );
    expect(screen.queryByText(/^liked$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^disliked$/i)).not.toBeInTheDocument();
  });

  it("invokes onEdit when the Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<WatchEntryCard entry={baseEntry} onEdit={onEdit} coWatch={false} partnerName={null} />);
    await user.click(
      screen.getByRole("button", { name: /edit severance/i }),
    );
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("opens a confirmation dialog and removes the entry when confirmed", async () => {
    const user = userEvent.setup();
    render(<WatchEntryCard entry={baseEntry} onEdit={() => {}} coWatch={false} partnerName={null} />);
    await user.click(
      screen.getByRole("button", { name: /remove severance/i }),
    );
    // Dialog renders with explanation that no signal is added.
    expect(
      screen.getByText(/no signal either way/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(mockDeleteWatchEntry).toHaveBeenCalledWith(1);
    });
  });

  it("does not call delete when the user cancels the dialog", async () => {
    const user = userEvent.setup();
    render(<WatchEntryCard entry={baseEntry} onEdit={() => {}} coWatch={false} partnerName={null} />);
    await user.click(
      screen.getByRole("button", { name: /remove severance/i }),
    );
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockDeleteWatchEntry).not.toHaveBeenCalled();
  });

  it("poster + title link to the plain Show Detail page (no recItem)", () => {
    render(<WatchEntryCard entry={baseEntry} onEdit={() => {}} coWatch={false} partnerName={null} />);
    const posterLink = screen.getByRole("link", {
      name: /open details for severance/i,
    });
    expect(posterLink).toHaveAttribute("href", "/show/12");
  });

  it("shows the co-watch toggle on a completed card when a partner exists", () => {
    render(
      <WatchEntryCard
        entry={{ ...baseEntry, status: "completed" }}
        onEdit={() => {}}
        coWatch={false}
        partnerName="Jaimie"
      />,
    );
    expect(
      screen.getByRole("button", { name: /watch with jaimie/i }),
    ).toBeInTheDocument();
  });
});
