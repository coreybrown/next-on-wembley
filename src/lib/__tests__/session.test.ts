import { describe, it, expect } from "vitest";
import { sessionOptions, SESSION_COOKIE_NAME } from "@/lib/session";

describe("sessionOptions", () => {
  it("uses SESSION_SECRET from env as password", () => {
    expect(sessionOptions.password).toBe(process.env.SESSION_SECRET);
    expect(String(sessionOptions.password).length).toBeGreaterThanOrEqual(32);
  });

  it("uses the expected cookie name", () => {
    expect(sessionOptions.cookieName).toBe(SESSION_COOKIE_NAME);
    expect(SESSION_COOKIE_NAME).toBe("now_session");
  });

  it("is HTTP-only, SameSite=Lax, path=/", () => {
    expect(sessionOptions.cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("disables Secure outside production", () => {
    expect(sessionOptions.cookieOptions?.secure).toBe(false);
  });
});
