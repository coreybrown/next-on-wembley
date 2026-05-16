import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WatchEntryCard } from "@/components/watch-entry-card";

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
    render(<WatchEntryCard entry={baseEntry} onEdit={() => {}} />);
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
      />,
    );
    expect(screen.queryByText(/season/i)).not.toBeInTheDocument();
  });

  it("hides rating pill when userRating is null", () => {
    render(
      <WatchEntryCard
        entry={{ ...baseEntry, userRating: null }}
        onEdit={() => {}}
      />,
    );
    expect(screen.queryByText(/^liked$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^disliked$/i)).not.toBeInTheDocument();
  });

  it("invokes onEdit when the Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<WatchEntryCard entry={baseEntry} onEdit={onEdit} />);
    await user.click(
      screen.getByRole("button", { name: /edit severance/i }),
    );
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
