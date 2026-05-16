import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const mockPrisma = mockDeep<PrismaClient>();
const mockSession = {
  userId: undefined as number | undefined,
  username: undefined as string | undefined,
  displayName: undefined as string | undefined,
  save: vi.fn(async () => {}),
  destroy: vi.fn(),
};
const mockGetSession = vi.fn(async () => mockSession);
const mockRedirect = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

// Imported after mocks are registered.
const { loginAction, logoutAction, getCurrentUser } = await import("@/lib/auth");

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("loginAction", () => {
  beforeEach(() => {
    mockSession.userId = undefined;
    mockSession.username = undefined;
    mockSession.displayName = undefined;
    mockSession.save.mockClear();
    mockRedirect.mockClear();
    mockPrisma.user.findUnique.mockReset();
  });

  it("returns an error when username is empty", async () => {
    const res = await loginAction({ error: null }, fd({ username: "", passcode: "x" }));
    expect(res.error).toMatch(/choose a user/i);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns an error when passcode is empty", async () => {
    const res = await loginAction({ error: null }, fd({ username: "corey", passcode: "" }));
    expect(res.error).toMatch(/passcode/i);
  });

  it("returns an error when the user does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await loginAction({ error: null }, fd({ username: "nobody", passcode: "x" }));
    expect(res.error).toMatch(/incorrect/i);
  });

  it("returns an error when the passcode is wrong", async () => {
    const goodHash = await bcrypt.hash("right-pass", 4);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      username: "corey",
      displayName: "Corey",
      passcodeHash: goodHash,
      createdAt: new Date(),
    });
    const res = await loginAction(
      { error: null },
      fd({ username: "corey", passcode: "wrong-pass" }),
    );
    expect(res.error).toMatch(/incorrect/i);
    expect(mockSession.save).not.toHaveBeenCalled();
  });

  it("sets session and redirects to / on correct passcode", async () => {
    const goodHash = await bcrypt.hash("right-pass", 4);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 42,
      username: "corey",
      displayName: "Corey",
      passcodeHash: goodHash,
      createdAt: new Date(),
    });
    await loginAction({ error: null }, fd({ username: "corey", passcode: "right-pass" }));
    expect(mockSession.userId).toBe(42);
    expect(mockSession.username).toBe("corey");
    expect(mockSession.displayName).toBe("Corey");
    expect(mockSession.save).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});

describe("logoutAction", () => {
  beforeEach(() => {
    mockSession.destroy.mockClear();
    mockRedirect.mockClear();
  });

  it("destroys the session and redirects to /login", async () => {
    await logoutAction();
    expect(mockSession.destroy).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    mockSession.userId = undefined;
    mockSession.username = undefined;
    mockSession.displayName = undefined;
  });

  it("returns null when no userId in session", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns user shape when session has userId", async () => {
    mockSession.userId = 7;
    mockSession.username = "jaimie";
    mockSession.displayName = "Jaimie";
    expect(await getCurrentUser()).toEqual({
      id: 7,
      username: "jaimie",
      displayName: "Jaimie",
    });
  });
});
