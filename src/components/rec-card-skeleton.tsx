"use client";

// Skeleton card shown while a refresh is in flight (Phase 18). Matches
// the rough layout of RecCard so the user sees what's coming. Shimmer
// effect via the `animate-pulse` Tailwind utility.

export function RecCardSkeleton() {
  return (
    <article
      aria-hidden
      className="
        flex animate-pulse items-start gap-4
        rounded-md border border-border bg-surface-elevated
        px-5 py-4
      "
    >
      <div className="flex flex-shrink-0 flex-col items-center gap-2">
        <div className="h-6 w-4 rounded-sm bg-surface-overlay" />
        <div className="h-[96px] w-16 rounded-sm bg-surface-overlay" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-5 w-2/3 rounded-sm bg-surface-overlay" />
        <div className="h-3 w-1/4 rounded-sm bg-surface-overlay" />
        <div className="h-3 w-full rounded-sm bg-surface-overlay" />
        <div className="h-3 w-5/6 rounded-sm bg-surface-overlay" />
        <div className="flex gap-2 pt-2">
          <div className="h-5 w-16 rounded-pill bg-surface-overlay" />
          <div className="h-5 w-16 rounded-pill bg-surface-overlay" />
        </div>
      </div>
    </article>
  );
}
