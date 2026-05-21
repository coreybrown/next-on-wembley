import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockVoteOnRec = vi.fn();
const mockClearVote = vi.fn();
const mockAddToWtw = vi.fn();
const mockDisagreeOnContinuation = vi.fn();

vi.mock("@/app/actions/rec-votes", () => ({
  voteOnRecAction: mockVoteOnRec,
  clearVoteAction: mockClearVote,
}));
vi.mock("@/app/actions/rec-watchlist", () => ({
  addToWantToWatchAction: mockAddToWtw,
}));
vi.mock("@/app/actions/rec-continuation", () => ({
  disagreeOnContinuationAction: mockDisagreeOnContinuation,
}));

const { RecCard } = await import("@/components/rec-card");
import type { RecListItemView } from "@/app/actions/recommendations";

const item = (overrides: Partial<RecListItemView> = {}): RecListItemView => ({
  id: 1,
  position: 1,
  tmdbId: 100,
  title: "Severance",
  year: "2022",
  posterUrl: null,
  shortExplanation: "Short pitch.",
  longExplanation: "Longer pitch with more detail.",
  category: "new_show",
  providerKeys: ["apple_tv_plus"],
  genres: [],
  unavailable: false,
  currentVote: null,
  partnerVote: null,
  canVote: true,
  inWatchHistory: false,
  ...overrides,
});

beforeEach(() => {
  mockVoteOnRec.mockReset().mockResolvedValue({ ok: true });
  mockClearVote.mockReset().mockResolvedValue({ ok: true });
  mockAddToWtw.mockReset().mockResolvedValue({ ok: true });
  mockDisagreeOnContinuation.mockReset().mockResolvedValue({ ok: true });
});

