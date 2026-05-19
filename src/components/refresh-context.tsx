"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { regenerateAllLists } from "@/app/actions/recommendations";

// Phase 18: background-generation state machine.
// idle → pending → (after 30s, long_running) → (after 60s, timed_out)
//                                              | error
//                                              | success
// The server action keeps running after a client-side timeout; the next
// /recs render picks up whatever it persists. The client just stops
// waiting and surfaces the error UI so the user isn't stuck.

export type RefreshState =
  | "idle"
  | "pending"
  | "long_running"
  | "timed_out"
  | "error"
  | "success";

const LONG_RUNNING_MS = 30_000;
const TIMEOUT_MS = 60_000;
// How long the "Recommendations updated" pill stays visible before
// returning to idle.
const SUCCESS_FLASH_MS = 4_000;

type RefreshContextValue = {
  state: RefreshState;
  errorMessage: string | null;
  refresh: (mood?: string) => Promise<void>;
  clearError: () => void;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

type FailureResult = {
  ok: false;
  error: "unauthorized" | "not_found" | "anthropic_failed" | "no_valid_items";
  errorMessage?: string;
};

function formatFailureMessage(failures: FailureResult[], total: number): string {
  const allFailed = failures.length === total;
  const codes = new Set(failures.map((f) => f.error));
  const prefix = allFailed
    ? "All three lists failed to generate."
    : `${failures.length} of ${total} lists failed — others succeeded.`;
  if (codes.size !== 1) return `${prefix} Try again in a moment.`;
  const code = [...codes][0]!;
  switch (code) {
    case "anthropic_failed": {
      const detail = failures.find((f) => f.errorMessage)?.errorMessage;
      return detail
        ? `${prefix} ${detail}`
        : `${prefix} Recommendation service is unreachable. Check your API key or try again in a moment.`;
    }
    case "no_valid_items":
      return `${prefix} The recommendation service returned picks, but none could be matched against TMDb or your subscriptions. Try a different mood, or check your active subscriptions in /settings.`;
    case "unauthorized":
      return `${prefix} You're signed out — refresh the page and sign in again.`;
    case "not_found":
      return `${prefix} A user account couldn't be found. Re-seed the database or sign back in.`;
  }
}

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RefreshState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // A monotonically-increasing token so a server-side result that arrives
  // after a client-side timeout (or a second Refresh click) is silently
  // dropped instead of stomping the current state.
  const invocationRef = useRef(0);
  const longRunningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (longRunningTimerRef.current) clearTimeout(longRunningTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    longRunningTimerRef.current = null;
    timeoutTimerRef.current = null;
  };

  const refresh = useCallback(async (mood?: string) => {
    const myInvocation = ++invocationRef.current;
    if (successFlashRef.current) clearTimeout(successFlashRef.current);
    clearTimers();
    setErrorMessage(null);
    setState("pending");

    longRunningTimerRef.current = setTimeout(() => {
      if (invocationRef.current === myInvocation) {
        setState("long_running");
      }
    }, LONG_RUNNING_MS);
    timeoutTimerRef.current = setTimeout(() => {
      if (invocationRef.current === myInvocation) {
        // Bump the invocation token so the still-in-flight action result
        // is treated as stale when it lands.
        invocationRef.current++;
        setErrorMessage(
          "Recommendation generation took longer than 60 seconds. The server may still be working — Retry to wait again, or try later.",
        );
        setState("timed_out");
      }
    }, TIMEOUT_MS);

    try {
      const results = await regenerateAllLists(mood);
      if (invocationRef.current !== myInvocation) return; // stale
      clearTimers();
      const failures = results.filter((r) => !r.ok) as FailureResult[];
      if (failures.length === 0) {
        setState("success");
        successFlashRef.current = setTimeout(() => {
          if (invocationRef.current === myInvocation) setState("idle");
        }, SUCCESS_FLASH_MS);
      } else {
        setErrorMessage(formatFailureMessage(failures, results.length));
        setState("error");
      }
    } catch (err) {
      if (invocationRef.current !== myInvocation) return;
      clearTimers();
      setErrorMessage(
        err instanceof Error ? err.message : "Refresh failed unexpectedly.",
      );
      setState("error");
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setState("idle");
  }, []);

  return (
    <RefreshContext.Provider
      value={{ state, errorMessage, refresh, clearError }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh(): RefreshContextValue {
  const ctx = useContext(RefreshContext);
  if (!ctx) {
    throw new Error("useRefresh must be called inside a <RefreshProvider>");
  }
  return ctx;
}

export function isRefreshActive(state: RefreshState): boolean {
  return state === "pending" || state === "long_running";
}
