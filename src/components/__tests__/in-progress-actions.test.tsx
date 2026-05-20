import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockBump = vi.fn();
const mockFinish = vi.fn();
vi.mock("@/app/actions/in-progress", () => ({
  bumpSeasonAction: mockBump,
  finishItAction: mockFinish,
}));

const { InProgressActions } = await import(
  "@/components/in-progress-actions"
);

const entry = (overrides: Record<string, unknown> = {}) => ({
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
  },
  ...overrides,
});

beforeEach(() => {
  mockBump.mockReset();
  mockFinish.mockReset();
});

describe("InProgressActions — season nudge", () => {
  it("renders current season + both nudge buttons + Finished it", () => {
    render(<InProgressActions entry={entry()} coWatch={false} partnerName={null} />);
    expect(screen.getByText("S2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous season/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next season/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finished it/i })).toBeInTheDocument();
  });

  it("disables − at season 1", () => {
    render(<InProgressActions entry={entry({ currentSeason: 1 })} coWatch={false} partnerName={null} />);
    expect(
      screen.getByRole("button", { name: /previous season/i }),
    ).toBeDisabled();
  });

  it("disables + when current equals totalSeasons", () => {
    render(
      <InProgressActions
        entry={entry({ currentSeason: 3 })}
        coWatch={false}
        partnerName={null}
      />,
    );
    expect(
      screen.getByRole("button", { name: /next season/i }),
    ).toBeDisabled();
  });

  it("allows + past current when totalSeasons is null (ongoing)", () => {
    const e = entry({
      currentSeason: 5,
      show: {
        ...entry().show,
        totalSeasons: null,
      },
    });
    render(<InProgressActions entry={e} coWatch={false} partnerName={null} />);
    expect(
      screen.getByRole("button", { name: /next season/i }),
    ).not.toBeDisabled();
  });

  it("calls bumpSeasonAction with +1 / -1", async () => {
    const user = userEvent.setup();
    mockBump.mockResolvedValue({ ok: true });
    render(<InProgressActions entry={entry()} coWatch={false} partnerName={null} />);
    await user.click(screen.getByRole("button", { name: /next season/i }));
    expect(mockBump).toHaveBeenLastCalledWith(1, 1);
    await user.click(screen.getByRole("button", { name: /previous season/i }));
    expect(mockBump).toHaveBeenLastCalledWith(1, -1);
  });
});

describe("InProgressActions — finished it", () => {
  it("opens the rating prompt when Finished it is clicked", async () => {
    const user = userEvent.setup();
    render(<InProgressActions entry={entry()} coWatch={false} partnerName={null} />);
    await user.click(screen.getByRole("button", { name: /finished it/i }));
    expect(
      screen.getByRole("group", { name: /quick rating/i }),
    ).toBeInTheDocument();
  });

  it("calls finishItAction with the chosen rating", async () => {
    const user = userEvent.setup();
    mockFinish.mockResolvedValue({ ok: true });
    render(<InProgressActions entry={entry()} coWatch={false} partnerName={null} />);
    await user.click(screen.getByRole("button", { name: /finished it/i }));
    await user.click(
      screen.getByRole("button", { name: /finished — liked/i }),
    );
    expect(mockFinish).toHaveBeenCalledWith(1, "like");
  });

  it("calls finishItAction(null) when Skip is pressed", async () => {
    const user = userEvent.setup();
    mockFinish.mockResolvedValue({ ok: true });
    render(<InProgressActions entry={entry()} coWatch={false} partnerName={null} />);
    await user.click(screen.getByRole("button", { name: /finished it/i }));
    await user.click(screen.getByRole("button", { name: /^skip$/i }));
    expect(mockFinish).toHaveBeenCalledWith(1, null);
  });

  it("returns to the buttons when Cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<InProgressActions entry={entry()} coWatch={false} partnerName={null} />);
    await user.click(screen.getByRole("button", { name: /finished it/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockFinish).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /finished it/i }),
    ).toBeInTheDocument();
  });

  it("shows an error if the action fails", async () => {
    const user = userEvent.setup();
    mockBump.mockResolvedValue({ ok: false, error: "invalid_season" });
    render(<InProgressActions entry={entry()} coWatch={false} partnerName={null} />);
    await user.click(screen.getByRole("button", { name: /next season/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn’t update season/i,
    );
  });
});

describe("InProgressActions — co-watch toggle (Phase 42)", () => {
  it("renders the co-watch toggle when a partner exists", () => {
    render(
      <InProgressActions entry={entry()} coWatch={false} partnerName="Jaimie" />,
    );
    expect(
      screen.getByRole("button", { name: /watch with jaimie/i }),
    ).toBeInTheDocument();
  });

  it("hides the co-watch toggle in a single-user setup", () => {
    render(
      <InProgressActions entry={entry()} coWatch={false} partnerName={null} />,
    );
    expect(screen.queryByRole("button", { name: /watch with/i })).toBeNull();
  });
});
