import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", () => ({
  loginAction: vi.fn(async (_prev: unknown, _formData: FormData) => ({
    error: null,
  })),
}));

import { LoginCard } from "@/components/login-card";
import { loginAction } from "@/lib/auth";

describe("<LoginCard />", () => {
  beforeEach(() => {
    vi.mocked(loginAction).mockClear();
    vi.mocked(loginAction).mockImplementation(async () => ({ error: null }));
  });

  it("renders the masthead, fieldset, passcode input, and submit", () => {
    render(<LoginCard />);
    expect(
      screen.getByRole("heading", { level: 1, name: /next on wembley/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /signing in/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Passcode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("offers Corey and Jaimie as the only user options", () => {
    render(<LoginCard />);
    expect(screen.getByRole("radio", { name: /corey/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /jaimie/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("submits the form with the selected user and passcode", async () => {
    const user = userEvent.setup();
    render(<LoginCard />);
    await user.click(screen.getByRole("radio", { name: /corey/i }));
    await user.type(screen.getByLabelText("Passcode"), "mypass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(vi.mocked(loginAction)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(loginAction).mock.calls[0];
    expect(call).toBeDefined();
    const fd = call![1] as FormData;
    expect(fd.get("username")).toBe("corey");
    expect(fd.get("passcode")).toBe("mypass");
  });

  it("surfaces an error returned from the action", async () => {
    vi.mocked(loginAction).mockImplementationOnce(async () => ({
      error: "Incorrect passcode.",
    }));
    const user = userEvent.setup();
    render(<LoginCard />);
    await user.click(screen.getByRole("radio", { name: /jaimie/i }));
    await user.type(screen.getByLabelText("Passcode"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/incorrect passcode/i);
  });
});