describe("RecCard", () => {
  it("renders position, title, year, and short explanation by default", () => {
    render(<RecCard item={item()} />);
    expect(screen.getByLabelText(/position 1/i)).toBeInTheDocument();
    expect(screen.getByText("Severance")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByText(/short pitch/i)).toBeInTheDocument();
    expect(screen.queryByText(/longer pitch/i)).not.toBeInTheDocument();
  });

  it("links to the detail page via 'See details' (no inline expand)", () => {
    render(<RecCard item={item()} />);
    const link = screen.getByRole("link", { name: /see details for severance/i });
    expect(link).toHaveAttribute("href", "/show/100?recItem=1");
    // The long explanation lives on the detail page, never on the card.
    expect(screen.queryByText(/longer pitch/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show more/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the 'Continuing' badge for a continue_watching item", () => {
    render(<RecCard item={item({ category: "continue_watching" })} />);
    expect(screen.getByText(/^continuing$/i)).toBeInTheDocument();
  });

  it("renders the 'New season' badge for a new_season item", () => {
    render(<RecCard item={item({ category: "new_season" })} />);
    expect(screen.getByText(/^new season$/i)).toBeInTheDocument();
  });

  it("renders no category badge for a new_show item", () => {
    render(<RecCard item={item({ category: "new_show" })} />);
    expect(screen.queryByText(/^continuing$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^new season$/i)).not.toBeInTheDocument();
  });

  it("shows the first 2 platform chips and a +N more counter", () => {
    render(
      <RecCard
        item={item({ providerKeys: ["netflix", "crave", "apple_tv_plus", "prime_video"] })}
      />,
    );
    expect(screen.getByText(/^netflix$/i)).toBeInTheDocument();
    expect(screen.getByText(/^crave$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^apple tv\+$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/\+2 more/i)).toBeInTheDocument();
  });

  it("renders the Unavailable badge when unavailable=true", () => {
    render(<RecCard item={item({ unavailable: true })} />);
    expect(
      screen.getByText(/unavailable on your subscriptions/i),
    ).toBeInTheDocument();
  });

  it("shows 'Availability unknown' when providers are empty AND not flagged unavailable", () => {
    render(
      <RecCard item={item({ providerKeys: [], unavailable: false })} />,
    );
    expect(screen.getByText(/availability unknown/i)).toBeInTheDocument();
  });
});

describe("RecCard — voting", () => {
  it("reflects an existing vote via aria-pressed", () => {
    render(<RecCard item={item({ currentVote: "agree" })} />);
    expect(screen.getByRole("button", { name: /^agree$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^disagree$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("casts a new vote when an empty pill is clicked", async () => {
    const user = userEvent.setup();
    render(<RecCard item={item()} />);
    await user.click(screen.getByRole("button", { name: /^disagree$/i }));
    await waitFor(() => {
      expect(mockVoteOnRec).toHaveBeenCalledWith(1, "disagree");
    });
  });

  it("clears the vote when re-clicking the active pill (toggle off)", async () => {
    const user = userEvent.setup();
    render(<RecCard item={item({ currentVote: "agree" })} />);
    await user.click(screen.getByRole("button", { name: /^agree$/i }));
    await waitFor(() => {
      expect(mockClearVote).toHaveBeenCalledWith(1);
    });
    expect(mockVoteOnRec).not.toHaveBeenCalled();
  });

  it("switches the vote when a different pill is clicked", async () => {
    const user = userEvent.setup();
    render(<RecCard item={item({ currentVote: "agree" })} />);
    await user.click(screen.getByRole("button", { name: /^maybe$/i }));
    await waitFor(() => {
      expect(mockVoteOnRec).toHaveBeenCalledWith(1, "maybe");
    });
  });

  it("renders pills as disabled when the viewer can't vote (partner peeking at owner list)", async () => {
    const user = userEvent.setup();
    render(<RecCard item={item({ canVote: false, currentVote: "agree" })} />);
    const agree = screen.getByRole("button", { name: /^agree$/i });
    expect(agree).toBeDisabled();
    expect(agree).toHaveAttribute("aria-pressed", "true");
    // Owner's selection is still visible to the viewer.
    await user.click(agree);
    expect(mockVoteOnRec).not.toHaveBeenCalled();
    expect(mockClearVote).not.toHaveBeenCalled();
  });

  it("renders the partner-vote indicator when partnerVote is set (Co-watch)", () => {
    render(
      <RecCard
        item={item({ partnerVote: "agree" })}
        partnerLabel="Jaimie"
      />,
    );
    // "Jaimie:" attribution + vote label both surfaced
    expect(screen.getByText(/^jaimie:$/i)).toBeInTheDocument();
    // Two "Agree" labels: the viewer's pill + the partner indicator.
    expect(screen.getAllByText(/^agree$/i).length).toBeGreaterThanOrEqual(2);
  });

  it("omits the partner-vote indicator when partnerVote is null", () => {
    render(<RecCard item={item()} partnerLabel="Jaimie" />);
    expect(screen.queryByText(/^jaimie:$/i)).toBeNull();
  });
});

describe("RecCard — Disagree-on-continuation prompt (Phase 27)", () => {
  it("opens the prompt instead of voting when Disagree is clicked on a viewer-owned continuation", async () => {
    const user = userEvent.setup();
    render(
      <RecCard
        item={item({ category: "continue_watching", inWatchHistory: true })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^disagree$/i }));
    // Dialog content is now visible.
    expect(
      await screen.findByRole("dialog", { name: /step back from/i }),
    ).toBeInTheDocument();
    // Vote action NOT called until the user resolves the prompt.
    expect(mockVoteOnRec).not.toHaveBeenCalled();
    expect(mockDisagreeOnContinuation).not.toHaveBeenCalled();
  });

  it("Move to Paused calls disagreeOnContinuationAction('paused')", async () => {
    const user = userEvent.setup();
    render(
      <RecCard
        item={item({ category: "continue_watching", inWatchHistory: true })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^disagree$/i }));
    await user.click(
      await screen.findByRole("button", { name: /move to paused/i }),
    );
    await waitFor(() => {
      expect(mockDisagreeOnContinuation).toHaveBeenCalledWith(1, "paused");
    });
  });

  it("Move to Dropped calls disagreeOnContinuationAction('dropped')", async () => {
    const user = userEvent.setup();
    render(
      <RecCard
        item={item({ category: "continue_watching", inWatchHistory: true })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^disagree$/i }));
    await user.click(
      await screen.findByRole("button", { name: /move to dropped/i }),
    );
    await waitFor(() => {
      expect(mockDisagreeOnContinuation).toHaveBeenCalledWith(1, "dropped");
    });
  });

  it("Cancel discards the vote — neither action fires", async () => {
    const user = userEvent.setup();
    render(
      <RecCard
        item={item({ category: "continue_watching", inWatchHistory: true })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^disagree$/i }));
    await user.click(
      await screen.findByRole("button", { name: /^cancel$/i }),
    );
    expect(mockVoteOnRec).not.toHaveBeenCalled();
    expect(mockDisagreeOnContinuation).not.toHaveBeenCalled();
  });

  it("does not prompt when the continuation is in the partner's history (not the viewer's)", async () => {
    const user = userEvent.setup();
    render(
      <RecCard
        item={item({ category: "continue_watching", inWatchHistory: false })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^disagree$/i }));
    // Normal vote path fires immediately, no dialog opens.
    await waitFor(() => {
      expect(mockVoteOnRec).toHaveBeenCalledWith(1, "disagree");
    });
    expect(
      screen.queryByRole("dialog", { name: /step back from/i }),
    ).toBeNull();
  });

  it("Agree on a continuation goes through normal voting (no prompt)", async () => {
    const user = userEvent.setup();
    render(
      <RecCard
        item={item({ category: "continue_watching", inWatchHistory: true })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^agree$/i }));
    await waitFor(() => {
      expect(mockVoteOnRec).toHaveBeenCalledWith(1, "agree");
    });
    expect(mockDisagreeOnContinuation).not.toHaveBeenCalled();
  });
});

describe("RecCard — Want to Watch", () => {
  it("shows the WTW button for a new pick not in history", () => {
    render(<RecCard item={item()} />);
    expect(
      screen.getByRole("button", { name: /want to watch/i }),
    ).toBeInTheDocument();
  });

  it("hides the WTW button when the show is already in the user's history", () => {
    render(<RecCard item={item({ inWatchHistory: true })} />);
    expect(
      screen.queryByRole("button", { name: /want to watch/i }),
    ).not.toBeInTheDocument();
    // Replaced by a non-interactive "on your list" indicator (aria-label).
    expect(screen.getByLabelText(/is on your list/i)).toBeInTheDocument();
  });

  it("hides the WTW button for continuations (already on the user's list)", () => {
    render(<RecCard item={item({ category: "continue_watching" })} />);
    expect(
      screen.queryByRole("button", { name: /want to watch/i }),
    ).not.toBeInTheDocument();
  });

  it("calls the action and surfaces success on click", async () => {
    const user = userEvent.setup();
    render(<RecCard item={item()} />);
    await user.click(screen.getByRole("button", { name: /want to watch/i }));
    await waitFor(() => {
      expect(mockAddToWtw).toHaveBeenCalledWith(1);
    });
  });

  it("surfaces an error message when the action returns already_in_history", async () => {
    mockAddToWtw.mockResolvedValueOnce({
      ok: false,
      error: "already_in_history",
    });
    const user = userEvent.setup();
    render(<RecCard item={item()} />);
    await user.click(screen.getByRole("button", { name: /want to watch/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/already on your list/i),
      ).toBeInTheDocument();
    });
  });
});
