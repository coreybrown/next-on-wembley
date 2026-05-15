import { describe, it, expect } from "vitest";

describe("prisma singleton", () => {
  it("returns the same instance across repeat imports", async () => {
    const a = (await import("@/lib/db")).prisma;
    const b = (await import("@/lib/db")).prisma;
    expect(a).toBe(b);
  });

  it("caches on globalThis in non-production", async () => {
    const { prisma } = await import("@/lib/db");
    const cached = (globalThis as unknown as { prisma?: unknown }).prisma;
    expect(cached).toBe(prisma);
  });
});
