import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WatchEntryForm } from "@/components/watch-entry-form";

const setup = (overrides: Partial<Parameters<typeof WatchEntryForm>[0]> = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <WatchEntryForm
      isPending={false}
      errorMessage={null}
      submitLabel="Add"
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
};

describe("WatchEntryForm", () => {
  it("defaults to want_to_watch with no season visible and no rating", () => {
    setup();
    expect(
      screen.getByRole("radio", { name: /want to watch/i }),
    ).toBeChecked();
    expect(screen.queryByLabelText(/current season/i)).not.toBeInTheDocument();
    for (const r of ["Liked", "Disliked", "Meh"]) {
      expect(screen.getByRole("button", { name: r })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("shows season input when status is watching or paused", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("radio", { name: /watching/i }));
    expect(screen.getByLabelText(/current season/i)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /paused/i }));
    expect(screen.getByLabelText(/current season/i)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /completed/i }));
    expect(screen.queryByLabelText(/current season/i)).not.toBeInTheDocument();
  });

  it("submits with the picked values", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.click(screen.getByRole("radio", { name: /watching/i }));
    const seasonInput = screen.getByLabelText(/current season/i);
    await user.clear(seasonInput);
    await user.type(seasonInput, "3");
    await user.click(screen.getByRole("button", { name: /^liked$/i }));
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      status: "watching",
      currentSeason: 3,
      userRating: "like",
    });
  });

  it("nulls out currentSeason when status is not watching/paused", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({
      initial: { status: "completed", currentSeason: null, userRating: null },
    });
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      status: "completed",
      currentSeason: null,
      userRating: null,
    });
  });

  it("toggles a rating off when re-pressed", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    const like = screen.getByRole("button", { name: /^liked$/i });
    await user.click(like);
    expect(like).toHaveAttribute("aria-pressed", "true");
    await user.click(like);
    expect(like).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ userRating: null }),
    );
  });

  it("respects initial values", () => {
    setup({
      initial: {
        status: "paused",
        currentSeason: 4,
        userRating: "dislike",
      },
    });
    expect(screen.getByRole("radio", { name: /paused/i })).toBeChecked();
    expect((screen.getByLabelText(/current season/i) as HTMLInputElement).value)
      .toBe("4");
    expect(screen.getByRole("button", { name: /^disliked$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables buttons when pending and shows submit-label override", () => {
    setup({ isPending: true });
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("renders an alert when errorMessage is set", () => {
    setup({ errorMessage: "Already on your list" });
    expect(screen.getByRole("alert")).toHaveTextContent(/already on your list/i);
  });
});
