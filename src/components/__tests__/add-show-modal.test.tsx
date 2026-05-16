import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockAdd = vi.fn();
vi.mock("@/app/actions/watch-entries", () => ({ addWatchEntry: mockAdd }));

const { AddShowModal } = await import("@/components/add-show-modal");

const fixture = {
  tmdbId: 12,
  title: "Severance",
  year: "2022",
  posterUrl: null,
};

beforeEach(() => {
  mockAdd.mockReset();
});

describe("AddShowModal", () => {
  it("renders show title + year in description when open", () => {
    render(<AddShowModal show={fixture} onOpenChange={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/severance \(2022\)/i)).toBeInTheDocument();
  });

  it("submits the form, calls addWatchEntry with tmdbId + values, and closes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onAdded = vi.fn();
    mockAdd.mockResolvedValueOnce({ ok: true });
    render(
      <AddShowModal
        show={fixture}
        onOpenChange={onOpenChange}
        onAdded={onAdded}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith({
        tmdbId: 12,
        status: "want_to_watch",
        currentSeason: null,
        userRating: null,
      }),
    );
    expect(onAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the mapped error message when action fails", async () => {
    const user = userEvent.setup();
    mockAdd.mockResolvedValueOnce({ ok: false, error: "already_added" });
    render(<AddShowModal show={fixture} onOpenChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already on your list/i,
    );
  });
});
