"use server";

import { revalidatePath } from "next/cache";
import type { RecScope, VoteValue } from "@prisma/client";
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
import { REC_MODEL_TO_API_ID } from "@/lib/rec-models";
import {
  REC_SYSTEM_PROMPT,
  buildUserPrompt,
  RECOMMENDATIONS_SCHEMA,
  type RecommendationsResponse,
  type RawRecommendation,
  type WatchEntrySummary,
} from "@/lib/rec-prompts";
import { getUserContext, intersectSubscriptions } from "@/lib/rec-context";
import { titlesAreCompatible } from "@/lib/rec-titles";

const TARGET_LIST_LENGTH = 10;

// Validates an LLM-flagged continuation against the user's actual watch
// state. Drops the bug where a show with an announced-but-unaired next
// season (e.g. Severance after S2 wraps, before S3 drops) gets re-pitched
// to a user who's already finished everything that's aired.
function isValidContinuation(entry: WatchEntrySummary): boolean {
  // Only Watching/Paused can have a continuation per PRD §… ; Completed
  // or Dropped shouldn't be re-suggested.
  if (entry.status !== "watching" && entry.status !== "paused") return false;
  // Missing season data — be lenient, defer to the LLM's judgement.
  if (entry.airedSeasons === 0) return true;
  // Mid-season: more episodes left in the current aired season.
  if (!entry.currentSeasonCompleted) return true;
  // Finished current season: valid only if a later season has aired.
  const current = entry.currentSeason ?? 0;
  return entry.airedSeasons > current;
}

export type GenerateRecommendationsError =
  | "unauthorized"
  | "not_found"
  | "anthropic_failed"
  | "no_valid_items";

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
type ResolvedShow = {
  metadata: TmdbShowMetadata;
  providers: TmdbProviderInfo[];
};

