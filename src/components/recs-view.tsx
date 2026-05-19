"use client";

import { useState } from "react";
import type { RecScope } from "@prisma/client";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { type RecListView } from "@/app/actions/recommendations";
import { RecCard } from "@/components/rec-card";
import { RecCardSkeleton } from "@/components/rec-card-skeleton";
import {
  useRefresh,
  isRefreshActive,
} from "@/components/refresh-context";

const TAB_LABELS: Record<RecScope, string> = {
  co_watch: "Co-watch",
  corey: "Corey's Picks",
  jaimie: "Jaimie's Picks",
};

const TAB_ORDER: readonly RecScope[] = ["co_watch", "corey", "jaimie"] as const;

type Props = {
  initial: Record<RecScope, RecListView | null>;
};

export function RecsView({ initial }: Props) {
  const [active, setActive] = useState<RecScope>("co_watch");
  const [mood, setMood] = useState("");
  const { state, errorMessage, refresh, clearError } = useRefresh();

  const pending = isRefreshActive(state);

  const onRefresh = async () => {
    const moodValue = mood.trim();
    await refresh(moodValue || undefined);
    // Clear mood only on a fully clean refresh — keep it across failures so
    // the user can retry without retyping (PRD §6.4.7).
    if (state === "success") setMood("");
  };

  const list = initial[active];
  const anyList = TAB_ORDER.some((s) => initial[s] !== null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Recommendation lists" className="flex gap-2">
          {TAB_ORDER.map((scope) => {
            const selected = scope === active;
            const count = initial[scope]?.items.length ?? 0;
            return (
              <button
                key={scope}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActive(scope)}
                className={`
                  inline-flex items-center gap-2
                  rounded-pill border px-4 py-2
                  font-body text-sm
                  transition-colors
                  ${
                    selected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-surface text-ink hover:border-border-strong"
                  }
                  focus-visible:outline-2 focus-visible:outline-accent
                  focus-visible:outline-offset-2
                `}
              >
                <span>{TAB_LABELS[scope]}</span>
                {count > 0 && (
                  <span
                    className={`
                      font-mono text-mono uppercase
                      ${selected ? "text-accent-fg/80" : "text-ink-muted"}
                    `}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            className="
              inline-flex items-center gap-2
              rounded-md bg-accent px-4 py-2
              font-body text-base text-accent-fg
              transition-opacity hover:opacity-90
              disabled:cursor-not-allowed disabled:opacity-50
              focus-visible:outline-2 focus-visible:outline-accent-sharp
              focus-visible:outline-offset-2
            "
          >
            <ArrowsClockwise
              size={16}
              weight="regular"
              aria-hidden
              className={pending ? "animate-spin" : undefined}
            />
            <span>{pending ? "Generating…" : anyList ? "Refresh" : "Generate"}</span>
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="rec-mood"
          className="block font-mono text-mono uppercase text-ink-muted mb-2"
        >
          Mood (optional)
        </label>
        <textarea
          id="rec-mood"
          rows={2}
          placeholder="Slow burn, dark, character-driven…"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          disabled={pending}
          className="
            w-full rounded-sm border border-border bg-surface-elevated
            px-3 py-2
            font-body text-base text-ink
            focus:outline-2 focus:outline-accent focus:outline-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
          "
        />
      </div>

      {pending && (
        <section
          aria-label="Generating new recommendations"
          className="space-y-3 rounded-md border border-dashed border-border bg-surface-elevated/40 p-4"
        >
          <p className="font-mono text-mono uppercase text-ink-muted">
            Generating new recommendations…
          </p>
          <RecCardSkeleton />
          <RecCardSkeleton />
          <RecCardSkeleton />
          {state === "long_running" && (
            <p
              role="status"
              className="font-mono text-mono uppercase text-ink-muted"
            >
              Taking longer than usual — the LLM is busy. Hang tight.
            </p>
          )}
        </section>
      )}

      {(state === "error" || state === "timed_out") && errorMessage && (
        <section
          role="alert"
          className="rounded-md border border-danger bg-surface-elevated p-4 space-y-3"
        >
          <p className="font-mono text-mono text-danger">[{errorMessage}]</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="
                rounded-md bg-accent px-4 py-2
                font-body text-base text-accent-fg
                transition-opacity hover:opacity-90
                focus-visible:outline-2 focus-visible:outline-accent-sharp
                focus-visible:outline-offset-2
              "
            >
              Retry
            </button>
            <button
              type="button"
              onClick={clearError}
              className="
                rounded-md border border-border bg-surface px-4 py-2
                font-body text-base text-ink-secondary
                transition-colors hover:border-border-strong
                focus-visible:outline-2 focus-visible:outline-accent
                focus-visible:outline-offset-2
              "
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {!list ? (
        <section
          className="
            bg-empty rounded-md border border-border
            px-6 py-16 text-center
          "
        >
          <p className="font-display italic text-lg text-ink-secondary">
            No recommendations yet.
          </p>
          <p className="mt-3 font-body text-base text-ink-muted">
            Press {anyList ? "Refresh" : "Generate"} to ask Claude for{" "}
            {TAB_LABELS[active].toLowerCase()}.
          </p>
        </section>
      ) : (
        // Stale list stays visible during refresh, dimmed per PRD §6.4.7
        // so the user can still inspect old recs while waiting.
        <div className={pending ? "opacity-50" : undefined}>
          <p
            className="font-mono text-mono uppercase text-ink-muted"
            suppressHydrationWarning
          >
            Generated {new Date(list.createdAt).toLocaleString()} ·{" "}
            {list.modelId}
            {list.mood ? ` · mood: ${list.mood}` : ""}
          </p>
          <ul className="mt-4 space-y-4">
            {list.items.map((item) => (
              <li key={item.id}>
                <RecCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
