import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockClearOwnVote = vi.fn();
vi.mock("@/app/actions/rec-votes", () => ({
  clearOwnVoteOnShowAction: mockClearOwnVote,
}));

const { DisagreesInspector } = await import(
  "@/components/disagrees-inspector"
);

const sampleShows = [
  {
    showId: 10,
    tmdbId: 1,
    title: "The Sopranos",
    posterUrl: null,
    disagreedAt: new Date("2026-05-19T00:00:00Z"),
  },
  {
    showId: 11,
    tmdbId: 2,
    title: "Game of Thrones",
    posterUrl: null,
    disagreedAt: new Date("2026-05-18T00:00:00Z"),
  },
];

beforeEach(() => {
  mockClearOwnVote.mockReset().mockResolvedValue({ ok: true });
});

describe("<DisagreesInspector />", () => {
  it("renders nothing when there are no disagreed shows", () => {
    const { container } = render(<DisagreesInspector shows={[]} />);
    expect(container.textContent).toBe("");
  });

  it("shows the count in the header before expansion", () => {
    render(<DisagreesInspector shows={sampleShows} />);
    expect(
      screen.getByRole("button", { name: /buried disagrees \(2\)/i }),
    ).toBeInTheDocument();
    // Show titles are inside the collapsed panel — not visible until expanded.
    expect(screen.queryByText(/the sopranos/i)).toBeNull();
  });

  it("expands to reveal each disagreed show with a Bring back button", async () => {
    const user = userEvent.setup();
    render(<DisagreesInspector shows={sampleShows} />);
    await user.click(
      screen.getByRole("button", { name: /buried disagrees \(2\)/i }),
    );
    expect(screen.getByText("The Sopranos")).toBeInTheDocument();
    expect(screen.getByText("Game of Thrones")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /bring .* back into recommendations/i })
        .length,
    ).toBe(2);
  });

  it("Bring back calls clearOwnVoteOnShowAction with the show id", async () => {
    const user = userEvent.setup();
    render(<DisagreesInspector shows={sampleShows} />);
    await user.click(
      screen.getByRole("button", { name: /buried disagrees \(2\)/i }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /bring the sopranos back into recommendations/i,
      }),
    );
    await waitFor(() => {
      expect(mockClearOwnVote).toHaveBeenCalledWith(10);
    });
  });
});