async function resolveTmdbHint(
  tmdbId: number,
  fallbackTitle: string,
): Promise<ResolvedShow | null> {
  // Sequential rather than parallel so a bogus tmdbId doesn't burn a
  // wasted /watch/providers call. The savings vs an LLM-call-dominated
  // refresh are negligible.
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

async function upsertResolvedShow(resolved: ResolvedShow): Promise<number> {
  const { metadata, providers } = resolved;
  const show = await prisma.show.upsert({
    where: { tmdbId: metadata.tmdbId },
    create: {
      tmdbId: metadata.tmdbId,
      title: metadata.title,
      overview: metadata.overview,
      posterUrl: metadata.posterUrl,
      genres: metadata.genres,
      totalSeasons: metadata.totalSeasons,
      totalEpisodes: metadata.totalEpisodes,
      seasonsJson: metadata.seasonsJson,
      tmdbRating: metadata.tmdbRating,
      productionStatus: metadata.productionStatus,
    },
    update: {
      title: metadata.title,
      overview: metadata.overview,
      posterUrl: metadata.posterUrl,
      genres: metadata.genres,
      totalSeasons: metadata.totalSeasons,
      totalEpisodes: metadata.totalEpisodes,
      seasonsJson: metadata.seasonsJson,
      tmdbRating: metadata.tmdbRating,
      productionStatus: metadata.productionStatus,
      lastSyncedAt: new Date(),
    },
  });
  await prisma.showProvider.deleteMany({ where: { showId: show.id } });
  if (providers.length > 0) {
    await prisma.showProvider.createMany({
      data: providers.map((p) => ({
        showId: show.id,
        platformKey: p.platformKey,
        monetizationType: p.monetizationType,
      })),
    });
  }
  return show.id;
}

// Maps RecScope to the username that owns that list. Hard-coded — the app
// is two-user-specific by design (see PRD §2). For co_watch we resolve to
// the trigger user; for user lists we resolve to that named user. Skips
// the extra DB lookup when the trigger user is also the owner.
async function resolveOwnerUserId(
  scope: RecScope,
  triggerUser: { id: number; username: string },
): Promise<number | null> {
  if (scope === "co_watch") return triggerUser.id;
  if (scope === triggerUser.username) return triggerUser.id;
  const u = await prisma.user.findUnique({ where: { username: scope } });
  return u?.id ?? null;
}

async function findOtherUserId(notUserId: number): Promise<number | null> {
  const u = await prisma.user.findFirst({
    where: { id: { not: notUserId } },
    select: { id: true },
  });
  return u?.id ?? null;
}

export async function generateRecommendations(
  scope: RecScope,
  mood?: string,
): Promise<GenerateRecommendationsResult> {
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
  } else {
    const ownerId = await resolveOwnerUserId(scope, {
      id: triggerUser.id,
      username: triggerUser.username,
    });
    if (ownerId == null) return { ok: false, error: "not_found" };
    primaryContext = await getUserContext(ownerId);
    if (!primaryContext) return { ok: false, error: "not_found" };
  }

  const userPrompt = buildUserPrompt({
    scope,
    primary: primaryContext,
    other: otherContext,
    sharedSubscriptions: sharedSubs,
    mood,
  });

  let llmOut: RecommendationsResponse;
  try {
    llmOut = await generateStructured<RecommendationsResponse>({
      model: modelId,
      systemPrompt: REC_SYSTEM_PROMPT,
      userPrompt,
      outputSchema: RECOMMENDATIONS_SCHEMA as unknown as Record<string, unknown>,
    });
  } catch (err) {
    const message = (err as Error).message;
    await prisma.recommendationRun.create({
      data: {
        triggeredBy: triggerUser.id,
        scope,
        modelId,
        mood: mood ?? null,
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
      status: "ok",
    },
  });

  // The relevant subscription set for availability gating depends on scope.
  const gateSubs =
    scope === "co_watch"
      ? sharedSubs ?? []
      : primaryContext.subscriptions;

  // Watch entries keyed by tmdbId for continuation validation. For
  // user-scoped lists, only that user's history counts; for co_watch we
  // accept either user having unwatched aired content.
  const primaryEntriesByTmdbId = new Map<number, WatchEntrySummary>(
    primaryContext.watchEntries.map((e) => [e.tmdbId, e]),
  );
  const otherEntriesByTmdbId = otherContext
    ? new Map<number, WatchEntrySummary>(
        otherContext.watchEntries.map((e) => [e.tmdbId, e]),
      )
    : null;

  // Validate, upsert, persist. Drop unresolvable hints and (for new picks)
  // shows that don't overlap with the relevant subs. Continuations stay
  // visible regardless of availability (PRD §162) — the UI badges them.
  const persisted: Array<{
    rec: RawRecommendation;
    showId: number;
    metadata: TmdbShowMetadata;
    providers: TmdbProviderInfo[];
  }> = [];

  const dropped: Array<{
    title: string;
    tmdbId: number;
    reason: string;
  }> = [];

  const persistedTmdbIds = new Set<number>();

  for (const rec of llmOut.recommendations) {
    if (persisted.length >= TARGET_LIST_LENGTH) break;
    const resolved = await resolveTmdbHint(rec.tmdbId, rec.title);
    if (!resolved) {
      dropped.push({
        title: rec.title,
        tmdbId: rec.tmdbId,
        reason: "tmdb_unresolved",
      });
      continue;
    }

    // The LLM occasionally emits the same show twice in its 16 candidates
    // (often with near-identical explanations). Keep the higher-ranked
    // occurrence and drop the rest.
    if (persistedTmdbIds.has(resolved.metadata.tmdbId)) {
      dropped.push({
        title: resolved.metadata.title,
        tmdbId: resolved.metadata.tmdbId,
        reason: "duplicate_of_higher_ranked",
      });
      continue;
    }

    if (rec.isContinuation) {
      const resolvedTmdbId = resolved.metadata.tmdbId;
      const primaryEntry = primaryEntriesByTmdbId.get(resolvedTmdbId);
      const otherEntry = otherEntriesByTmdbId?.get(resolvedTmdbId);
      // The LLM occasionally invents continuations for shows nobody has
      // watched. Drop those — they'd otherwise bypass the provider gate
      // and show up as un-badged "continuations" that don't continue
      // anything.
      if (!primaryEntry && !otherEntry) {
        dropped.push({
          title: resolved.metadata.title,
          tmdbId: resolvedTmdbId,
          reason: "continuation_not_in_history",
        });
        continue;
      }
      const primaryValid = primaryEntry
        ? isValidContinuation(primaryEntry)
        : false;
      const otherValid = otherEntry ? isValidContinuation(otherEntry) : false;
      if (!primaryValid && !otherValid) {
        dropped.push({
          title: resolved.metadata.title,
          tmdbId: resolvedTmdbId,
          reason: "continuation_no_new_aired_content",
        });
        continue;
      }
    } else {
      const providerKeys = resolved.providers.map((p) => p.platformKey);
      const hasOverlap = providerKeys.some((k) => gateSubs.includes(k));
      if (!hasOverlap) {
        dropped.push({
          title: resolved.metadata.title,
          tmdbId: resolved.metadata.tmdbId,
          reason: `no_provider_overlap (CA providers: ${providerKeys.join("|") || "none"})`,
        });
        continue;
      }
    }
    const showId = await upsertResolvedShow(resolved);
    persisted.push({
      rec,
      showId,
      metadata: resolved.metadata,
      providers: resolved.providers,
    });
    persistedTmdbIds.add(resolved.metadata.tmdbId);
  }

  if (dropped.length > 0) {
    console.warn(
      `[recs] scope=${scope} dropped ${dropped.length}/${llmOut.recommendations.length} (kept ${persisted.length}):\n` +
        dropped
          .map((d) => `  - "${d.title}" (tmdbId=${d.tmdbId}): ${d.reason}`)
          .join("\n"),
    );
  }

  if (persisted.length === 0) {
    // Mark the run as failed-but-recorded so the UI can surface the issue.
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
      tmdbId: p.metadata.tmdbId,
      showId: p.showId,
      title: p.metadata.title,
      year: p.rec.year || null,
      posterUrl: p.metadata.posterUrl,
      shortExplanation: p.rec.shortExplanation,
      longExplanation: p.rec.longExplanation,
      isContinuation: p.rec.isContinuation,
    })),
  });

  revalidatePath("/recs");
  return { ok: true, runId: run.id, itemCount: persisted.length };
}

