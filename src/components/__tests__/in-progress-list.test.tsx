import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/in-progress", () => ({
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

const { InProgressList } = await import("@/components/in-progress-list");

const card = (
  status: "watching" | "paused",
  id: number,
  title: string,
) => ({
  entry: {
    id,
    userId: 7,
    showId: 100 + id,
    status,
    currentSeason: 1,
    currentSeasonCompleted: false,
    userRating: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    show: {
      id: 100 + id,
      tmdbId: id,
      title,
      overview: null,
      posterUrl: null,
      genres: "",
      totalSeasons: 2,
      totalEpisodes: 10,
      seasonsJson: null,
      tmdbRating: null,
      trailerUrl: null,
      productionStatus: null,
      lastSyncedAt: new Date(),
      providers: [],
    },
  },
  label: "Season 1 of 2",
  unavailable: false,
  coWatch: false,
});

describe("InProgressList", () => {
  it("renders the empty state when no cards", () => {
    render(<InProgressList cards={[]} partnerName={null} />);
    expect(screen.getByText(/nothing in progress/i)).toBeInTheDocument();
  });

  it("shows only Watching cards by default", () => {
    render(
      <InProgressList
        cards={[
          card("watching", 1, "Severance"),
          card("paused", 2, "The Bear"),
        ]}
        partnerName={null}
      />,
    );
    expect(screen.getByText("Severance")).toBeInTheDocument();
    expect(screen.queryByText("The Bear")).not.toBeInTheDocument();
    expect(screen.getByText(/show paused/i)).toBeInTheDocument();
  });

  it("reveals Paused cards when the toggle is checked", async () => {
    const user = userEvent.setup();
    render(
      <InProgressList
        cards={[
          card("watching", 1, "Severance"),
          card("paused", 2, "The Bear"),
        ]}
        partnerName={null}
      />,
    );
    await user.click(screen.getByLabelText(/show paused/i));
    expect(screen.getByText("Severance")).toBeInTheDocument();
    expect(screen.getByText("The Bear")).toBeInTheDocument();
  });

  it("renders a hint when only Paused entries exist and toggle is off", () => {
    render(<InProgressList cards={[card("paused", 1, "The Bear")]} partnerName={null} />);
    expect(screen.getByText(/only paused entries/i)).toBeInTheDocument();
  });

  it("hides the Show Paused toggle when there are no paused entries", () => {
    render(<InProgressList cards={[card("watching", 1, "Severance")]} partnerName={null} />);
    expect(screen.queryByLabelText(/show paused/i)).not.toBeInTheDocument();
  });
});
