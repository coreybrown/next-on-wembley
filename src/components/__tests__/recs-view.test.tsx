import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRegenerate = vi.fn();
vi.mock("@/app/actions/recommendations", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/actions/recommendations")
  >("@/app/actions/recommendations");
  return {
    ...actual,
    regenerateAllLists: mockRegenerate,
  };
});

const { RecsView } = await import("@/components/recs-view");
const { RefreshProvider } = await import("@/components/refresh-context");

function renderWithProvider(ui: React.ReactNode) {
  return render(<RefreshProvider>{ui}</RefreshProvider>);
}

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  position: 1,
  tmdbId: 100,
  title: "Severance",
  year: "2022",
  posterUrl: null,
  shortExplanation: "Short.",
  longExplanation: "Long.",
  isContinuation: false,
  providerKeys: ["netflix"],
  genres: [],
  unavailable: false,
  currentVote: null,
  canVote: true,
  inWatchHistory: false,
  ...overrides,
});

const makeRun = (scope: string, items: ReturnType<typeof makeItem>[]) => ({
  scope: scope as never,
  runId: 1,
  modelId: "claude-haiku-4-5",
  mood: null,
  createdAt: new Date("2026-05-19T12:00:00Z"),
  items,
});

beforeEach(() => {
  mockRegenerate.mockReset();
});

describe("RecsView — empty state", () => {
  it("shows the empty state when no lists exist", () => {
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={[]}
      />,
    );
    expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^generate$/i }),
    ).toBeInTheDocument();
  });
});

describe("RecsView — populated lists", () => {
  const initial = {
    co_watch: makeRun("co_watch", [makeItem({ title: "Co-watch Show" })]),
    corey: makeRun("corey", [makeItem({ title: "Corey Show" })]),
    jaimie: null,
  };

  it("defaults to Co-watch and shows its items", () => {
    renderWithProvider(<RecsView initial={initial} userSubKeys={[]} />);
    expect(
      screen.getByRole("tab", { name: /co-watch/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Co-watch Show")).toBeInTheDocument();
  });

  it("switches to Corey's tab on click", async () => {
    const user = userEvent.setup();
    renderWithProvider(<RecsView initial={initial} userSubKeys={[]} />);
    await user.click(screen.getByRole("tab", { name: /corey's picks/i }));
    expect(screen.getByText("Corey Show")).toBeInTheDocument();
    expect(screen.queryByText("Co-watch Show")).not.toBeInTheDocument();
  });

  it("shows the empty state on Jaimie's tab (no list)", async () => {
    const user = userEvent.setup();
    renderWithProvider(<RecsView initial={initial} userSubKeys={[]} />);
    await user.click(screen.getByRole("tab", { name: /jaimie's picks/i }));
    expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument();
  });

  it("shows the run header (date + model)", () => {
    renderWithProvider(<RecsView initial={initial} userSubKeys={[]} />);
    expect(screen.getByText(/claude-haiku-4-5/i)).toBeInTheDocument();
  });
});

describe("RecsView — refresh", () => {
  it("calls regenerateAllLists with the trimmed mood when Refresh is clicked", async () => {
    const user = userEvent.setup();
    mockRegenerate.mockResolvedValueOnce([
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={[]}
      />,
    );
    await user.type(screen.getByLabelText(/mood/i), "  dark and slow  ");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() =>
      expect(mockRegenerate).toHaveBeenCalledWith("dark and slow"),
    );
  });

  it("omits mood when the textarea is whitespace-only", async () => {
    const user = userEvent.setup();
    mockRegenerate.mockResolvedValueOnce([{ ok: true }, { ok: true }, { ok: true }]);
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={[]}
      />,
    );
    await user.type(screen.getByLabelText(/mood/i), "   ");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(mockRegenerate).toHaveBeenCalledWith(undefined));
  });

  it("renders an error when all three lists fail", async () => {
    const user = userEvent.setup();
    mockRegenerate.mockResolvedValueOnce([
      { ok: false, error: "anthropic_failed" },
      { ok: false, error: "anthropic_failed" },
      { ok: false, error: "anthropic_failed" },
    ]);
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /all three lists failed/i,
    );
  });

  it("warns when partially successful", async () => {
    const user = userEvent.setup();
    mockRegenerate.mockResolvedValueOnce([
      { ok: true },
      { ok: false, error: "anthropic_failed" },
      { ok: true },
    ]);
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /1 of 3 lists failed/i,
    );
  });
});

describe("RecsView — filters", () => {
  const initial = {
    co_watch: makeRun("co_watch", [
      makeItem({
        id: 1,
        title: "Severance",
        providerKeys: ["apple_tv_plus"],
        genres: ["Drama", "Sci-Fi"],
      }),
      makeItem({
        id: 2,
        title: "Breaking Bad",
        providerKeys: ["netflix"],
        genres: ["Drama", "Crime"],
      }),
      makeItem({
        id: 3,
        title: "Ted Lasso",
        providerKeys: ["apple_tv_plus"],
        genres: ["Comedy"],
      }),
    ]),
    corey: null,
    jaimie: null,
  };

  it("renders platform chips for each of the user's active subs", () => {
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={["netflix", "apple_tv_plus"]}
      />,
    );
    const platformSection = screen.getByText(/^platform$/i).parentElement!;
    expect(platformSection).toHaveTextContent(/netflix/i);
    expect(platformSection).toHaveTextContent(/apple tv\+/i);
  });

  it("derives genre chips from the items in the current tab", () => {
    renderWithProvider(
      <RecsView initial={initial} userSubKeys={["netflix"]} />,
    );
    const genreSection = screen.getByText(/^genre$/i).parentElement!;
    expect(genreSection).toHaveTextContent("Drama");
    expect(genreSection).toHaveTextContent("Sci-Fi");
    expect(genreSection).toHaveTextContent("Comedy");
    expect(genreSection).toHaveTextContent("Crime");
  });

  it("hides the filter section when there's no list yet", () => {
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={["netflix"]}
      />,
    );
    expect(screen.queryByRole("region", { name: /filters/i })).toBeNull();
  });
});