// Convenience: regenerate all three lists in parallel. Used by the rec-model
// auto-refresh and the manual Refresh button (Phase 11).
export async function regenerateAllLists(
  mood?: string,
): Promise<Array<GenerateRecommendationsResult>> {
  return Promise.all([
    generateRecommendations("co_watch", mood),
    generateRecommendations("corey", mood),
    generateRecommendations("jaimie", mood),
  ]);
}

export type RecListItemView = {
  id: number;
  position: number;
  tmdbId: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  shortExplanation: string;
  longExplanation: string;
  isContinuation: boolean;
  providerKeys: string[];
  unavailable: boolean;
  // The vote shown on this card. For user-scoped lists (corey / jaimie)
  // this is the OWNER's vote — the partner sees the owner's selections
  // when viewing the owner's tab. For co_watch this is the viewer's
  // own vote (partner viz ships in M4).
  currentVote: VoteValue | null;
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
  createdAt: Date;
  items: RecListItemView[];
};

// Loads the most-recent ok-status run for each scope and shapes the items
// for /recs rendering. `unavailable` flags are computed against the
// trigger user's own subs (the most useful gate for personal lists; the
// co-watch list uses the same single-user view since both households
// share most platforms).
export async function getLatestRunsForCurrentUser(): Promise<
  Record<RecScope, RecListView | null>
