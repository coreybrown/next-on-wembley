import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockAdd = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSetCoWatch = vi.fn();

vi.mock("@/app/actions/watch-entries", () => ({
  addWatchEntry: mockAdd,
  updateWatchEntry: mockUpdate,
  deleteWatchEntry: mockDelete,
}));
vi.mock("@/app/actions/co-watch", () => ({
  setCoWatchAction: mockSetCoWatch,
}));

const { ShowDetailWatchControls } = await import(
  "@/components/show-detail-watch-controls"
);

beforeEach(() => {
  mockAdd.mockReset().mockResolvedValue({ ok: true });
  mockUpdate.mockReset().mockResolvedValue({ ok: true });
  mockDelete.mockReset().mockResolvedValue({ ok: true });
  mockSetCoWatch.mockReset().mockResolvedValue({
    ok: true,
    on: true,
    synced: { status: "watching", currentSeason: 3, currentSeasonCompleted: false },
    partnerName: "Jaimie",
  });
});

const watchingEntry = {
  id: 7,
  status: "watching" as const,
  currentSeason: 2,
  userRating: null,
};

describe("<ShowDetailWatchControls /> — empty state", () => {
  it("renders one quick-add button per status", () => {
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={null}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    // 5 status quick-add buttons.
    expect(screen.getByRole("button", { name: /want to watch/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^watching$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^paused$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^completed$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^dropped$/i })).toBeInTheDocument();
  });

  it("calls addWatchEntry with tmdbId + status + season=1 for watching, null otherwise", async () => {
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={null}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^watching$/i }));
    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith({
        tmdbId: 1396,
        status: "watching",
        currentSeason: 1,
      });
    });

    await user.click(screen.getByRole("button", { name: /want to watch/i }));
    await waitFor(() => {
      expect(mockAdd).toHaveBeenLastCalledWith({
        tmdbId: 1396,
        status: "want_to_watch",
        currentSeason: null,
      });
    });
  });
});

describe("<ShowDetailWatchControls /> — populated state", () => {
  it("highlights the current status pill via aria-pressed", () => {
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={watchingEntry}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    const statusGroup = screen.getByRole("group", { name: /status/i });
    const watching = screen.getAllByRole("button", { name: /^watching$/i })[0]!;
    expect(statusGroup).toContainElement(watching);
    expect(watching).toHaveAttribute("aria-pressed", "true");
  });

  it("updates status when a different pill is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={watchingEntry}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^paused$/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ id: 7, status: "paused" });
    });
  });

  it("season stepper increments and decrements through updateWatchEntry", async () => {
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={watchingEntry}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    await user.click(screen.getByLabelText(/next season/i));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenLastCalledWith({ id: 7, currentSeason: 3 });
    });
    await user.click(screen.getByLabelText(/previous season/i));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenLastCalledWith({ id: 7, currentSeason: 1 });
    });
  });

  it("season stepper is capped at maxSeason", async () => {
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={{ ...watchingEntry, currentSeason: 4 }}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    expect(screen.getByLabelText(/next season/i)).toBeDisabled();
  });

  it("rating toggle: click sets rating; click again clears it", async () => {
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={{ ...watchingEntry, userRating: "like" }}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    // Reclicking the active rating clears it (passes null).
    await user.click(screen.getByRole("button", { name: /^liked$/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenLastCalledWith({
        id: 7,
        userRating: null,
      });
    });
  });

  it("Remove opens a confirm dialog and deletes on confirm", async () => {
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={watchingEntry}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /remove severance from your list/i }),
    );
    expect(
      await screen.findByText(/no signal either way/i),
    ).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: /^remove$/i }).at(-1)!,
    );
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(7);
    });
  });

  it("hides the season stepper for non-progress statuses", () => {
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={{
          ...watchingEntry,
          status: "completed",
          currentSeason: null,
        }}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    expect(screen.queryByLabelText(/next season/i)).toBeNull();
  });
});

describe("<ShowDetailWatchControls /> — co-watch toggle (Phase 42)", () => {
  it("hides the co-watch toggle when there is no partner", () => {
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={watchingEntry}
        maxSeason={4}
        coWatch={false}
        partnerName={null}
      />,
    );
    expect(screen.queryByRole("group", { name: /watching together/i })).toBeNull();
  });

  it("enables co-watch and surfaces the synced-state notice", async () => {
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={watchingEntry}
        maxSeason={4}
        coWatch={false}
        partnerName="Jaimie"
      />,
    );
    await user.click(screen.getByRole("button", { name: /watch with jaimie/i }));
    await waitFor(() => {
      expect(mockSetCoWatch).toHaveBeenCalledWith(500, true);
    });
    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(/you and jaimie are now watching s3/i);
  });

  it("disables co-watch when toggled off", async () => {
    mockSetCoWatch.mockResolvedValueOnce({
      ok: true,
      on: false,
      synced: null,
      partnerName: "Jaimie",
    });
    const user = userEvent.setup();
    render(
      <ShowDetailWatchControls
        tmdbId={1396}
        showId={500}
        showTitle="Severance"
        entry={watchingEntry}
        maxSeason={4}
        coWatch
        partnerName="Jaimie"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /watching with jaimie/i }),
    );
    await waitFor(() => {
      expect(mockSetCoWatch).toHaveBeenCalledWith(500, false);
    });
  });
});
