"use server";

import type { RecScope, RecFocus, RecItemCategory, VoteValue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  getTvDetails,
  getTvProviders,
  searchTv,
  type TmdbShowMetadata,
  type TmdbProviderInfo,
} from "@/lib/tmdb";
import { generateStructured } from "@/lib/anthropic";
import { getBudgetStatus, logLlmCall } from "@/lib/llm-budget";
import { REC_MODEL_TO_API_ID } from "@/lib/rec-models";
import {
  REC_SYSTEM_PROMPT,
  buildUserPrompt,
  RECOMMENDATIONS_SCHEMA,
  type RecommendationsResponse,
  type WatchEntrySummary,
  type VoteCombination,
  type ContinuationCandidate,
  type ContinuationCategory,
} from "@/lib/rec-prompts";
import { getUserContext, intersectSubscriptions } from "@/lib/rec-context";
import { titlesAreCompatible } from "@/lib/rec-titles";
import { upsertShowFromResolved, type ResolvedShow } from "@/lib/show-sync";
import { revalidateRecSurfaces } from "@/lib/revalidate";

// New-show floor per scope. `mixed` / `new_seasons` / `queue` focus use
// `default`; `discover` focus bumps it so a "find me new shows" refresh
// actually fills a long discovery section. Co-watch carries more — it's
// the household's landing tab.
const NEW_SHOW_TARGET: Record<RecScope, { default: number; discover: number }> = {
  co_watch: { default: 8, discover: 20 },
  corey: { default: 5, discover: 12 },
  jaimie: { default: 5, discover: 12 },
};

// Hard cap on how many continuations a run stores — bounds prompt tokens.
// The real count is min(cap, however many the viewer actually has), so a
// viewer with 3 in-progress shows simply gets 3.
const CONTINUATION_CAP: Record<RecScope, number> = {
  co_watch: 12,
  corey: 8,
  jaimie: 8,
};

// Over-ask multiplier for new-show candidates: the LLM is asked for ~1.6×
// the target so TMDb-resolution and provider-overlap drops don't leave the
// discovery section under-filled.
const NEW_SHOW_OVERASK = 1.6;

function newShowTargetFor(scope: RecScope, focus: RecFocus): number {
  const t = NEW_SHOW_TARGET[scope];
  return focus === "discover" ? t.discover : t.default;
}

// Validates an LLM-flagged continuation against the user's actual watch
// state. Drops the bug where a show with an announced-but-unaired next
// season (e.g. Severance after S2 wraps, before S3 drops) gets re-pitched
// to a user who's already finished everything that's aired.
function isValidContinuation(entry: WatchEntrySummary): boolean {
  // Only Watching/Paused can have a continuation — Completed or Dropped
  // shouldn't be re-suggested.
  if (entry.status !== "watching" && entry.status !== "paused") return false;
  // Missing season data — be lenient, treat as a continuation.
  if (entry.airedSeasons === 0) return true;
  // Mid-season: more episodes left in the current aired season.
  if (!entry.currentSeasonCompleted) return true;
  // Finished current season: valid only if a later season has aired.
  const current = entry.currentSeason ?? 0;
  return entry.airedSeasons > current;
}

// Splits a valid continuation into its two sub-kinds: mid-season vs. a
// finished season with a newer one available.
function classifyContinuation(entry: WatchEntrySummary): ContinuationCategory {
  if (!entry.currentSeasonCompleted) return "continue_watching";
  return "new_season";
}

// Human-readable season marker for the prompt — gives the LLM enough
// context to write a sensible "pick it back up" explanation.
function seasonNote(entry: WatchEntrySummary): string {
  const parts: string[] = [];
  if (entry.currentSeason != null) {
    parts.push(
      `on season ${entry.currentSeason}${entry.currentSeasonCompleted ? " (finished)" : " (in progress)"}`,
    );
  }
  if (entry.airedSeasons > 0) parts.push(`aired through S${entry.airedSeasons}`);
  return parts.join(", ") || "season data unknown";
}

