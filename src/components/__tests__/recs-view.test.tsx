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
import type { RecScope } from "@prisma/client";
import type {
  RecListItemView,
  RecListView,
} from "@/app/actions/recommendations";

function renderWithProvider(ui: React.ReactNode) {
  return render(<RefreshProvider>{ui}</RefreshProvider>);
}

const makeItem = (
  overrides: Partial<RecListItemView> = {},
): RecListItemView => ({
  id: 1,
  position: 1,
  tmdbId: 100,
  title: "Severance",
  year: "2022",
  posterUrl: null,
  shortExplanation: "Short.",
  longExplanation: "Long.",
  category: "new_show",
  providerKeys: ["netflix"],
  genres: [],
  unavailable: false,
  currentVote: null,
  partnerVote: null,
  canVote: true,
  inWatchHistory: false,
  ...overrides,
});

const makeRun = (
  scope: RecScope,
  items: RecListItemView[],
): RecListView => ({
  scope,
  runId: 1,
  modelId: "claude-haiku-4-5",
  mood: null,
  focus: "mixed",
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
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
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
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={[]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    expect(
      screen.getByRole("tab", { name: /co-watch/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Co-watch Show")).toBeInTheDocument();
  });

  it("supports ArrowLeft/Right keyboard navigation between tabs (a11y)", async () => {
    const user = userEvent.setup();
    renderWithProvider(<RecsView initial={initial} userSubKeys={[]} partnerDisplayName={null} disagreedShows={[]} viewerUsername="corey" subscriptionsStale={false} />);
    const coWatch = screen.getByRole("tab", { name: /co-watch/i });
    coWatch.focus();
    expect(coWatch).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /corey's picks/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /co-watch/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches to Corey's tab on click", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={[]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /corey's picks/i }));
    expect(screen.getByText("Corey Show")).toBeInTheDocument();
    expect(screen.queryByText("Co-watch Show")).not.toBeInTheDocument();
  });

  it("shows the empty state on Jaimie's tab (no list)", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={[]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /jaimie's picks/i }));
    expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument();
  });

  it("shows the run header (date + model)", () => {
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={[]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
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
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^refine/i }));
    await user.type(screen.getByLabelText(/mood/i), "  dark and slow  ");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() =>
      expect(mockRegenerate).toHaveBeenCalledWith("dark and slow", "mixed"),
    );
  });

  it("omits mood when the textarea is whitespace-only", async () => {
    const user = userEvent.setup();
    mockRegenerate.mockResolvedValueOnce([{ ok: true }, { ok: true }, { ok: true }]);
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={[]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^refine/i }));
    await user.type(screen.getByLabelText(/mood/i), "   ");
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() =>
      expect(mockRegenerate).toHaveBeenCalledWith(undefined, "mixed"),
    );
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
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
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
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /1 of 3 lists failed/i,
    );
  });
});

describe("RecsView — stale subscriptions note", () => {
  const initial = {
    co_watch: makeRun("co_watch", [makeItem({ title: "Co-watch Show" })]),
    corey: null,
    jaimie: null,
  };

  it("renders the stale note when subscriptionsStale is true", () => {
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={[]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={true}
      />,
    );
    expect(
      screen.getByText(/your subscriptions changed since these/i),
    ).toBeInTheDocument();
  });

  it("hides the stale note when subscriptionsStale is false", () => {
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={[]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    expect(
      screen.queryByText(/your subscriptions changed since these/i),
    ).toBeNull();
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

  it("renders platform chips for each of the user's active subs (inside Refine)", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={["netflix", "apple_tv_plus"]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^refine/i }));
    const platformSection = screen.getByText(/^platform$/i).parentElement!;
    expect(platformSection).toHaveTextContent(/netflix/i);
    expect(platformSection).toHaveTextContent(/apple tv\+/i);
  });

  it("derives genre chips from the items in the current tab (inside Refine)", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={["netflix"]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^refine/i }));
    const genreSection = screen.getByText(/^genre$/i).parentElement!;
    expect(genreSection).toHaveTextContent("Drama");
    expect(genreSection).toHaveTextContent("Sci-Fi");
    expect(genreSection).toHaveTextContent("Comedy");
    expect(genreSection).toHaveTextContent("Crime");
  });

  it("collapses mood + filters behind the Refine toggle by default", () => {
    renderWithProvider(
      <RecsView
        initial={initial}
        userSubKeys={["netflix"]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    // Refine button is present and closed.
    expect(
      screen.getByRole("button", { name: /^refine/i }),
    ).toHaveAttribute("aria-expanded", "false");
    // No mood textarea, no platform/genre chips on first paint.
    expect(screen.queryByLabelText(/mood/i)).toBeNull();
    expect(screen.queryByText(/^platform$/i)).toBeNull();
  });

  it("hides filter chips inside Refine when there's no list yet (only mood shows)", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <RecsView
        initial={{ co_watch: null, corey: null, jaimie: null }}
        userSubKeys={["netflix"]}
        partnerDisplayName={null}
        disagreedShows={[]}
        viewerUsername="corey"
        subscriptionsStale={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^refine/i }));
    expect(screen.getByLabelText(/mood/i)).toBeInTheDocument();
    expect(screen.queryByText(/^platform$/i)).toBeNull();
    expect(screen.queryByText(/^genre$/i)).toBeNull();
  });
});
