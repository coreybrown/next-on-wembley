"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecScope } from "@prisma/client";
import { ArrowsClockwise, X } from "@phosphor-icons/react";
import { type RecListItemView, type RecListView } from "@/app/actions/recommendations";
import { PLATFORMS } from "@/lib/platforms";
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

const PLATFORM_NAME = new Map<string, string>(
  PLATFORMS.map((p) => [p.key, p.displayName]),
);

type Props = {
  initial: Record<RecScope, RecListView | null>;
  userSubKeys: string[];
  // Display name of the household partner — used to label the
  // partner-vote indicator on Co-watch RecCards (M4 Phase 25).
  partnerDisplayName: string | null;
};

// Parses a comma-separated search param into a Set of non-empty trimmed
// tokens. Returns an empty set for null/empty input.
function paramToSet(raw: string | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function setToParam(values: Set<string>): string {
  return [...values].join(",");
}

function applyFilters(
  items: RecListItemView[],
  platforms: Set<string>,
  genres: Set<string>,
): RecListItemView[] {
  if (platforms.size === 0 && genres.size === 0) return items;
  return items.filter((item) => {
    if (platforms.size > 0) {
      const hit = item.providerKeys.some((k) => platforms.has(k));
      if (!hit) return false;
    }
    if (genres.size > 0) {
      const hit = item.genres.some((g) => genres.has(g));
      if (!hit) return false;
    }
    return true;
  });
}

export function RecsView({
  initial,
  userSubKeys,
  partnerDisplayName,
}: Props) {
  const [active, setActive] = useState<RecScope>("co_watch");
  const [mood, setMood] = useState("");
  const { state, errorMessage, refresh, clearError } = useRefresh();
  const router = useRouter();
  const searchParams = useSearchParams();

  const pending = isRefreshActive(state);

  const selectedPlatforms = paramToSet(searchParams.get("platform"));
  const selectedGenres = paramToSet(searchParams.get("genre"));
  const anyFilterActive =
    selectedPlatforms.size > 0 || selectedGenres.size > 0;

  const onRefresh = async () => {
    const moodValue = mood.trim();
    await refresh(moodValue || undefined);
    if (state === "success") setMood("");
  };

  // Per PRD §6.4.6, the platform filter can only narrow to a subset of
  // the user's active subs — show those as the chip options. Genres
  // come from the items in the current tab.
  const list = initial[active];

  const availableGenres = useMemo<string[]>(() => {
    if (!list) return [];
    const seen = new Set<string>();
    for (const item of list.items) {
      for (const g of item.genres) seen.add(g);
    }
    return [...seen].sort();
  }, [list]);

  const filteredItems = useMemo(
    () =>
      list ? applyFilters(list.items, selectedPlatforms, selectedGenres) : [],
    [list, selectedPlatforms, selectedGenres],
  );

  const updateParam = (key: string, values: Set<string>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (values.size === 0) {
      params.delete(key);
    } else {
      params.set(key, setToParam(values));
    }
    const query = params.toString();
    router.push(query ? `/recs?${query}` : "/recs", { scroll: false });
  };

  const togglePlatform = (key: string) => {
    const next = new Set(selectedPlatforms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    updateParam("platform", next);
  };

  const toggleGenre = (key: string) => {
    const next = new Set(selectedGenres);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    updateParam("genre", next);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("platform");
    params.delete("genre");
    const query = params.toString();
    router.push(query ? `/recs?${query}` : "/recs", { scroll: false });
  };

  const anyList = TAB_ORDER.some((s) => initial[s] !== null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Recommendation lists" className="flex gap-2">
          {TAB_ORDER.map((scope) => {
            const selected = scope === active;
            return (
              <button
                key={scope}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActive(scope)}
                className={`
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
                {TAB_LABELS[scope]}
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

      {list && (userSubKeys.length > 0 || availableGenres.length > 0) && (
        <section
          aria-label="Filters"
          className="space-y-3 rounded-md border border-border bg-surface-elevated px-4 py-3"
        >
          {userSubKeys.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-mono uppercase text-ink-muted">
                Platform
              </span>
              {userSubKeys.map((key) => {
                const selected = selectedPlatforms.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePlatform(key)}
                    aria-pressed={selected}
                    className={`
                      rounded-pill border px-3 py-1
                      font-mono text-mono uppercase
                      transition-colors
                      focus-visible:outline-2 focus-visible:outline-accent
                      focus-visible:outline-offset-2
                      ${
                        selected
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border bg-surface text-ink-secondary hover:border-border-strong"
                      }
                    `}
                  >
                    {PLATFORM_NAME.get(key) ?? key}
                  </button>
                );
              })}
            </div>
          )}
          {availableGenres.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-mono uppercase text-ink-muted">
                Genre
              </span>
              {availableGenres.map((g) => {
                const selected = selectedGenres.has(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    aria-pressed={selected}
                    className={`
                      rounded-pill border px-3 py-1
                      font-mono text-mono uppercase
                      transition-colors
                      focus-visible:outline-2 focus-visible:outline-accent
                      focus-visible:outline-offset-2
                      ${
                        selected
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border bg-surface text-ink-secondary hover:border-border-strong"
                      }
                    `}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          )}
          {anyFilterActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="
                inline-flex items-center gap-1
                font-mono text-mono uppercase text-ink-muted
                transition-colors hover:text-ink
                focus-visible:outline-2 focus-visible:outline-accent
                focus-visible:outline-offset-2
              "
            >
              <X size={12} weight="bold" aria-hidden />
              <span>Clear filters</span>
            </button>
          )}
        </section>
      )}

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
      ) : filteredItems.length === 0 ? (
        <section
          className="
            bg-empty rounded-md border border-border
            px-6 py-12 text-center
          "
        >
          <p className="font-display italic text-base text-ink-secondary">
            No recommendations match your filters.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="
              mt-3 inline-flex items-center gap-1
              font-mono text-mono uppercase text-accent
              hover:underline
              focus-visible:outline-2 focus-visible:outline-accent
              focus-visible:outline-offset-2
            "
          >
            <X size={12} weight="bold" aria-hidden />
            <span>Clear filters</span>
          </button>
        </section>
      ) : (
        <div className={pending ? "opacity-50" : undefined}>
          <p
            className="font-mono text-mono uppercase text-ink-muted"
            suppressHydrationWarning
          >
            Generated {new Date(list.createdAt).toLocaleString()} ·{" "}
            {list.modelId}
            {list.mood ? ` · mood: ${list.mood}` : ""}
            {anyFilterActive && (
              <>
                {" · "}
                showing {filteredItems.length} of {list.items.length}
              </>
            )}
          </p>
          <ul className="mt-4 space-y-4">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <RecCard
                  item={item}
                  partnerLabel={partnerDisplayName ?? "Partner"}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