// Deterministic fallback explanation for a continuation the LLM dropped
// from its output — keeps the category complete even when the model
// misbehaves (the reconcile step appends these).
function fallbackExplanation(category: ContinuationCategory): {
  short: string;
  long: string;
} {
  if (category === "new_season") {
    return {
      short: "A new season has aired since you last watched.",
      long: "A new season has aired since you finished your last one. Pick this back up to stay current.",
    };
  }
  return {
    short: "You're mid-season — episodes left to watch.",
    long: "You still have unwatched episodes in the season you're on. Jump back in to keep your progress going.",
  };
}

export type GenerateRecommendationsError =
  | "unauthorized"
  | "not_found"
  | "anthropic_failed"
  | "no_valid_items"
  | "budget_exceeded";

export type GenerateRecommendationsResult =
  | { ok: true; runId: number; itemCount: number }
  | {
      ok: false;
      error: GenerateRecommendationsError;
      // User-facing detail when available (e.g. "Anthropic authentication
      // failed — check ANTHROPIC_API_KEY"). Set for anthropic_failed; the
      // other codes are self-describing.
      errorMessage?: string;
    };

// Tries to resolve an LLM-suggested tmdbId to a real TMDb show + current
// CA providers. Falls back to a title search when the hint is bogus.
// Returns null if neither route works (we drop the rec).
async function resolveTmdbHint(
  tmdbId: number,
  fallbackTitle: string,
): Promise<ResolvedShow | null> {
  // Sequential rather than parallel so a bogus tmdbId doesn't burn a
  // wasted /watch/providers call.
  let metadata: TmdbShowMetadata | null = null;
  try {
    const fromHint = await getTvDetails(tmdbId);
    if (titlesAreCompatible(fromHint.title, fallbackTitle)) {
      metadata = fromHint;
    }
    // If the title doesn't match, the LLM hallucinated this tmdbId onto
    // a different show — drop the hint and fall through to a title search.
  } catch {
    // hint didn't resolve at all
  }
  if (metadata == null) {
    const results = await searchTv(fallbackTitle).catch(() => []);
    if (results.length === 0) return null;
    // Pick the first result whose title actually matches — the popularity
    // re-sort might surface a similarly-named-but-different show at #1.
    const matched = results.find((r) =>
      titlesAreCompatible(r.title, fallbackTitle),
    );
    if (!matched) return null;
    try {
      metadata = await getTvDetails(matched.tmdbId);
    } catch {
      return null;
    }
  }
  let providers: TmdbProviderInfo[];
  try {
    providers = await getTvProviders(metadata.tmdbId);
  } catch {
    providers = [];
  }
  return { metadata, providers };
}

// Phase 34: the actual upsert lives in `lib/show-sync` — keep this
// thin wrapper so the calling code reads at the right level.
const upsertResolvedShow = (resolved: ResolvedShow) =>
  upsertShowFromResolved(resolved);

// Maps RecScope to the username that owns that list. Hard-coded — the app
// is two-user-specific by design (see PRD §2).
async function resolveOwnerUserId(
  scope: RecScope,
  triggerUser: { id: number; username: string },
): Promise<number | null> {
  if (scope === "co_watch") return triggerUser.id;
  if (scope === triggerUser.username) return triggerUser.id;
  const u = await prisma.user.findUnique({ where: { username: scope } });
  return u?.id ?? null;
}

// Co-watch only (Phase 26). Intersects the two users' recent votes by
// show title so the LLM gets an explicit "split rule" input.
function computeVoteCombinations(
  primary: { recentVotes: { title: string; vote: VoteValue }[] },
  other: { recentVotes: { title: string; vote: VoteValue }[] },
): VoteCombination[] {
  const otherByTitle = new Map(
    other.recentVotes.map((v) => [v.title, v.vote] as const),
  );
  const out: VoteCombination[] = [];
  for (const pv of primary.recentVotes) {
    const ov = otherByTitle.get(pv.title);
    if (ov) {
      out.push({ title: pv.title, primaryVote: pv.vote, otherVote: ov });
    }
  }
  return out;
}

