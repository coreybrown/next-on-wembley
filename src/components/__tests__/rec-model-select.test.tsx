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

  it("calls setRecModelAction with the new value when switched", async () => {
    const user = userEvent.setup();
    render(<RecModelSelect current="haiku" />);
    await user.click(screen.getByRole("button", { name: /sonnet 4\.6/i }));
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("sonnet"));
  });

  it("does not call the action when clicking the currently-selected option", async () => {
    const user = userEvent.setup();
    render(<RecModelSelect current="haiku" />);
    await user.click(screen.getByRole("button", { name: /haiku 4\.5/i }));
    // Give pending transitions a chance to settle
    await new Promise((r) => setTimeout(r, 30));
    expect(mockSet).not.toHaveBeenCalled();
  });
});
