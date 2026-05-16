import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/settings", () => ({
  toggleSubscriptionAction: vi.fn(async () => {}),
}));

import { SubscriptionEditor } from "@/components/subscription-editor";
import { toggleSubscriptionAction } from "@/lib/settings";

describe("<SubscriptionEditor />", () => {
  beforeEach(() => {
    vi.mocked(toggleSubscriptionAction).mockClear();
  });

  it("renders all five platforms as toggle buttons", () => {
    render(<SubscriptionEditor active={[]} />);
    expect(screen.getByRole("button", { name: /netflix/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disney\+/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apple tv\+/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crave/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prime video/i })).toBeInTheDocument();
  });

  it("marks active platforms with aria-pressed=true and inactive with false", () => {
    render(<SubscriptionEditor active={["netflix", "crave"]} />);
    expect(
      screen.getByRole("button", { name: /netflix/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /crave/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /disney\+/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("calls toggleSubscriptionAction with the platform key on click", async () => {
    const user = userEvent.setup();
    render(<SubscriptionEditor active={[]} />);
    await user.click(screen.getByRole("button", { name: /disney\+/i }));
    expect(vi.mocked(toggleSubscriptionAction)).toHaveBeenCalledWith(
      "disney_plus",
    );
  });
});