async function findOtherUserId(notUserId: number): Promise<number | null> {
  const u = await prisma.user.findFirst({
    where: { id: { not: notUserId } },
    select: { id: true },
  });
  return u?.id ?? null;
}

// Enumerates the complete continuation set from watch state. Membership is
// computed here — NOT discovered by the LLM — which is what makes the
// new_season / continue_watching sections reliably complete. For co_watch
// a show only qualifies when BOTH viewers are mid-show; the category is
// taken from the primary viewer's entry (co-watched shows mirror season
// state between the two users anyway).
function enumerateContinuations(
  scope: RecScope,
  primaryEntries: WatchEntrySummary[],
  otherEntries: WatchEntrySummary[] | null,
  cap: number,
): ContinuationCandidate[] {
  const otherByTmdbId = otherEntries
    ? new Map(otherEntries.map((e) => [e.tmdbId, e]))
    : null;
  const out: ContinuationCandidate[] = [];
  for (const entry of primaryEntries) {
    if (!isValidContinuation(entry)) continue;
    if (scope === "co_watch") {
      const otherEntry = otherByTmdbId?.get(entry.tmdbId);
      if (!otherEntry || !isValidContinuation(otherEntry)) continue;
    }
    out.push({
      tmdbId: entry.tmdbId,
      title: entry.title,
      year: entry.year ?? null,
      category: classifyContinuation(entry),
      seasonNote: seasonNote(entry),
    });
    if (out.length >= cap) break;
  }
  return out;
}

// Refine-panel inputs that shape a refresh. All optional — an empty
// object is an unrefined refresh.
export type RefreshInputs = {
  mood?: string;
  // Soft genre nudge for the new-show picks.
  genres?: string[];
  // Hard platform restriction for the new-show picks (and the provider
  // gate). Must be a subset of the viewer's active subscriptions.
  platforms?: string[];
};

