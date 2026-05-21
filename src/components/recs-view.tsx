"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { RecScope, RecItemCategory } from "@prisma/client";
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
import { TV_GENRES } from "@/lib/genres";
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
// to two lines on narrow phones.
const TAB_LABELS_SHORT: Record<RecScope, string> = {
  co_watch: "Co-watch",
  corey: "Corey",
  jaimie: "Jaimie",
};

const TAB_ORDER: readonly RecScope[] = ["co_watch", "corey", "jaimie"] as const;

const PLATFORM_NAME = new Map<string, string>(
  PLATFORMS.map((p) => [p.key, p.displayName]),
);

// The three recommendation sections, in fixed display order. /recs is a
// discovery surface, so "New for you" always leads. "New seasons" is
// time-sensitive news and stays fully expanded; only "Continue watching"
// (a queue reminder the viewer already knows) collapses to a teaser.
const CATEGORY_ORDER: readonly RecItemCategory[] = [
  "new_show",
  "new_season",
  "continue_watching",
] as const;

const CATEGORY_META: Record<
  RecItemCategory,
  { label: string; blurb: string }
> = {
  new_show: {
    label: "New for you",
    blurb: "Shows you haven't started.",
  },
  new_season: {
    label: "New seasons",
    blurb: "Shows you watch that have a new season out.",
  },
  continue_watching: {
    label: "Continue watching",
    blurb: "Shows you're partway through.",
  },
};

// Only "Continue watching" collapses; it teasers to this many cards.
const TEASER_COUNT = 3;

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
  // user-scoped tab.
  viewerUsername: string;
  // True when subscriptions changed after the latest rec run — shows a
  // "refresh to update" note.
  subscriptionsStale: boolean;
};

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
  // Refine inputs — genre is a soft nudge, platform a hard restriction.
  // Both feed the LLM on the next refresh (they no longer filter the
  // current list), so they behave like mood: a generation input.
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    () => new Set(),
  );
  // Manually-expanded "Continue watching" teaser, keyed by scope.
  const [expandedScopes, setExpandedScopes] = useState<
    Record<string, boolean>
  >({});
  const [refineOpen, setRefineOpen] = useState(false);
  const { state, errorMessage, refresh, clearError } = useRefresh();

  const pending = isRefreshActive(state);

  const refineCount =
    selectedGenres.size +
    selectedPlatforms.size +
    (mood.trim() ? 1 : 0);

  const onRefresh = async () => {
    const moodValue = mood.trim();
    await refresh({
      mood: moodValue || undefined,
      genres: selectedGenres.size > 0 ? [...selectedGenres] : undefined,
      platforms:
        selectedPlatforms.size > 0 ? [...selectedPlatforms] : undefined,
    });
    // Mood is a one-shot vibe — clear it. Genre/platform are sticky
    // session preferences, so they survive the refresh.
    if (state === "success") setMood("");
  };

  const list = initial[active];

  // Format the "Generated" timestamp on the client so it reflects the
  // viewer's timezone.
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

  // Bucket the run's items into the three category sections.
  const itemsByCategory = useMemo(() => {
    const buckets: Record<RecItemCategory, RecListItemView[]> = {
      new_show: [],
      new_season: [],
      continue_watching: [],
    };
    if (list) for (const item of list.items) buckets[item.category].push(item);
    return buckets;
  }, [list]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const togglePlatform = (key: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearRefine = () => {
    setSelectedGenres(new Set());
    setSelectedPlatforms(new Set());
    setMood("");
  };

  const anyList = TAB_ORDER.some((s) => initial[s] !== null);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-mono uppercase text-ink-muted">
            [Recommendations]
          </p>
          <h1 className="mt-3 font-display text-4xl font-black text-ink leading-none">
            What&rsquo;s next on Wembley
          </h1>
          <div aria-hidden className="mt-3 h-[2px] w-16 bg-accent-sharp" />
        </div>
        {/* Refresh + Refine sit together: Refine configures the inputs,
            Refresh runs them. Grouping makes that relationship legible. */}
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setRefineOpen((v) => !v)}
            aria-expanded={refineOpen}
            aria-controls="refine-panel"
            className={`
              inline-flex flex-1 items-center justify-center gap-2 sm:flex-none
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
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            className="
              inline-flex flex-1 items-center justify-center gap-2 sm:flex-none
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
            <span>
              {pending ? "Generating…" : anyList ? "Refresh" : "Generate"}
            </span>
          </button>
        </div>
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

      {refineOpen && (
        <section
          id="refine-panel"
          aria-label="Refine recommendations"
          className="space-y-4 rounded-md border border-border bg-surface-elevated px-4 py-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-mono uppercase text-ink-muted">
              Refine — shapes your next refresh
            </p>
            {refineCount > 0 && (
              <button
                type="button"
                onClick={clearRefine}
                className="
                  inline-flex items-center gap-1
                  font-mono text-mono uppercase text-ink-muted
                  transition-colors hover:text-ink
                  focus-visible:outline-2 focus-visible:outline-accent
                  focus-visible:outline-offset-2
                "
              >
                <X size={14} weight="bold" aria-hidden />
                <span>Clear</span>
              </button>
            )}
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

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-mono uppercase text-ink-muted">
              Genre
            </span>
            {TV_GENRES.map((g) => {
              const selected = selectedGenres.has(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
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
                  {g}
                </button>
              );
            })}
          </div>

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
                    {PLATFORM_NAME.get(key) ?? key}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

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
        <div className={pending ? "opacity-50" : undefined}>
          <p className="truncate font-mono text-mono uppercase text-ink-muted">
            Generated {generatedLabel ?? "…"}
            {" · "}
            {list.modelId}
            {list.mood ? ` · mood: ${list.mood}` : ""}
          </p>

          <div className="mt-6 space-y-10">
            {CATEGORY_ORDER.map((category) => {
              const items = itemsByCategory[category];
              const meta = CATEGORY_META[category];
              // New shows always render (with an empty note if the LLM
              // returned none); the queue sections only when populated.
              if (items.length === 0 && category !== "new_show") return null;

              const collapsible =
                category === "continue_watching" &&
                items.length > TEASER_COUNT;
              const expanded = expandedScopes[active] ?? false;
              const showAll = !collapsible || expanded;
              const visible = showAll ? items : items.slice(0, TEASER_COUNT);

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
                      No new picks this time — try refreshing.
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-4">
                        {visible.map((item, idx) => (
                          <li
                            key={item.id}
                            className="animate-ink-in"
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
                            setExpandedScopes((prev) => ({
                              ...prev,
                              [active]: !expanded,
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
                          {expanded ? (
                            <>
                              <CaretUp size={12} weight="bold" aria-hidden />
                              <span>Show less</span>
                            </>
                          ) : (
                            <>
                              <CaretDown size={12} weight="bold" aria-hidden />
                              <span>Show all {items.length}</span>
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
