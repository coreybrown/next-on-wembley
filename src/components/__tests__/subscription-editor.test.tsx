import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToggleSubscription = vi.fn(async () => {});
const mockRegenerate = vi.fn();

vi.mock("@/lib/settings", () => ({
  toggleSubscriptionAction: mockToggleSubscription,
}));
vi.mock("@/app/actions/recommendations", () => ({
  regenerateAllLists: mockRegenerate,
}));

const { SubscriptionEditor } = await import(
  "@/components/subscription-editor"
);
const { RefreshProvider } = await import("@/components/refresh-context");

function renderWithProvider(ui: React.ReactNode) {
  return render(<RefreshProvider>{ui}</RefreshProvider>);
}

describe("<SubscriptionEditor />", () => {
  beforeEach(() => {
    mockToggleSubscription.mockClear();
    mockRegenerate.mockReset().mockResolvedValue([
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
  });

  it("renders all platforms as toggle buttons", () => {
    renderWithProvider(<SubscriptionEditor active={[]} />);
    expect(screen.getByRole("button", { name: /netflix/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disney\+/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apple tv\+/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crave/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prime video/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /paramount\+/i })).toBeInTheDocument();
  });

  it("marks active platforms with aria-pressed=true and inactive with false", () => {
    renderWithProvider(<SubscriptionEditor active={["netflix", "crave"]} />);
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
    renderWithProvider(<SubscriptionEditor active={[]} />);
    await user.click(screen.getByRole("button", { name: /disney\+/i }));
    expect(mockToggleSubscription).toHaveBeenCalledWith(
      "disney_plus",
    );
  });

  it("auto-fires a rec regeneration after a successful sub toggle", async () => {
    const user = userEvent.setup();
    renderWithProvider(<SubscriptionEditor active={[]} />);
    await user.click(screen.getByRole("button", { name: /netflix/i }));
    await waitFor(() => {
      expect(mockRegenerate).toHaveBeenCalledTimes(1);
    });
  });
});
