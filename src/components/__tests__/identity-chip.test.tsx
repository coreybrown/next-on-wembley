import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", () => ({
  loginAction: vi.fn(async (_prev: unknown, _formData: FormData) => ({
    error: null,
  })),
  logoutAction: vi.fn(),
}));

import { IdentityChip } from "@/components/identity-chip";
import { loginAction, logoutAction } from "@/lib/auth";

const corey = { id: 1, username: "corey", displayName: "Corey" };
const jaimie = { id: 2, username: "jaimie", displayName: "Jaimie" };

describe("<IdentityChip />", () => {
  beforeEach(() => {
    vi.mocked(loginAction).mockClear();
    vi.mocked(logoutAction).mockClear();
    vi.mocked(loginAction).mockImplementation(async () => ({ error: null }));
  });

  const triggerLabel = /signed in as corey\. open user menu/i;
  const triggerLabelJaimie = /signed in as jaimie\. open user menu/i;

  it("renders the user's monogram with an accessible label", () => {
    render(<IdentityChip currentUser={corey} />);
    const btn = screen.getByRole("button", { name: triggerLabel });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("C");
  });

  it("opens a menu with Settings / Switch user / Log out items", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(screen.getByRole("button", { name: triggerLabel }));

    expect(
      await screen.findByRole("menuitem", { name: /settings/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /switch user/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it("opens the switch dialog naming the OTHER user when Switch user is chosen", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(screen.getByRole("button", { name: triggerLabel }));
    await user.click(
      await screen.findByRole("menuitem", { name: /switch user/i }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/enter jaimie’s passcode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jaimie’s passcode/i)).toBeInTheDocument();
  });

  it("names Corey as the other user when Jaimie is signed in", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={jaimie} />);
    await user.click(screen.getByRole("button", { name: triggerLabelJaimie }));
    await user.click(
      await screen.findByRole("menuitem", { name: /switch user/i }),
    );

    expect(
      await screen.findByText(/enter corey’s passcode/i),
    ).toBeInTheDocument();
  });

  it("submits the switch form with the other user's username and entered passcode", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(screen.getByRole("button", { name: triggerLabel }));
    await user.click(
      await screen.findByRole("menuitem", { name: /switch user/i }),
    );
    await user.type(
      await screen.findByLabelText(/jaimie’s passcode/i),
      "jaimie-pass",
    );
    await user.click(screen.getByRole("button", { name: /switch to jaimie/i }));

    expect(vi.mocked(loginAction)).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(loginAction).mock.calls[0]![1] as FormData;
    expect(fd.get("username")).toBe("jaimie");
    expect(fd.get("passcode")).toBe("jaimie-pass");
  });

  it("Log out menu item submits to logoutAction", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(screen.getByRole("button", { name: triggerLabel }));
    await user.click(
      await screen.findByRole("menuitem", { name: /log out/i }),
    );

    expect(vi.mocked(logoutAction)).toHaveBeenCalledTimes(1);
  });

  it("Settings menu item links to /settings", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(screen.getByRole("button", { name: triggerLabel }));
    const link = await screen.findByRole("menuitem", { name: /settings/i });
    expect(link).toHaveAttribute("href", "/settings");
  });
});