export async function generateRecommendations(
  scope: RecScope,
  inputs: RefreshInputs = {},
): Promise<GenerateRecommendationsResult> {
  const { mood, genres, platforms } = inputs;
  // /recs is a discovery surface (the queue lives on Home), so every
  // run is generated in "discover" mode — new-show picks lead and get
  // the larger candidate target.
  const focus: RecFocus = "discover";
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const triggerUser = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!triggerUser) return { ok: false, error: "not_found" };

  const modelKey = triggerUser.recModel;
  const modelId = REC_MODEL_TO_API_ID[modelKey];

  // Build context per scope.
  let primaryContext, otherContext, sharedSubs;
  let voteCombinations: VoteCombination[] | undefined;
  if (scope === "co_watch") {
    primaryContext = await getUserContext(triggerUser.id);
    const otherId = await findOtherUserId(triggerUser.id);
    if (otherId == null) return { ok: false, error: "not_found" };
    otherContext = await getUserContext(otherId);
    if (!primaryContext || !otherContext) {
      return { ok: false, error: "not_found" };
    }
    sharedSubs = intersectSubscriptions(
      primaryContext.subscriptions,
      otherContext.subscriptions,
    );
    voteCombinations = computeVoteCombinations(primaryContext, otherContext);
  } else {
    const ownerId = await resolveOwnerUserId(scope, {
      id: triggerUser.id,
      username: triggerUser.username,
    });
    if (ownerId == null) return { ok: false, error: "not_found" };
    primaryContext = await getUserContext(ownerId);
    if (!primaryContext) return { ok: false, error: "not_found" };
  }

  // Enumerate the complete continuation set up front (the LLM ranks it,
  // it does not discover it).
  const continuations = enumerateContinuations(
    scope,
    primaryContext.watchEntries,
    otherContext?.watchEntries ?? null,
    CONTINUATION_CAP[scope],
  );
  const continuationByTmdbId = new Map(
    continuations.map((c) => [c.tmdbId, c]),
  );

  const newShowTarget = newShowTargetFor(scope, focus);
  const newShowCandidateCount = Math.ceil(newShowTarget * NEW_SHOW_OVERASK);

  const userPrompt = buildUserPrompt({
    scope,
    focus,
    genres,
    platforms,
    continuations,
    newShowCount: newShowCandidateCount,
    primary: primaryContext,
    other: otherContext,
    sharedSubscriptions: sharedSubs,
    voteCombinations,
    mood,
  });

  // Budget gate per PRD §10. Hard pause when this month's logged spend
  // hits the cap.
  const budget = await getBudgetStatus();
  if (budget.state === "exceeded") {
    return {
      ok: false,
      error: "budget_exceeded",
      errorMessage: `Monthly Anthropic budget hit ($${budget.spentUsd.toFixed(2)} / $${budget.capUsd.toFixed(2)}). Refresh is paused until next month.`,
    };
  }

  let llmOut: RecommendationsResponse;
  try {
    const result = await generateStructured<RecommendationsResponse>({
      model: modelId,
      systemPrompt: REC_SYSTEM_PROMPT,
      userPrompt,
      outputSchema: RECOMMENDATIONS_SCHEMA as unknown as Record<string, unknown>,
      // ~250 output tokens per recommendation (short + long explanation,
      // year, tmdbId, title, category). 1.3× safety on top. Continuations
      // and new-show candidates both count.
      maxTokens: Math.max(
        4096,
        Math.ceil(
          (newShowCandidateCount + continuations.length) * 250 * 1.3,
        ),
      ),
    });
    llmOut = result.data;
    // Per-call spend log feeds the PRD §10 monthly budget. Fire-and-forget.
    void logLlmCall({
      modelId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    }).catch(() => {});
  } catch (err) {
    const message = (err as Error).message;
    await prisma.recommendationRun.create({
      data: {
        triggeredBy: triggerUser.id,
        scope,
        modelId,
        mood: mood ?? null,
        focus,
        status: "failed",
        errorMessage: message,
      },
    });
    return { ok: false, error: "anthropic_failed", errorMessage: message };
  }

  // Persist the run header now so items can FK to it.
  const run = await prisma.recommendationRun.create({
    data: {
      triggeredBy: triggerUser.id,
      scope,
      modelId,
      mood: mood ?? null,
      focus,
      status: "ok",
    },
  });

  // The relevant subscription set for availability gating depends on scope.
  const gateSubs =
    scope === "co_watch"
      ? sharedSubs ?? []
      : primaryContext.subscriptions;
  // A platform restriction from the Refine panel narrows the gate to the
  // chosen platforms — "find new shows specifically on Netflix".
  const effectiveGateSubs =
    platforms && platforms.length > 0
      ? gateSubs.filter((k) => platforms.includes(k))
      : gateSubs;

  // Watch entries keyed by tmdbId for the already-completed guard.
  const primaryEntriesByTmdbId = new Map<number, WatchEntrySummary>(
    primaryContext.watchEntries.map((e) => [e.tmdbId, e]),
  );
  const otherEntriesByTmdbId = otherContext
    ? new Map<number, WatchEntrySummary>(
        otherContext.watchEntries.map((e) => [e.tmdbId, e]),
      )
    : null;

  type PersistedItem = {
    tmdbId: number;
    showId: number | null;
    title: string;
    year: string | null;
    posterUrl: string | null;
    shortExplanation: string;
    longExplanation: string;
    category: RecItemCategory;
  };

  const dropped: Array<{ title: string; tmdbId: number; reason: string }> = [];

  // ---- New shows: the LLM-discovered picks (membership is the LLM's
  // call). Resolve against TMDb, gate on provider overlap, dedupe, cap.
  const newShowRecs = llmOut.recommendations.filter(
    (r) => r.category === "new_show" && !continuationByTmdbId.has(r.tmdbId),
  );
  // An LLM-labelled continuation that isn't in the enumerated set is a
  // hallucination — it continues nothing. Record it as dropped.
  for (const r of llmOut.recommendations) {
    if (r.category !== "new_show" && !continuationByTmdbId.has(r.tmdbId)) {
      dropped.push({
        title: r.title,
        tmdbId: r.tmdbId,
        reason: "continuation_not_enumerated",
      });
    }
  }
  const newShowItems: PersistedItem[] = [];
  const persistedTmdbIds = new Set<number>();
  for (const rec of newShowRecs) {
    if (newShowItems.length >= newShowTarget) break;
    const resolved = await resolveTmdbHint(rec.tmdbId, rec.title);
    if (!resolved) {
      dropped.push({ title: rec.title, tmdbId: rec.tmdbId, reason: "tmdb_unresolved" });
      continue;
    }
    const resolvedTmdbId = resolved.metadata.tmdbId;
    // A resolved id might land on an enumerated continuation — that show
    // belongs in the continuation pass, not here.
    if (continuationByTmdbId.has(resolvedTmdbId)) {
      dropped.push({
        title: resolved.metadata.title,
        tmdbId: resolvedTmdbId,
        reason: "resolved_to_continuation",
      });
      continue;
    }
    if (persistedTmdbIds.has(resolvedTmdbId)) {
      dropped.push({
        title: resolved.metadata.title,
        tmdbId: resolvedTmdbId,
        reason: "duplicate_of_higher_ranked",
      });
      continue;
    }
    // A "new show" is by definition NOT on anyone's list. If it already
    // has a watch entry it's either a continuation (handled below) or a
    // caught-up show with nothing to watch — drop it from discovery.
    const primaryEntry = primaryEntriesByTmdbId.get(resolvedTmdbId);
    const otherEntry = otherEntriesByTmdbId?.get(resolvedTmdbId);
    if (primaryEntry || otherEntry) {
      dropped.push({
        title: resolved.metadata.title,
        tmdbId: resolvedTmdbId,
        reason: "already_in_watch_history",
      });
      continue;
    }
    const providerKeys = resolved.providers.map((p) => p.platformKey);
    if (!providerKeys.some((k) => effectiveGateSubs.includes(k))) {
      dropped.push({
        title: resolved.metadata.title,
        tmdbId: resolvedTmdbId,
        reason: `no_provider_overlap (CA providers: ${providerKeys.join("|") || "none"})`,
      });
      continue;
    }
    const showId = await upsertResolvedShow(resolved);
    newShowItems.push({
      tmdbId: resolvedTmdbId,
      showId,
      title: resolved.metadata.title,
      year: rec.year || null,
      posterUrl: resolved.metadata.posterUrl,
      shortExplanation: rec.shortExplanation,
      longExplanation: rec.longExplanation,
      category: "new_show",
    });
    persistedTmdbIds.add(resolvedTmdbId);
  }

  // ---- Continuations: the app already enumerated the set; the LLM only
  // ranked it. Take the LLM's order, then reconcile any it dropped so the
  // category is always complete. Shows are already in our DB (they have a
  // WatchEntry) — no TMDb call needed.
  const continuationShows = await prisma.show.findMany({
    where: { tmdbId: { in: continuations.map((c) => c.tmdbId) } },
    select: { id: true, tmdbId: true, title: true, posterUrl: true },
  });
  const showByTmdbId = new Map(continuationShows.map((s) => [s.tmdbId, s]));

  const continuationItems: PersistedItem[] = [];
  const seenContinuationTmdbIds = new Set<number>();
  const addContinuation = (
    candidate: ContinuationCandidate,
    explanation: { short: string; long: string },
  ) => {
    if (seenContinuationTmdbIds.has(candidate.tmdbId)) return;
    const show = showByTmdbId.get(candidate.tmdbId);
    if (!show) {
      dropped.push({
        title: candidate.title,
        tmdbId: candidate.tmdbId,
        reason: "continuation_show_missing",
      });
      return;
    }
    seenContinuationTmdbIds.add(candidate.tmdbId);
    continuationItems.push({
      tmdbId: candidate.tmdbId,
      showId: show.id,
      title: show.title,
      year: candidate.year,
      posterUrl: show.posterUrl,
      shortExplanation: explanation.short,
      longExplanation: explanation.long,
      category: candidate.category,
    });
  };
  // LLM-ranked order first.
  for (const rec of llmOut.recommendations) {
    const candidate = continuationByTmdbId.get(rec.tmdbId);
    if (!candidate) continue;
    addContinuation(candidate, {
      short: rec.shortExplanation,
      long: rec.longExplanation,
    });
  }
  // Reconcile: any enumerated continuation the LLM omitted gets appended
  // with a deterministic explanation. This is the hard guarantee that the
  // new_season / continue_watching sections are never sparse.
  for (const candidate of continuations) {
    if (seenContinuationTmdbIds.has(candidate.tmdbId)) continue;
    addContinuation(candidate, fallbackExplanation(candidate.category));
  }

  if (dropped.length > 0) {
    console.warn(
      `[recs] scope=${scope} focus=${focus} dropped ${dropped.length} (kept ${newShowItems.length} new + ${continuationItems.length} continuations):\n` +
        dropped
          .map((d) => `  - "${d.title}" (tmdbId=${d.tmdbId}): ${d.reason}`)
          .join("\n"),
    );
  }

  const persisted: PersistedItem[] = [...newShowItems, ...continuationItems];

  if (persisted.length === 0) {
    await prisma.recommendationRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: "no_valid_items" },
    });
    return { ok: false, error: "no_valid_items" };
  }

  await prisma.recommendationItem.createMany({
    data: persisted.map((p, i) => ({
      runId: run.id,
      position: i + 1,
      tmdbId: p.tmdbId,
      showId: p.showId,
      title: p.title,
      year: p.year,
      posterUrl: p.posterUrl,
      shortExplanation: p.shortExplanation,
      longExplanation: p.longExplanation,
      category: p.category,
    })),
  });

  revalidateRecSurfaces();
  return { ok: true, runId: run.id, itemCount: persisted.length };
}