> {
  const session = await getSession();
  const empty: Record<RecScope, RecListView | null> = {
    co_watch: null,
    corey: null,
    jaimie: null,
  };
  if (!session.userId) return empty;

  const [subs, watchEntries, coreyUser, jaimieUser] = await Promise.all([
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
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { username: "jaimie" },
      select: { id: true },
    }),
  ]);
  const subKeys = subs.map((s) => s.platformKey);
  // O(1) lookup so the per-item RecCard view can hide the WTW button.
  const watchedShowIds = new Set(watchEntries.map((e) => e.showId));

  // For user-scoped lists, the vote shown is the owner's; for co_watch
  // it's the viewer's own (partner viz lands in M4). Owner lookup is
  // done once and reused across all three scope queries.
  const scopeToOwnerUserId: Record<RecScope, number | null> = {
    co_watch: session.userId,
    corey: coreyUser?.id ?? null,
    jaimie: jaimieUser?.id ?? null,
  };

  const scopes: RecScope[] = ["co_watch", "corey", "jaimie"];
  const result = { ...empty };
  await Promise.all(
    scopes.map(async (scope) => {
      const ownerUserId = scopeToOwnerUserId[scope];
      if (ownerUserId == null) return;
      const canVote =
        scope === "co_watch" ? true : ownerUserId === session.userId;
      const run = await prisma.recommendationRun.findFirst({
        where: { scope, status: "ok" },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              show: {
                include: {
                  providers: { select: { platformKey: true } },
                  // Owner's per-show vote, joined via Show so a vote
                  // cast in a prior run still applies here. The unique
                  // (showId, userId) constraint guarantees 0 or 1 row.
                  votes: {
                    where: { userId: ownerUserId },
                    select: { vote: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });
      if (!run) return;
      // Disagree hard-excludes from user-scoped lists per PRD. Co-watch
      // gets the M4 split-rule demote treatment later; for now leave it
      // unchanged so a single user's disagree doesn't drop a co-watch
      // pick the partner might still want. We renumber positions after
      // filtering so the visible list doesn't show gaps.
      const afterDisagreeFilter =
        scope === "co_watch"
          ? run.items
          : run.items.filter(
              (item) => (item.show?.votes[0]?.vote ?? null) !== "disagree",
            );
      // Stale-list subscription filter (PRD §6.4.7): a previously-
      // generated new pick may have lost provider overlap because the
      // user toggled off a subscription after this run was persisted.
      // Hide those new picks immediately — continuations stay visible
      // (badged "Unavailable on your subscriptions" by the card).
      const visibleItems = afterDisagreeFilter.filter((item) => {
        if (item.isContinuation) return true;
        const providerKeys =
          item.show?.providers.map((p) => p.platformKey) ?? [];
        if (providerKeys.length === 0) return true; // unknown — don't hide
        return providerKeys.some((k) => subKeys.includes(k));
      });
      result[scope] = {
        scope,
        runId: run.id,
        modelId: run.modelId,
        mood: run.mood,
        createdAt: run.createdAt,
        items: visibleItems.map((item, index) => {
          const providerKeys =
            item.show?.providers.map((p) => p.platformKey) ?? [];
          const unavailable =
            providerKeys.length > 0 &&
            !providerKeys.some((k) => subKeys.includes(k));
          return {
            id: item.id,
            position: index + 1,
            tmdbId: item.tmdbId,
            title: item.title,
            year: item.year,
            posterUrl: item.posterUrl,
            shortExplanation: item.shortExplanation,
            longExplanation: item.longExplanation,
            isContinuation: item.isContinuation,
            providerKeys,
            unavailable,
            currentVote: item.show?.votes[0]?.vote ?? null,
            canVote,
            inWatchHistory:
              item.showId != null && watchedShowIds.has(item.showId),
          };
        }),
      };
    }),
  );
  return result;
}
