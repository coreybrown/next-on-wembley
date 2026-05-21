"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecScope } from "@prisma/client";
import {
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import {
  type RecListItemView,
  type RecListView,
  type DisagreedShow,
} from "@/app/actions/recommendations";
import { PLATFORMS } from "@/lib/platforms";
import { RecCard } from "@/components/rec-card";
import { RecCardSkeleton } from "@/components/rec-card-skeleton";
import { DisagreesInspector } from "@/components/disagrees-inspector";
import {
  useRefresh,
  isRefreshActive,
} from "@/components/refresh-context";

const TAB_LABELS: Record<RecScope, string> = {
  co_watch: "Co-watch",
  corey: "Corey's Picks",
  jaimie: "Jaimie's Picks",
};

// Shorter labels for the tab pills themselves — the full names wrapped
// to two lines on narrow phones. The full label rides along as the tab's
// aria-label, and TAB_LABELS still feeds the empty-state copy.
const TAB_LABELS_SHORT: Record<RecScope, string> = {
  co_watch: "Co-watch",
  corey: "Corey",
  jaimie: "Jaimie",
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
  // Shows the SESSION user has Disagreed on. Powers the "Buried
  // disagrees" inspector at the bottom of their own tab (Phase 28).
  disagreedShows: DisagreedShow[];
  // Session user's username. Inspector only renders on the matching
  // user-scoped tab (Corey only sees his own buried-disagrees on
  // Corey's Picks).
  viewerUsername: string;
  // True when subscriptions changed after the latest rec run — shows a
  // "refresh to update" note (sub changes no longer auto-regenerate).
  subscriptionsStale: boolean;
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
  disagreedShows,
  viewerUsername,
  subscriptionsStale,
}: Props) {
  const [active, setActive] = useState<RecScope>("co_watch");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + delta + TAB_ORDER.length) % TAB_ORDER.length;
    setActive(TAB_ORDER[nextIdx]!);
    tabRefs.current[nextIdx]?.focus();
  };
  const [mood, setMood] = useState("");
  // Phase 41: mood + filters live behind a single "Refine" disclosure so
  // the rec list pushes up to the fold on first load. Stays closed by
  // default; the active-filter count surfaces on the toggle.
  const [refineOpen, setRefineOpen] = useState(false);
  const { state, errorMessage, refresh, clearError } = useRefresh();
  const router = useRouter();
  const searchParams = useSearchParams();

  const pending = isRefreshActive(state);

  const selectedPlatforms = paramToSet(searchParams.get("platform"));
  const selectedGenres = paramToSet(searchParams.get("genre"));
  const anyFilterActive =
    selectedPlatforms.size > 0 || selectedGenres.size > 0;
  const refineCount =
    selectedPlatforms.size + selectedGenres.size + (mood.trim() ? 1 : 0);

  const onRefresh = async () => {
    const moodValue = mood.trim();
    await refresh(moodValue || undefined);
    if (state === "success") setMood("");
  };

  // Per PRD §6.4.6, the platform filter can only narrow to a subset of
  // the user's active subs — show those as the chip options. Genres
  // come from the items in the current tab.
  const list = initial[active];

  // Format the "Generated" timestamp on the client so it reflects the
  // viewer's timezone — formatting during SSR would lock in the server's
  // UTC clock. Null until mounted; the line tolerates the brief gap.
  const [generatedLabel, setGeneratedLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!list) {
      setGeneratedLabel(null);
      return;
    }
    setGeneratedLabel(
      new Date(list.createdAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [list]);

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-mono uppercase text-ink-muted">
            [Recommendations]
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-ink leading-none">
            What&rsquo;s next on Wembley
          </h1>
          <div aria-hidden className="mt-3 h-[2px] w-16 bg-accent-sharp" />
        </div>
        {/* Refresh regenerates ALL three lists — a page-level action, so
            it sits at the masthead (not in the per-tab row) and wears a
            quiet outline, leaving filled-accent to mark only the active
            tab. */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          className="
            inline-flex w-full items-center justify-center gap-2 sm:w-auto
            rounded-md border border-border-strong bg-surface px-4 py-2
            font-body text-base text-ink
            transition-colors hover:border-accent hover:text-accent
            disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          <ArrowsClockwise
            size={16}
            weight="regular"
            aria-hidden
            className={
              pending ? "animate-spin motion-reduce:animate-none" : undefined
            }
          />
          <span>{pending ? "Generating…" : anyList ? "Refresh" : "Generate"}</span>
        </button>
      </header>

      {subscriptionsStale && (
        <p
          role="status"
          className="rounded-md border border-border-strong bg-surface-elevated px-4 py-2.5 font-body text-sm text-ink-secondary"
        >
          Your subscriptions changed since these recommendations were
          generated. Hit Refresh to update them.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Recommendation lists" className="flex gap-2">
          {TAB_ORDER.map((scope, idx) => {
            const selected = scope === active;
            return (
              <button
                key={scope}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-label={TAB_LABELS[scope]}
                // Only the active tab is in the tab order — Tab moves
                // to the tab list, then Left/Right cycles within. Per
                // WAI-ARIA Authoring Practices for tablist.
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(scope)}
                onKeyDown={(e) => onTabKeyDown(e, idx)}
                className={`
                  rounded-pill border px-4 py-2
                  font-body text-base font-medium whitespace-nowrap
                  transition-colors
                  ${
                    selected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border-strong bg-surface text-ink hover:border-accent"
                  }
                  focus-visible:outline-2 focus-visible:outline-accent
                  focus-visible:outline-offset-2
                `}
              >
                {TAB_LABELS_SHORT[scope]}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setRefineOpen((v) => !v)}
          aria-expanded={refineOpen}
          aria-controls="refine-panel"
          className={`
            ml-auto inline-flex items-center gap-2
            rounded-md border px-3 py-2
            font-body text-base
            transition-colors
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
            ${
              refineOpen || refineCount > 0
                ? "border-border-strong bg-surface text-ink"
                : "border-border bg-surface text-ink-secondary hover:border-border-strong"
            }
          `}
        >
          <SlidersHorizontal size={16} weight="regular" aria-hidden />
          <span>Refine</span>
          {refineCount > 0 && (
            <span
              aria-label={`${refineCount} active`}
              className="
                inline-flex h-5 min-w-5 items-center justify-center
                rounded-pill bg-accent px-1.5
                font-mono text-mono text-accent-fg
              "
            >
              {refineCount}
            </span>
          )}
          {refineOpen ? (
            <CaretUp size={14} weight="bold" aria-hidden />
          ) : (
            <CaretDown size={14} weight="bold" aria-hidden />
          )}
        </button>
      </div>

      {refineOpen && (
        <section
          id="refine-panel"
          aria-label="Refine recommendations"
          className="space-y-4 rounded-md border border-border bg-surface-elevated px-4 py-4"
        >
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
                w-full rounded-sm border border-border bg-surface
                px-3 py-2
                font-body text-base text-ink
                focus:outline-2 focus:outline-accent focus:outline-offset-2
                disabled:cursor-not-allowed disabled:opacity-50
              "
            />
          </div>

          {list && (userSubKeys.length > 0 || availableGenres.length > 0) && (
            <div className="space-y-3">
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
                  <X size={14} weight="bold" aria-hidden />
                  <span>Clear filters</span>
                </button>
              )}
            </div>
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
          <p className="truncate font-mono text-mono uppercase text-ink-muted">
            {/* Secondary context — kept to a single compact line so it
                never wraps. Date is client-formatted (viewer's TZ). */}
            Generated {generatedLabel ?? "…"}
            {" · "}
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
            {filteredItems.map((item, idx) => (
              <li
                key={item.id}
                className="animate-ink-in"
                // Stagger 60ms per card per DESIGN_SPEC §8.1. Capped
                // around the visible window so a 25-pick co-watch list
                // doesn't leave the last card waiting >1.5s to appear.
                style={{ animationDelay: `${Math.min(idx, 10) * 60}ms` }}
              >
                <RecCard
                  item={item}
                  partnerLabel={partnerDisplayName ?? "Partner"}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Buried-disagrees inspector — only on the viewer's own
          user-scoped tab, since that's where the disagree filter
          actually hides items (Phase 28). */}
      {active === viewerUsername && (
        <DisagreesInspector shows={disagreedShows} />
      )}
    </div>
  );
}
