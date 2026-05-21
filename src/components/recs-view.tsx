"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecScope, RecFocus, RecItemCategory } from "@prisma/client";
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

// The three recommendation sections. `focus` is the RecFocus value that
// makes this category the headline section; the section heading and the
// focus selector both read off this table.
const CATEGORY_META: Record<
  RecItemCategory,
  { label: string; blurb: string; focus: RecFocus }
> = {
  new_show: {
    label: "New for you",
    blurb: "Shows you haven't started.",
    focus: "discover",
  },
  new_season: {
    label: "New seasons",
    blurb: "Shows you watch that have a new season out.",
    focus: "new_seasons",
  },
  continue_watching: {
    label: "Continue watching",
    blurb: "Shows you're partway through.",
    focus: "queue",
  },
};

const CATEGORY_BASE_ORDER: readonly RecItemCategory[] = [
  "new_show",
  "new_season",
  "continue_watching",
] as const;

// Focus selector options, in display order.
const FOCUS_OPTIONS: ReadonlyArray<{ value: RecFocus; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "discover", label: "Discover new" },
  { value: "new_seasons", label: "New seasons" },
  { value: "queue", label: "My queue" },
];

// Non-focused sections collapse to this many cards, with a "show all"
// expander, so a focused refresh keeps the headline section dominant.
const TEASER_COUNT = 3;

// Section order for a given focus: the focused category leads, the rest
// keep their base order behind it. `mixed` keeps the base order outright.
function sectionOrder(focus: RecFocus): RecItemCategory[] {
  if (focus === "mixed") return [...CATEGORY_BASE_ORDER];
  const focused = CATEGORY_BASE_ORDER.find(
    (c) => CATEGORY_META[c].focus === focus,
  );
  if (!focused) return [...CATEGORY_BASE_ORDER];
  return [focused, ...CATEGORY_BASE_ORDER.filter((c) => c !== focused)];
}

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
  // The focus the NEXT refresh will use. Seeded from the most recent run
  // so the selector reflects what's currently on screen.
  const [focus, setFocus] = useState<RecFocus>(
    initial.co_watch?.focus ?? "mixed",
  );
  // Manually-expanded teaser sections, keyed `${scope}:${category}` so
  // the state survives tab switches without a reset effect.
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  // Phase 41: mood + filters live behind a single "Refine" disclosure so
  // the rec list pushes up to the fold on first load.
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
    selectedPlatforms.size +
    selectedGenres.size +
    (mood.trim() ? 1 : 0) +
    (focus !== "mixed" ? 1 : 0);

  const onRefresh = async () => {
    const moodValue = mood.trim();
    await refresh(moodValue || undefined, focus);
    if (state === "success") setMood("");
  };

  const list = initial[active];

  // Format the "Generated" timestamp on the client so it reflects the
  // viewer's timezone — formatting during SSR would lock in the server's
  // UTC clock.
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

  // Bucket the filtered items by category for the grouped sections.
  const itemsByCategory = useMemo(() => {
    const buckets: Record<RecItemCategory, RecListItemView[]> = {
      new_show: [],
      new_season: [],
      continue_watching: [],
    };
    for (const item of filteredItems) buckets[item.category].push(item);
    return buckets;
  }, [filteredItems]);

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

  // Section layout is driven by the focus the run was GENERATED with,
  // not the pending selector value.
  const runFocus: RecFocus = list?.focus ?? "mixed";
  const orderedCategories = sectionOrder(runFocus);

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
          {/* Focus biases the NEXT refresh: which category leads and
              gets the most picks. It's a generation input, so it only
              takes effect after Refresh. */}
          <div>
            <span className="block font-mono text-mono uppercase text-ink-muted mb-2">
              Focus (applies on next refresh)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {FOCUS_OPTIONS.map((opt) => {
                const selected = focus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFocus(opt.value)}
                    aria-pressed={selected}
                    disabled={pending}
                    className={`
                      rounded-pill border px-3 py-1
                      font-mono text-mono uppercase
                      transition-colors
                      focus-visible:outline-2 focus-visible:outline-accent
                      focus-visible:outline-offset-2
                      disabled:cursor-not-allowed disabled:opacity-50
                      ${
                        selected
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border bg-surface text-ink-secondary hover:border-border-strong"
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
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
            {runFocus !== "mixed"
              ? ` · focus: ${
                  FOCUS_OPTIONS.find((o) => o.value === runFocus)?.label ??
                  runFocus
                }`
              : ""}
            {list.mood ? ` · mood: ${list.mood}` : ""}
            {anyFilterActive && (
              <>
                {" · "}
                showing {filteredItems.length} of {list.items.length}
              </>
            )}
          </p>

          <div className="mt-6 space-y-10">
            {orderedCategories.map((category) => {
              const items = itemsByCategory[category];
              const meta = CATEGORY_META[category];
              const isFocused =
                runFocus !== "mixed" && meta.focus === runFocus;
              // Hide an empty section unless it's the headline one — a
              // focused-but-empty section still explains itself.
              if (items.length === 0 && !isFocused) return null;

              const sectionKey = `${active}:${category}`;
              const manuallyExpanded = expandedSections[sectionKey] ?? false;
              // Teaser only when a focus is active, this isn't the
              // headline section, and there's more than a teaser's worth.
              const collapsible =
                runFocus !== "mixed" &&
                !isFocused &&
                items.length > TEASER_COUNT;
              const showAll = !collapsible || manuallyExpanded;
              const visible = showAll
                ? items
                : items.slice(0, TEASER_COUNT);
              const hiddenCount = items.length - visible.length;

              return (
                <section
                  key={category}
                  aria-label={meta.label}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-display text-2xl font-bold text-ink">
                      {meta.label}
                    </h2>
                    <span className="font-mono text-mono uppercase text-ink-muted">
                      {items.length}
                    </span>
                    <span className="font-body text-sm text-ink-muted">
                      {meta.blurb}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="font-body text-base text-ink-muted">
                      {category === "new_show"
                        ? "No new picks this time — try refreshing."
                        : "Nothing here right now."}
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-4">
                        {visible.map((item, idx) => (
                          <li
                            key={item.id}
                            className="animate-ink-in"
                            // Stagger 60ms per card per DESIGN_SPEC §8.1,
                            // capped so a long section doesn't leave the
                            // last card waiting.
                            style={{
                              animationDelay: `${Math.min(idx, 10) * 60}ms`,
                            }}
                          >
                            <RecCard
                              item={item}
                              partnerLabel={partnerDisplayName ?? "Partner"}
                            />
                          </li>
                        ))}
                      </ul>
                      {collapsible && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSections((prev) => ({
                              ...prev,
                              [sectionKey]: !manuallyExpanded,
                            }))
                          }
                          className="
                            inline-flex items-center gap-1
                            font-mono text-mono uppercase text-accent
                            transition-colors hover:underline
                            focus-visible:outline-2 focus-visible:outline-accent
                            focus-visible:outline-offset-2
                          "
                        >
                          {manuallyExpanded ? (
                            <>
                              <CaretUp size={12} weight="bold" aria-hidden />
                              <span>Show less</span>
                            </>
                          ) : (
                            <>
                              <CaretDown size={12} weight="bold" aria-hidden />
                              <span>Show all {items.length}</span>
                              <span className="sr-only">
                                ({hiddenCount} more)
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </section>
              );
            })}
          </div>
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
