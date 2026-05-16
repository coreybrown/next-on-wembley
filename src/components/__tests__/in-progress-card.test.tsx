import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/in-progress", () => ({
  bumpSeasonAction: vi.fn(),
  finishItAction: vi.fn(),
}));

const { InProgressCard } = await import("@/components/in-progress-card");

const baseEntry = {
  id: 1,
  userId: 7,
  showId: 100,
  status: "watching" as const,
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
    totalSeasons: 3,
    totalEpisodes: 30,
    seasonsJson: null,
    tmdbRating: 8.7,
    trailerUrl: null,
    productionStatus: "Returning Series",
    lastSyncedAt: new Date(),
    providers: [],
  },
};

const data = (overrides: Record<string, unknown> = {}) => ({
  entry: baseEntry,
  label: "Season 2 of 3",
  episodesRemaining: 10,
  unavailable: false,
  ...overrides,
});

describe("InProgressCard", () => {
  it("renders title, season label, production status with caveat", () => {
    render(<InProgressCard data={data()} onEdit={() => {}} />);
    expect(screen.getByText("Severance")).toBeInTheDocument();
    expect(screen.getByText(/season 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/returning series/i)).toBeInTheDocument();
    expect(screen.getByText(/may change/i)).toBeInTheDocument();
  });

  it("hides production-status line when status is null (PRD §257)", () => {
    render(
      <InProgressCard
        data={data({
          entry: {
            ...baseEntry,
            show: { ...baseEntry.show, productionStatus: null },
          },
        })}
        onEdit={() => {}}
      />,
    );
    expect(screen.queryByText(/may change/i)).not.toBeInTheDocument();
  });

  it("renders 'N episodes remaining'", () => {
    render(<InProgressCard data={data({ episodesRemaining: 12 })} onEdit={() => {}} />);
    expect(screen.getByText(/12 episodes remaining/i)).toBeInTheDocument();
  });

  it("renders 'All caught up' when 0 remaining", () => {
    render(
      <InProgressCard
        data={data({ episodesRemaining: 0 })}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("hides the remaining badge when episodesRemaining is null", () => {
    render(
      <InProgressCard
        data={data({ episodesRemaining: null })}
        onEdit={() => {}}
      />,
    );
    expect(screen.queryByText(/episodes remaining/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it("renders the Unavailable badge when unavailable", () => {
    render(
      <InProgressCard data={data({ unavailable: true })} onEdit={() => {}} />,
    );
    expect(
      screen.getByText(/unavailable on your subscriptions/i),
    ).toBeInTheDocument();
  });

  it("shows Paused label when status is paused", () => {
    render(
      <InProgressCard
        data={data({ entry: { ...baseEntry, status: "paused" } })}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText(/^paused$/i)).toBeInTheDocument();
  });
});
