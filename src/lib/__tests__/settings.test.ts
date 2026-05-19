import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
const mockSession = {
  userId: undefined as number | undefined,
  username: undefined as string | undefined,
  displayName: undefined as string | undefined,
  save: vi.fn(),
  destroy: vi.fn(),
};
const cookieStore = new Map<string, string>();
const mockCookieJar = {
  get: vi.fn((name: string) => {
    const v = cookieStore.get(name);
    return v ? { name, value: v } : undefined;
  }),
  set: vi.fn((name: string, value: string) => {
    cookieStore.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    cookieStore.delete(name);
  }),
};
const mockRevalidate = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));
vi.mock("next/headers", () => ({
  cookies: async () => mockCookieJar,
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

const {
  setThemeAction,
  getThemeOverride,
  toggleSubscriptionAction,
  getUserSubscriptions,
  setRecModelAction,
  getRecModel,
} = await import("@/lib/settings");

describe("setThemeAction", () => {
  beforeEach(() => {
    cookieStore.clear();
    mockCookieJar.set.mockClear();
    mockCookieJar.delete.mockClear();
    mockRevalidate.mockClear();
  });

  it("sets the theme cookie for 'light'", async () => {
    await setThemeAction("light");
    expect(mockCookieJar.set).toHaveBeenCalledWith(
      "theme",
      "light",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
    expect(mockRevalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("sets the theme cookie for 'dark'", async () => {
    await setThemeAction("dark");
    expect(mockCookieJar.set).toHaveBeenCalledWith(
      "theme",
      "dark",
      expect.any(Object),
    );
  });

  it("deletes the cookie for 'system' (falls back to OS preference)", async () => {
    cookieStore.set("theme", "dark");
    await setThemeAction("system");
    expect(mockCookieJar.delete).toHaveBeenCalledWith("theme");
    expect(mockCookieJar.set).not.toHaveBeenCalled();
  });

  it("throws on invalid theme value", async () => {
    await expect(setThemeAction("midnight")).rejects.toThrow(/invalid theme/i);
    expect(mockCookieJar.set).not.toHaveBeenCalled();
  });
});

describe("getThemeOverride", () => {
  beforeEach(() => cookieStore.clear());

  it("returns 'light' when the cookie is 'light'", async () => {
    cookieStore.set("theme", "light");
    expect(await getThemeOverride()).toBe("light");
  });

  it("returns 'dark' when the cookie is 'dark'", async () => {
    cookieStore.set("theme", "dark");
    expect(await getThemeOverride()).toBe("dark");
  });

  it("returns 'system' when there is no cookie", async () => {
    expect(await getThemeOverride()).toBe("system");
  });

  it("returns 'system' for an invalid cookie value", async () => {
    cookieStore.set("theme", "midnight");
    expect(await getThemeOverride()).toBe("system");
  });
});

describe("toggleSubscriptionAction", () => {
  beforeEach(() => {
    mockSession.userId = 1;
    mockPrisma.userSubscription.findUnique.mockReset();
    mockPrisma.userSubscription.create.mockReset();
    mockPrisma.userSubscription.delete.mockReset();
    mockRevalidate.mockClear();
  });

  it("creates a subscription when not already present", async () => {
    mockPrisma.userSubscription.findUnique.mockResolvedValueOnce(null);
    await toggleSubscriptionAction("netflix");
    expect(mockPrisma.userSubscription.create).toHaveBeenCalledWith({
      data: { userId: 1, platformKey: "netflix" },
    });
    expect(mockPrisma.userSubscription.delete).not.toHaveBeenCalled();
    expect(mockRevalidate).toHaveBeenCalledWith("/settings");
  });

  it("deletes an existing subscription", async () => {
    mockPrisma.userSubscription.findUnique.mockResolvedValueOnce({
      id: 99,
      userId: 1,
      platformKey: "netflix",
      createdAt: new Date(),
    });
    await toggleSubscriptionAction("netflix");
    expect(mockPrisma.userSubscription.delete).toHaveBeenCalledWith({
      where: { id: 99 },
    });
    expect(mockPrisma.userSubscription.create).not.toHaveBeenCalled();
  });

  it("throws when not authenticated", async () => {
    mockSession.userId = undefined;
    await expect(toggleSubscriptionAction("netflix")).rejects.toThrow(
      /not authenticated/i,
    );
    expect(mockPrisma.userSubscription.findUnique).not.toHaveBeenCalled();
  });

  it("throws on invalid platform key", async () => {
    await expect(toggleSubscriptionAction("hulu")).rejects.toThrow(
      /invalid platform/i,
    );
  });
});

describe("getUserSubscriptions", () => {
  beforeEach(() => {
    mockSession.userId = 1;
    mockPrisma.userSubscription.findMany.mockReset();
  });

  it("returns platform keys for the current user", async () => {
    mockPrisma.userSubscription.findMany.mockResolvedValueOnce([
      { platformKey: "netflix" },
      { platformKey: "crave" },
    ] as Array<{ platformKey: string }> as never);
    expect(await getUserSubscriptions()).toEqual(["netflix", "crave"]);
  });

  it("returns an empty array when not authenticated", async () => {
    mockSession.userId = undefined;
    expect(await getUserSubscriptions()).toEqual([]);
    expect(mockPrisma.userSubscription.findMany).not.toHaveBeenCalled();
  });
});

describe("setRecModelAction", () => {
  beforeEach(() => {
    mockSession.userId = 1;
    mockPrisma.user.update.mockReset();
    mockRevalidate.mockClear();
  });

  it("throws when not authenticated", async () => {
    mockSession.userId = undefined;
    await expect(setRecModelAction("haiku")).rejects.toThrow(
      /not authenticated/i,
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("throws on invalid model value", async () => {
    await expect(setRecModelAction("opus")).rejects.toThrow(/invalid rec model/i);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("persists the model and revalidates both /settings and /recs", async () => {
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    await setRecModelAction("sonnet");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { recModel: "sonnet" },
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/settings");
    expect(mockRevalidate).toHaveBeenCalledWith("/recs");
  });
});

describe("getRecModel", () => {
  beforeEach(() => {
    mockSession.userId = 1;
    mockPrisma.user.findUnique.mockReset();
  });

  it("returns null when not authenticated", async () => {
    mockSession.userId = undefined;
    expect(await getRecModel()).toBeNull();
  });

  it("returns the user's stored rec model", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      recModel: "sonnet",
    } as never);
    expect(await getRecModel()).toBe("sonnet");
  });

  it("returns null when the user row is missing", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await getRecModel()).toBeNull();
  });
});
