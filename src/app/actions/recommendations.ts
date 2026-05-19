"use server";

import { revalidatePath } from "next/cache";
import type { RecScope } from "@prisma/client";
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
} from "@/lib/rec-prompts";
import { getUserContext, intersectSubscriptions } from "@/lib/rec-context";

const TARGET_LIST_LENGTH = 10;

export type GenerateRecommendationsError =
  | "unauthorized"
  | "not_found"
  | "anthropic_failed"
  | "no_valid_items";

export type GenerateRecommendationsResult =
  | { ok: true; runId: number; itemCount: number }
  | { ok: false; error: GenerateRecommendationsError };

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
  let metadata: TmdbShowMetadata;
  try {
    metadata = await getTvDetails(tmdbId);
  } catch {
    const results = await searchTv(fallbackTitle).catch(() => []);
    if (results.length === 0) return null;
    try {
      metadata = await getTvDetails(results[0].tmdbId);
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
    await prisma.recommendationRun.create({
      data: {
        triggeredBy: triggerUser.id,
        scope,
        modelId,
        mood: mood ?? null,
        status: "failed",
        errorMessage: (err as Error).message,
      },
    });
    return { ok: false, error: "anthropic_failed" };
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

  // Validate, upsert, persist. Drop unresolvable hints and (for new picks)
  // shows that don't overlap with the relevant subs. Continuations stay
  // visible regardless of availability (PRD §162) — the UI badges them.
  const persisted: Array<{
    rec: RawRecommendation;
    showId: number;
    metadata: TmdbShowMetadata;
    providers: TmdbProviderInfo[];
  }> = [];

  for (const rec of llmOut.recommendations) {
    if (persisted.length >= TARGET_LIST_LENGTH) break;
    const resolved = await resolveTmdbHint(rec.tmdbId, rec.title);
    if (!resolved) continue;

    if (!rec.isContinuation) {
      const providerKeys = resolved.providers.map((p) => p.platformKey);
      const hasOverlap = providerKeys.some((k) => gateSubs.includes(k));
      if (!hasOverlap) continue;
    }
    const showId = await upsertResolvedShow(resolved);
    persisted.push({
      rec,
      showId,
      metadata: resolved.metadata,
      providers: resolved.providers,
    });
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
