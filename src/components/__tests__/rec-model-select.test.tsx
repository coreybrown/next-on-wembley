import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSet = vi.fn(async () => {});
vi.mock("@/lib/settings", () => ({ setRecModelAction: mockSet }));

const { RecModelSelect } = await import("@/components/rec-model-select");

beforeEach(() => {
  mockSet.mockReset();
  mockSet.mockResolvedValue(undefined);
});

describe("<RecModelSelect />", () => {
  it("renders both options with the current one pressed", () => {
    render(<RecModelSelect current="haiku" />);
    const haiku = screen.getByRole("button", { name: /haiku 4\.5/i });
    const sonnet = screen.getByRole("button", { name: /sonnet 4\.6/i });
    expect(haiku).toHaveAttribute("aria-pressed", "true");
    expect(sonnet).toHaveAttribute("aria-pressed", "false");
  });

  it("opens a confirmation dialog when picking a different model — does not fire the action yet", async () => {
    const user = userEvent.setup();
    render(<RecModelSelect current="haiku" />);
    await user.click(screen.getByRole("button", { name: /sonnet 4\.6/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/switch to sonnet 4\.6/i)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.12/)).toBeInTheDocument();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("does not open the dialog when clicking the currently-selected option", async () => {
    const user = userEvent.setup();
    render(<RecModelSelect current="haiku" />);
    await user.click(screen.getByRole("button", { name: /haiku 4\.5/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("Confirm fires the action with the pending model and closes the dialog", async () => {
    const user = userEvent.setup();
    render(<RecModelSelect current="haiku" />);
    await user.click(screen.getByRole("button", { name: /sonnet 4\.6/i }));
    await user.click(
      screen.getByRole("button", { name: /switch & regenerate/i }),
    );
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("sonnet"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Cancel closes the dialog without firing the action", async () => {
    const user = userEvent.setup();
    render(<RecModelSelect current="haiku" />);
    await user.click(screen.getByRole("button", { name: /sonnet 4\.6/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("Escape (Radix dismiss) closes the dialog without firing the action", async () => {
    const user = userEvent.setup();
    render(<RecModelSelect current="haiku" />);
    await user.click(screen.getByRole("button", { name: /sonnet 4\.6/i }));
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mockSet).not.toHaveBeenCalled();
  });
});
