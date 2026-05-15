import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("<Home /> splash page", () => {
  it("renders the masthead and byline", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /next on wembley/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a weekly column of what to watch/i),
    ).toBeInTheDocument();
  });
});
