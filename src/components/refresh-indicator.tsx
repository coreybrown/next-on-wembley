"use client";

import Link from "next/link";
import { ArrowsClockwise, CheckCircle } from "@phosphor-icons/react";
import { useRefresh, isRefreshActive } from "@/components/refresh-context";

// Small status pill rendered in the layout header. Lives outside /recs
// so a refresh that's still in flight stays visible after the user
// navigates away (PRD §6.4.7 "not blocked — they can navigate freely").

export function RefreshIndicator() {
  const { state } = useRefresh();
  if (state === "idle") return null;

  if (state === "success") {
    return (
      <Link
        href="/recs"
        className="
          inline-flex items-center gap-1 rounded-pill
          border border-border bg-surface-elevated px-3 py-1
          font-mono text-mono uppercase text-ink-secondary
          transition-colors hover:border-accent hover:text-accent
          focus-visible:outline-2 focus-visible:outline-accent
          focus-visible:outline-offset-2
        "
        aria-live="polite"
      >
        <CheckCircle size={14} weight="fill" aria-hidden />
        <span>Recs updated — view</span>
      </Link>
    );
  }

  if (state === "error" || state === "timed_out") {
    return (
      <span
        role="status"
        className="
          inline-flex items-center gap-1 rounded-pill
          border border-danger bg-surface-elevated px-3 py-1
          font-mono text-mono uppercase text-danger
        "
      >
        <span>Refresh failed</span>
      </span>
    );
  }

  // pending or long_running
  const message =
    state === "long_running"
      ? "Still generating…"
      : "Refreshing recommendations…";
  return (
    <span
      role="status"
      aria-live="polite"
      className="
        inline-flex items-center gap-1 rounded-pill
        border border-border bg-surface-elevated px-3 py-1
        font-mono text-mono uppercase text-ink-secondary
      "
    >
      <ArrowsClockwise
        size={14}
        weight="regular"
        aria-hidden
        className="animate-spin"
      />
      <span>{message}</span>
    </span>
  );
}

// Helper export so consumers can also derive whether the layout pill
// "owns" the in-flight UI; useful when the page wants to know whether
// to show its own per-tab skeletons.
export { isRefreshActive };
