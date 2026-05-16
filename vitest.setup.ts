import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest 4 + RTL 16: auto-cleanup isn't registered automatically. Do it manually.
afterEach(() => {
  cleanup();
});

// Test env defaults — set before any module reads process.env at import time.
process.env.SESSION_SECRET ??=
  "test-session-secret-must-be-at-least-32-chars-long";
process.env.BCRYPT_COST ??= "4"; // fast hashing in tests

// server-only is a Next.js build-time guard; stub it out for Vitest so
// modules that import it can be loaded in jsdom.
vi.mock("server-only", () => ({}));

// Auto-cleanup: Vitest 3 + RTL 16 auto-runs cleanup() after each test when
// globals: true AND "@testing-library/jest-dom/vitest" is imported.
// No manual afterEach(cleanup) needed.

// next/headers — used by async server components (e.g., layout.tsx)
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (_name: string) => undefined,
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));

// next/navigation — for client components using useRouter (Phase 2+)
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// next/font/google — mandatory. Without this, bare Vitest tries to hit Google
// during test collection and component tests time out.
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces", className: "font-fraunces" }),
  Chivo: () => ({ variable: "--font-chivo", className: "font-chivo" }),
  JetBrains_Mono: () => ({
    variable: "--font-jetbrains-mono",
    className: "font-jetbrains-mono",
  }),
}));
