import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPasscode, hashPasscode } from "@/lib/passcode";

describe("verifyPasscode", () => {
  let hash: string;
  beforeAll(async () => {
    hash = await bcrypt.hash("correct-passcode", 4);
  });

  it("returns true for the matching passcode", async () => {
    expect(await verifyPasscode("correct-passcode", hash)).toBe(true);
  });

  it("returns false for a wrong passcode", async () => {
    expect(await verifyPasscode("wrong", hash)).toBe(false);
  });

  it("returns false for empty plain input", async () => {
    expect(await verifyPasscode("", hash)).toBe(false);
  });

  it("returns false for empty hash input", async () => {
    expect(await verifyPasscode("anything", "")).toBe(false);
  });
});

describe("hashPasscode", () => {
  it("produces a bcrypt hash that verifies against itself", async () => {
    const h = await hashPasscode("hello-wembley");
    expect(h).toMatch(/^\$2[ayb]\$/);
    expect(await bcrypt.compare("hello-wembley", h)).toBe(true);
  });
});
