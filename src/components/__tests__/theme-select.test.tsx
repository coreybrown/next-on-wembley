import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/settings", () => ({
  setThemeAction: vi.fn(async () => {}),
}));

import { ThemeSelect } from "@/components/theme-select";
import { setThemeAction } from "@/lib/settings";

describe("<ThemeSelect />", () => {
  beforeEach(() => {
    vi.mocked(setThemeAction).mockClear();
  });

  it("renders System, Light, and Dark options", () => {
    render(<ThemeSelect current="system" />);
    expect(screen.getByRole("radio", { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /dark/i })).toBeInTheDocument();
  });

  it("checks the current option", () => {
    render(<ThemeSelect current="dark" />);
    expect(screen.getByRole("radio", { name: /dark/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /light/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /system/i })).not.toBeChecked();
  });

  it("calls setThemeAction with the new value on change", async () => {
    const user = userEvent.setup();
    render(<ThemeSelect current="system" />);
    await user.click(screen.getByRole("radio", { name: /dark/i }));
    expect(vi.mocked(setThemeAction)).toHaveBeenCalledWith("dark");
  });
});
