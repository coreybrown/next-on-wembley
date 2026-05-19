import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecCard } from "@/components/rec-card";
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
  ...overrides,
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
