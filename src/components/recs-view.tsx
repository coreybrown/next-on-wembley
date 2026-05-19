"use client";

import { useState, useTransition } from "react";
import type { RecScope } from "@prisma/client";
import { ArrowsClockwise } from "@phosphor-icons/react";
import {
  regenerateAllLists,
  type RecListView,
} from "@/app/actions/recommendations";
import { RecCard } from "@/components/rec-card";

const TAB_LABELS: Record<RecScope, string> = {
  co_watch: "Co-watch",
  corey: "Corey's Picks",
  jaimie: "Jaimie's Picks",
};

const TAB_ORDER: readonly RecScope[] = ["co_watch", "corey", "jaimie"] as const;

type FailureResult = {
  ok: false;
  error: "unauthorized" | "not_found" | "anthropic_failed" | "no_valid_items";
  errorMessage?: string;
};

// Maps action-level error codes to user-facing copy. We collapse to a
// single message when every failure shares a code so the user gets a
// specific hint ("check your API key"); on mixed-code failures we fall
// back to a generic summary.
function formatFailureMessage(
  failures: FailureResult[],
  allFailed: boolean,
): string {
  const codes = new Set(failures.map((f) => f.error));
  const prefix = allFailed
    ? "All three lists failed to generate."
    : `${failures.length} of 3 lists failed — others succeeded.`;
  if (codes.size !== 1) return `${prefix} Try again in a moment.`;
  const code = [...codes][0]!;
  switch (code) {
    case "anthropic_failed": {
      // The action surfaces the typed error message from the SDK
      // (auth / rate-limit / transient). Prefer it if present.
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

type Props = {
  initial: Record<RecScope, RecListView | null>;
};

export function RecsView({ initial }: Props) {
  const [active, setActive] = useState<RecScope>("co_watch");
  const [mood, setMood] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setError(null);
    const moodValue = mood.trim();
    startTransition(async () => {
      const results = await regenerateAllLists(moodValue || undefined);
      const failures = results.filter((r) => !r.ok) as Array<
        Extract<(typeof results)[number], { ok: false }>
      >;
      if (failures.length === 0) {
        // Clear mood after a fully successful refresh; otherwise keep it so
        // the user can retry without retyping (PRD §6 latency UX).
        setMood("");
      } else {
        const allFailed = failures.length === results.length;
        setError(formatFailureMessage(failures, allFailed));
      }
    });
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
            onClick={refresh}
            disabled={isPending}
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
              className={isPending ? "animate-spin" : undefined}
            />
            <span>{isPending ? "Generating…" : anyList ? "Refresh" : "Generate"}</span>
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
          disabled={isPending}
          className="
            w-full rounded-sm border border-border bg-surface-elevated
            px-3 py-2
            font-body text-base text-ink
            focus:outline-2 focus:outline-accent focus:outline-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
          "
        />
      </div>

      {error && (
        <p role="alert" className="font-mono text-mono text-danger">
          [{error}]
        </p>
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
        <>
          <p
            className="font-mono text-mono uppercase text-ink-muted"
            suppressHydrationWarning
          >
            Generated {new Date(list.createdAt).toLocaleString()} ·{" "}
            {list.modelId}
            {list.mood ? ` · mood: ${list.mood}` : ""}
          </p>
          <ul className="space-y-4">
            {list.items.map((item) => (
              <li key={item.id}>
                <RecCard item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
