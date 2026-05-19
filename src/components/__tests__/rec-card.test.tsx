import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockVoteOnRec = vi.fn();
const mockClearVote = vi.fn();
const mockAddToWtw = vi.fn();

vi.mock("@/app/actions/rec-votes", () => ({
  voteOnRecAction: mockVoteOnRec,
  clearVoteAction: mockClearVote,
}));
vi.mock("@/app/actions/rec-watchlist", () => ({
  addToWantToWatchAction: mockAddToWtw,
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
  isContinuation: false,
  providerKeys: ["apple_tv_plus"],
  unavailable: false,
  currentVote: null,
  inWatchHistory: false,
  ...overrides,
});

beforeEach(() => {
  mockVoteOnRec.mockReset().mockResolvedValue({ ok: true });
  mockClearVote.mockReset().mockResolvedValue({ ok: true });
  mockAddToWtw.mockReset().mockResolvedValue({ ok: true });
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

  it("toggles between short and long explanation", async () => {
    const user = userEvent.setup();
    render(<RecCard item={item()} />);
    const toggle = screen.getByRole("button", { name: /show more/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByText(/longer pitch with more detail/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show less/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("hides the expand toggle when short and long explanations match", () => {
    render(
      <RecCard
        item={item({ shortExplanation: "Same", longExplanation: "Same" })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /show more/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the Continuation badge when isContinuation=true", () => {
    render(<RecCard item={item({ isContinuation: true })} />);
    expect(screen.getByText(/^continuation$/i)).toBeInTheDocument();
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
    expect(screen.getByText(/on your list/i)).toBeInTheDocument();
  });

  it("hides the WTW button for continuations (already on the user's list)", () => {
    render(<RecCard item={item({ isContinuation: true })} />);
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
        screen.getByText(/already on your list under another status/i),
      ).toBeInTheDocument();
    });
  });
});