// Convenience: regenerate all three lists in parallel. Used by the rec-model
// auto-refresh and the manual Refresh button (Phase 11).
export async function regenerateAllLists(
  inputs: RefreshInputs = {},
): Promise<Array<GenerateRecommendationsResult>> {
  return Promise.all([
    generateRecommendations("co_watch", inputs),
    generateRecommendations("corey", inputs),
    generateRecommendations("jaimie", inputs),
  ]);
}

export type RecListItemView = {
  id: number;
  // Rank within the item's category section (1-based).
  position: number;
  tmdbId: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  shortExplanation: string;
  longExplanation: string;
  // Which of the three recommendation categories this item belongs to.
  category: RecItemCategory;
  providerKeys: string[];
  // Parsed from Show.genres (comma-separated). Used for the genre
  // filter on /recs.
  genres: string[];
  unavailable: boolean;
  // The vote shown on this card. For user-scoped lists (corey / jaimie)
  // this is the OWNER's vote — the partner sees the owner's selections
  // when viewing the owner's tab. For co_watch this is the viewer's
  // own vote.
  currentVote: VoteValue | null;
  // Co-watch only (M4 Phase 25). The OTHER household member's vote on
  // this show. Null on user-scoped lists and when the partner hasn't
  // voted yet. Display-only; the viewer can't mutate it.
  partnerVote: VoteValue | null;
  // Whether the current session is allowed to mutate the vote. False
  // when the viewer is looking at someone else's user-scoped list.
  canVote: boolean;
  // True when the current user already has the underlying show on their
  // list (any status). Used to hide the Add-to-Want-to-Watch button.
  inWatchHistory: boolean;
};

