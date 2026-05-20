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
  currentSeasonCompleted: false,
  userRating: null,
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
  unavailable: false,
  coWatch: false,
  ...overrides,
});

describe("InProgressCard", () => {
  it("renders title, season label, production status with caveat", () => {
    render(<InProgressCard data={data()} onEdit={() => {}} partnerName={null} />);
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
        onEdit={() => {}} partnerName={null}
      />,
    );
    expect(screen.queryByText(/may change/i)).not.toBeInTheDocument();
  });

  it("renders the progress label verbatim (state-aware copy lives in the helper)", () => {
    render(
      <InProgressCard
        data={data({ label: "Caught up — waiting for Season 3" })}
        onEdit={() => {}} partnerName={null}
      />,
    );
    expect(
      screen.getByText(/caught up — waiting for season 3/i),
    ).toBeInTheDocument();
  });

  it("renders the Unavailable badge when unavailable", () => {
    render(
      <InProgressCard data={data({ unavailable: true })} onEdit={() => {}} partnerName={null} />,
    );
    expect(
      screen.getByText(/unavailable on your subscriptions/i),
    ).toBeInTheDocument();
  });

  it("shows Paused label when status is paused", () => {
    render(
      <InProgressCard
        data={data({ entry: { ...baseEntry, status: "paused" } })}
        onEdit={() => {}} partnerName={null}
      />,
    );
    expect(screen.getByText(/^paused$/i)).toBeInTheDocument();
  });
});
