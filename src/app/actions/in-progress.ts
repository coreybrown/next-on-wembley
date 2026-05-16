"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, UserRating } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getTvDetails, getTvProviders } from "@/lib/tmdb";
import {
  daysSince,
  parseSeasonsJson,
  releasedSeasonsCount,
} from "@/lib/in-progress";
import { isValidRating } from "@/lib/watch-entries";
import type { WatchEntryActionError } from "@/app/actions/watch-entries";

export type InProgressEntry = Prisma.WatchEntryGetPayload<{
  include: { show: { include: { providers: true } } };
}>;

export async function getInProgressEntries(): Promise<InProgressEntry[]> {
  const session = await getSession();
  if (!session.userId) return [];
  return prisma.watchEntry.findMany({
    where: {
      userId: session.userId,
      status: { in: ["watching", "paused"] },
    },
    include: { show: { include: { providers: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
}

const STALE_THRESHOLD_DAYS = 7;
const REFRESH_CONCURRENCY = 2;

export type InProgressActionResult =
  | { ok: true }
  | { ok: false; error: WatchEntryActionError };

// Inline +/- season nudge for Watching/Paused entries. Clamps at 1
// (below) and at totalSeasons (above) when known. Status outside
// watching/paused is rejected — those entries shouldn't carry a season.
export async function bumpSeasonAction(
  entryId: number,
  delta: 1 | -1,
): Promise<InProgressActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };
  if (delta !== 1 && delta !== -1) {
    return { ok: false, error: "invalid_season" };
  }

  const entry = await prisma.watchEntry.findUnique({
    where: { id: entryId },
    include: { show: true },
  });
  if (!entry || entry.userId !== session.userId) {
    return { ok: false, error: "not_found" };
  }
  if (entry.status !== "watching" && entry.status !== "paused") {
    return { ok: false, error: "invalid_status" };
  }

  const current = entry.currentSeason ?? 1;
  const next = current + delta;
  if (next < 1) return { ok: false, error: "invalid_season" };
  const ceiling = releasedSeasonsCount(
    parseSeasonsJson(entry.show.seasonsJson),
    entry.show.totalSeasons,
  );
  if (ceiling != null && next > ceiling) {
    return { ok: false, error: "invalid_season" };
  }

  await prisma.watchEntry.update({
    where: { id: entryId },
    // Crossing a season boundary resets the "done with current season"
    // flag — the new season is by definition not yet finished.
    data: { currentSeason: next, currentSeasonCompleted: false },
  });
  revalidatePath("/");
  revalidatePath("/in-progress");
  return { ok: true };
}

// Mark the current season as finished (or un-finish it). Independent of
// currentSeason — toggles only the boolean. This is how a user signals
// "I'm done with S2, waiting for S3" without having to bump to a
// season that doesn't exist yet.
export async function setSeasonCompletedAction(
  entryId: number,
  completed: boolean,
): Promise<InProgressActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const entry = await prisma.watchEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== session.userId) {
    return { ok: false, error: "not_found" };
  }
  if (entry.status !== "watching" && entry.status !== "paused") {
    return { ok: false, error: "invalid_status" };
  }

  await prisma.watchEntry.update({
    where: { id: entryId },
    data: { currentSeasonCompleted: completed },
  });
  revalidatePath("/");
  revalidatePath("/in-progress");
  return { ok: true };
}

// One-click "I'm done with this" — moves status to completed, clears
// currentSeason, optionally stamps a final rating from the inline prompt.
export async function finishItAction(
  entryId: number,
  rating?: UserRating | null,
): Promise<InProgressActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };
  if (rating != null && !isValidRating(rating)) {
    return { ok: false, error: "invalid_rating" };
  }

  const entry = await prisma.watchEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== session.userId) {
    return { ok: false, error: "not_found" };
  }

  await prisma.watchEntry.update({
    where: { id: entryId },
    data: {
      status: "completed",
      currentSeason: null,
      // Only overwrite the rating when the prompt actually returned one;
      // a null rating from the user means "skip", not "clear my existing".
      ...(rating != null ? { userRating: rating } : {}),
    },
  });
  revalidatePath("/");
  revalidatePath("/in-progress");
  return { ok: true };
}

// Re-pulls metadata + providers from TMDb for one show, bumps lastSyncedAt.
// Caller is responsible for ownership/auth gating — we don't here so
// refreshStaleInProgress can fan out without re-checking per show.
export async function refreshShowMetadata(showId: number): Promise<boolean> {
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) return false;

  let metadata: Awaited<ReturnType<typeof getTvDetails>>;
  let providers: Awaited<ReturnType<typeof getTvProviders>>;
  try {
    [metadata, providers] = await Promise.all([
      getTvDetails(show.tmdbId),
      getTvProviders(show.tmdbId),
    ]);
  } catch {
    return false;
  }

  await prisma.show.update({
    where: { id: showId },
    data: {
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

  await prisma.showProvider.deleteMany({ where: { showId } });
  if (providers.length > 0) {
    await prisma.showProvider.createMany({
      data: providers.map((p) => ({
        showId,
        platformKey: p.platformKey,
        monetizationType: p.monetizationType,
      })),
    });
  }
  return true;
}

// Refresh metadata for the current user's Watching + Paused shows whose
// last sync is older than the staleness threshold. Throttled — we run
// REFRESH_CONCURRENCY refreshes at a time so a long list doesn't hammer
// TMDb. Errors per-show are swallowed so one bad fetch doesn't sink the
// whole page render.
export async function refreshStaleInProgress(): Promise<{ refreshed: number }> {
  const session = await getSession();
  if (!session.userId) return { refreshed: 0 };

  const entries = await prisma.watchEntry.findMany({
    where: {
      userId: session.userId,
      status: { in: ["watching", "paused"] },
    },
    include: {
      show: {
        select: { id: true, lastSyncedAt: true, seasonsJson: true },
      },
    },
  });
  // Refresh shows that are time-stale OR pre-Phase-6 rows (no seasonsJson yet).
  // The latter is a one-time backfill so legacy entries get the new per-season
  // data on next /in-progress visit without manual intervention.
  const stale = entries
    .map((e) => e.show)
    .filter(
      (s) =>
        s.seasonsJson == null ||
        daysSince(s.lastSyncedAt) >= STALE_THRESHOLD_DAYS,
    );
  // dedupe by show id in case both users share the same show
  const uniqueIds = Array.from(new Set(stale.map((s) => s.id)));

  let refreshed = 0;
  for (let i = 0; i < uniqueIds.length; i += REFRESH_CONCURRENCY) {
    const batch = uniqueIds.slice(i, i + REFRESH_CONCURRENCY);
    const results = await Promise.all(batch.map(refreshShowMetadata));
    refreshed += results.filter(Boolean).length;
  }
  return { refreshed };
}