export type RecListView = {
  scope: RecScope;
  runId: number;
  modelId: string;
  mood: string | null;
  // Which intent this run was biased toward. Pre-focus runs read as `mixed`.
  focus: RecFocus;
  createdAt: Date;
  items: RecListItemView[];
};

export type DisagreedShow = {
  showId: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  // ISO date the disagree was last touched, so the inspector can show
  // newest-first ordering.
  disagreedAt: Date;
};

export type RecsPageData = {
  runs: Record<RecScope, RecListView | null>;
  // Active subscription platform keys for the current user; the /recs
  // filter UI uses this to render the platform chip group.
  userSubKeys: string[];
  // Display name of the household partner. Used as the label on the
  // partner-vote indicator on Co-watch RecCards. Null if there's no
  // other user in the system yet.
  partnerDisplayName: string | null;
  // Shows the SESSION user has Disagreed on. Surfaced in the
  // "Buried disagrees" inspector at the bottom of their own tab so
  // they can re-vote and unbury picks they've previously hidden.
  disagreedShows: DisagreedShow[];
  // True when the user changed their streaming subscriptions after the
  // most recent recommendation run — /recs shows a "refresh to update"
  // hint (subscription changes no longer auto-regenerate).
  subscriptionsStale: boolean;
};

// Parses Show.genres (comma-separated string per TMDb) into an array,
// trimmed and deduped. Returns [] for null/empty input.
function parseGenres(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

// Loads the most-recent ok-status run for each scope and shapes the items
// for /recs rendering. `unavailable` flags are computed against the
// trigger user's own subs.
export async function getLatestRunsForCurrentUser(): Promise<RecsPageData> {
  const session = await getSession();
  const empty: Record<RecScope, RecListView | null> = {
    co_watch: null,
    corey: null,
    jaimie: null,
  };
  if (!session.userId)
    return {
      runs: empty,
      userSubKeys: [],
      partnerDisplayName: null,
      disagreedShows: [],
      subscriptionsStale: false,
    };

  const [subs, watchEntries, coreyUser, jaimieUser, disagreeRows, viewerUser] =
    await Promise.all([
    prisma.userSubscription.findMany({
      where: { userId: session.userId },
      select: { platformKey: true },
    }),
    prisma.watchEntry.findMany({
      where: { userId: session.userId },
      select: { showId: true },
    }),
    prisma.user.findUnique({
      where: { username: "corey" },
      select: { id: true, displayName: true },
    }),
    prisma.user.findUnique({
      where: { username: "jaimie" },
      select: { id: true, displayName: true },
    }),
    // Disagrees the SESSION user owns. Fed into the inspector at the
    // bottom of their own tab (Phase 28).
    prisma.showVote.findMany({
      where: { userId: session.userId, vote: "disagree" },
      orderBy: { createdAt: "desc" },
      include: {
        show: { select: { id: true, tmdbId: true, title: true, posterUrl: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { subscriptionsUpdatedAt: true },
    }),
  ]);
  const subKeys = subs.map((s) => s.platformKey);
  // O(1) lookup so the per-item RecCard view can hide the WTW button.
  const watchedShowIds = new Set(watchEntries.map((e) => e.showId));

  // For user-scoped lists, the vote shown is the owner's; for co_watch
  // it's the viewer's own. Owner lookup is done once and reused across
  // all three scope queries.
  const scopeToOwnerUserId: Record<RecScope, number | null> = {
    co_watch: session.userId,
    corey: coreyUser?.id ?? null,
    jaimie: jaimieUser?.id ?? null,
  };
  // Partner = the other household member, for co_watch partner-vote viz.
  const partnerUser =
    session.userId === coreyUser?.id ? jaimieUser : coreyUser;
  const partnerUserId = partnerUser?.id ?? null;
  const partnerDisplayName = partnerUser?.displayName ?? null;

  const scopes: RecScope[] = ["co_watch", "corey", "jaimie"];
  const result = { ...empty };
  await Promise.all(
    scopes.map(async (scope) => {
      const ownerUserId = scopeToOwnerUserId[scope];
      if (ownerUserId == null) return;
      const canVote =
        scope === "co_watch" ? true : ownerUserId === session.userId;
      // Co-watch pulls BOTH households' votes (for partner viz); the
      // user-scoped tabs only need the owner's.
      const voteUserIds =
        scope === "co_watch" && partnerUserId != null
          ? [ownerUserId, partnerUserId]
          : [ownerUserId];
      const run = await prisma.recommendationRun.findFirst({
        where: { scope, status: "ok" },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              show: {
                select: {
                  genres: true,
                  providers: { select: { platformKey: true } },
                  votes: {
                    where: { userId: { in: voteUserIds } },
                    select: { vote: true, userId: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!run) return;
      const ownerVoteOf = (
        item: (typeof run.items)[number],
      ): VoteValue | null =>
        item.show?.votes.find((v) => v.userId === ownerUserId)?.vote ?? null;
      const partnerVoteOf = (
        item: (typeof run.items)[number],
      ): VoteValue | null =>
        scope === "co_watch" && partnerUserId != null
          ? item.show?.votes.find((v) => v.userId === partnerUserId)?.vote ?? null
          : null;
      // Disagree hard-excludes from user-scoped lists per PRD. Co-watch
      // gets the M4 split-rule demote treatment; for now leave it
      // unchanged so a single user's disagree doesn't drop a co-watch
      // pick the partner might still want.
      const afterDisagreeFilter =
        scope === "co_watch"
          ? run.items
          : run.items.filter((item) => ownerVoteOf(item) !== "disagree");
      // Stale-list subscription filter (PRD §6.4.7): a previously-
      // generated new pick may have lost provider overlap because the
      // user toggled off a subscription after this run was persisted.
      // Hide those new picks immediately — continuations stay visible
      // (badged "Unavailable on your subscriptions" by the card).
      const visibleItems = afterDisagreeFilter.filter((item) => {
        if (item.category !== "new_show") return true;
        const providerKeys =
          item.show?.providers.map((p) => p.platformKey) ?? [];
        if (providerKeys.length === 0) return true; // unknown — don't hide
        return providerKeys.some((k) => subKeys.includes(k));
      });
      // Position is rendered per category section, so renumber within
      // each category — items already arrive in stored-position order.
      const positionByCategory: Record<RecItemCategory, number> = {
        new_show: 0,
        new_season: 0,
        continue_watching: 0,
      };
      result[scope] = {
        scope,
        runId: run.id,
        modelId: run.modelId,
        mood: run.mood,
        focus: run.focus ?? "mixed",
        createdAt: run.createdAt,
        items: visibleItems.map((item) => {
          const providerKeys =
            item.show?.providers.map((p) => p.platformKey) ?? [];
          const unavailable =
            providerKeys.length > 0 &&
            !providerKeys.some((k) => subKeys.includes(k));
          return {
            id: item.id,
            position: ++positionByCategory[item.category],
            tmdbId: item.tmdbId,
            title: item.title,
            year: item.year,
            posterUrl: item.posterUrl,
            shortExplanation: item.shortExplanation,
            longExplanation: item.longExplanation,
            category: item.category,
            providerKeys,
            genres: parseGenres(item.show?.genres ?? null),
            unavailable,
            currentVote: ownerVoteOf(item),
            partnerVote: partnerVoteOf(item),
            canVote,
            inWatchHistory:
              item.showId != null && watchedShowIds.has(item.showId),
          };
        }),
      };
    }),
  );
  const disagreedShows: DisagreedShow[] = disagreeRows.map((row) => ({
    showId: row.show.id,
    tmdbId: row.show.tmdbId,
    title: row.show.title,
    posterUrl: row.show.posterUrl,
    disagreedAt: row.createdAt,
  }));

  // Stale when subscriptions were last changed after the most recent
  // run across all scopes.
  const latestRunAt = scopes
    .map((s) => result[s]?.createdAt)
    .filter((d): d is Date => d != null)
    .reduce<Date | null>((max, d) => (max == null || d > max ? d : max), null);
  const subsChangedAt = viewerUser?.subscriptionsUpdatedAt ?? null;
  const subscriptionsStale =
    subsChangedAt != null &&
    latestRunAt != null &&
    subsChangedAt > latestRunAt;

  return {
    runs: result,
    userSubKeys: subKeys,
    partnerDisplayName,
    disagreedShows,
    subscriptionsStale,
  };
}
