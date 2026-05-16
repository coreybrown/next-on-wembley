import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSearchShows = vi.fn();
vi.mock("@/app/actions/search", () => ({ searchShows: mockSearchShows }));

const { SearchInput } = await import("@/components/search-input");

beforeEach(() => {
  mockSearchShows.mockReset();
});

const resultsOk = (
  results: Array<{
    tmdbId: number;
    title: string;
    year: string | null;
    posterUrl: string | null;
  }>,
) => ({ ok: true as const, results });

describe("SearchInput", () => {
  it("renders the combobox with proper ARIA wiring", () => {
    render(<SearchInput onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("does not query until 2+ characters and debounces input", async () => {
    const user = userEvent.setup();
    render(<SearchInput onSelect={() => {}} />);
    const input = screen.getByRole("combobox");

    await user.type(input, "s");
    // Give debounce time to (not) fire
    await new Promise((r) => setTimeout(r, 350));
    expect(mockSearchShows).not.toHaveBeenCalled();

    mockSearchShows.mockResolvedValueOnce(
      resultsOk([
        { tmdbId: 1, title: "Severance", year: "2022", posterUrl: null },
      ]),
    );
    await user.type(input, "ev");
    await waitFor(() => expect(mockSearchShows).toHaveBeenCalled());
    expect(mockSearchShows).toHaveBeenLastCalledWith("sev");
  });

  it("renders results and highlights the first one", async () => {
    const user = userEvent.setup();
    mockSearchShows.mockResolvedValueOnce(
      resultsOk([
        { tmdbId: 1, title: "Severance", year: "2022", posterUrl: null },
        { tmdbId: 2, title: "Sev Two", year: null, posterUrl: null },
      ]),
    );
    render(<SearchInput onSelect={() => {}} />);
    await user.type(screen.getByRole("combobox"), "sev");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowDown / ArrowUp move highlight, Enter selects, clears input", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    mockSearchShows.mockResolvedValueOnce(
      resultsOk([
        { tmdbId: 1, title: "A", year: null, posterUrl: null },
        { tmdbId: 2, title: "B", year: null, posterUrl: null },
        { tmdbId: 3, title: "C", year: null, posterUrl: null },
      ]),
    );
    render(<SearchInput onSelect={onSelect} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    await user.type(input, "ab");
    await screen.findAllByRole("option");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith({
      tmdbId: 2,
      title: "B",
      year: null,
      posterUrl: null,
    });
    expect(input.value).toBe("");
  });

  it("Escape closes the dropdown", async () => {
    const user = userEvent.setup();
    mockSearchShows.mockResolvedValueOnce(
      resultsOk([{ tmdbId: 1, title: "X", year: null, posterUrl: null }]),
    );
    render(<SearchInput onSelect={() => {}} />);
    await user.type(screen.getByRole("combobox"), "xy");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });

  it("shows empty state for zero results", async () => {
    const user = userEvent.setup();
    mockSearchShows.mockResolvedValueOnce(resultsOk([]));
    render(<SearchInput onSelect={() => {}} />);
    await user.type(screen.getByRole("combobox"), "zz");
    expect(await screen.findByText(/no shows match/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("shows error state when action returns not-ok", async () => {
    const user = userEvent.setup();
    mockSearchShows.mockResolvedValueOnce({
      ok: false,
      error: "unavailable",
    });
    render(<SearchInput onSelect={() => {}} />);
    await user.type(screen.getByRole("combobox"), "zz");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unavailable/i);
  });

  it("ignores stale responses (out-of-order)", async () => {
    const user = userEvent.setup();
    let resolveSlow: (v: unknown) => void = () => {};
    const slow = new Promise((r) => (resolveSlow = r));
    mockSearchShows.mockReturnValueOnce(slow);
    mockSearchShows.mockResolvedValueOnce(
      resultsOk([{ tmdbId: 2, title: "FAST", year: null, posterUrl: null }]),
    );
    render(<SearchInput onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "ab");
    // Wait for first debounce + call
    await waitFor(() => expect(mockSearchShows).toHaveBeenCalledTimes(1));
    await user.type(input, "c");
    // Wait for second debounce + call + render
    await waitFor(() => expect(mockSearchShows).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("FAST")).toBeInTheDocument();

    await act(async () => {
      resolveSlow(
        resultsOk([
          { tmdbId: 1, title: "STALE", year: null, posterUrl: null },
        ]),
      );
    });
    expect(screen.getByText("FAST")).toBeInTheDocument();
    expect(screen.queryByText("STALE")).not.toBeInTheDocument();
  });
});
