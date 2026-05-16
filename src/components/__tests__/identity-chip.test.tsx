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

  it("renders the user's monogram with an accessible label", () => {
    render(<IdentityChip currentUser={corey} />);
    const btn = screen.getByRole("button", {
      name: /currently signed in as corey/i,
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("C");
  });

  it("opens a dialog naming the OTHER user when clicked", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(
      screen.getByRole("button", { name: /currently signed in as corey/i }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/enter jaimie's passcode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jaimie's passcode/i)).toBeInTheDocument();
  });

  it("names Corey as the other user when Jaimie is signed in", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={jaimie} />);
    await user.click(
      screen.getByRole("button", { name: /currently signed in as jaimie/i }),
    );

    expect(
      await screen.findByText(/enter corey's passcode/i),
    ).toBeInTheDocument();
  });

  it("submits the switch form with the other user's username and entered passcode", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(
      screen.getByRole("button", { name: /currently signed in as corey/i }),
    );
    await user.type(
      await screen.findByLabelText(/jaimie's passcode/i),
      "jaimie-pass",
    );
    await user.click(screen.getByRole("button", { name: /switch to jaimie/i }));

    expect(vi.mocked(loginAction)).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(loginAction).mock.calls[0]![1] as FormData;
    expect(fd.get("username")).toBe("jaimie");
    expect(fd.get("passcode")).toBe("jaimie-pass");
  });

  it("offers a sign-out option that calls logoutAction", async () => {
    const user = userEvent.setup();
    render(<IdentityChip currentUser={corey} />);
    await user.click(
      screen.getByRole("button", { name: /currently signed in as corey/i }),
    );
    await user.click(
      await screen.findByRole("button", { name: /sign out completely/i }),
    );

    expect(vi.mocked(logoutAction)).toHaveBeenCalledTimes(1);
  });
});
