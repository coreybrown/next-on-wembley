"use server";

import type { WatchStatus, UserRating, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getTvDetails, getTvProviders } from "@/lib/tmdb";
import {
  isValidStatus,
  isValidRating,
  isSeasonValidForStatus,
  shouldClearSeason,
} from "@/lib/watch-entries";
import {
  parseSeasonsJson,
  releasedSeasonsCount,
} from "@/lib/in-progress";
import { upsertShowFromResolved } from "@/lib/show-sync";
import { propagateCoWatch } from "@/lib/co-watch";
import { revalidateAll } from "@/lib/revalidate";

export type WatchEntryActionError =
  | "unauthorized"
  | "not_found"
  | "invalid_status"
  | "invalid_rating"
  | "invalid_season"
  | "already_added"
  | "tmdb_unavailable";

export type WatchEntryActionResult =
  | { ok: true }
  | { ok: false; error: WatchEntryActionError };

type AddInput = {
  tmdbId: number;
  status: WatchStatus;
  currentSeason?: number | null;
  userRating?: UserRating | null;
};

export async function addWatchEntry(
  input: AddInput,
): Promise<WatchEntryActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  if (!isValidStatus(input.status)) {
    return { ok: false, error: "invalid_status" };
  }
  if (!isSeasonValidForStatus(input.status, input.currentSeason ?? null)) {
    return { ok: false, error: "invalid_season" };
  }
  if (input.userRating != null && !isValidRating(input.userRating)) {
    return { ok: false, error: "invalid_rating" };
  }

  let metadata: Awaited<ReturnType<typeof getTvDetails>>;
  let providers: Awaited<ReturnType<typeof getTvProviders>>;
  try {
    [metadata, providers] = await Promise.all([
      getTvDetails(input.tmdbId),
      getTvProviders(input.tmdbId),
    ]);
  } catch {
    return { ok: false, error: "tmdb_unavailable" };
  }

  const showId = await upsertShowFromResolved({ metadata, providers });

  const existing = await prisma.watchEntry.findUnique({
    where: { userId_showId: { userId: session.userId, showId } },
  });
  if (existing) return { ok: false, error: "already_added" };

  await prisma.watchEntry.create({
    data: {
      userId: session.userId,
      showId,
      status: input.status,
      currentSeason: shouldClearSeason(input.status)
        ? null
        : input.currentSeason ?? null,
      userRating: input.userRating ?? null,
    },
  });

  revalidateAll();
  return { ok: true };
}

type UpdateInput = {
  id: number;
  status?: WatchStatus;
  currentSeason?: number | null;
  userRating?: UserRating | null;
};

export async function updateWatchEntry(
  input: UpdateInput,
): Promise<WatchEntryActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const entry = await prisma.watchEntry.findUnique({
    where: { id: input.id },
    include: { show: true },
  });
  if (!entry || entry.userId !== session.userId) {
    return { ok: false, error: "not_found" };
  }

  if (input.status !== undefined && !isValidStatus(input.status)) {
    return { ok: false, error: "invalid_status" };
  }
  if (
    input.userRating != null &&
    !isValidRating(input.userRating)
  ) {
    return { ok: false, error: "invalid_rating" };
  }

  const nextStatus: WatchStatus = input.status ?? entry.status;
  // A status transition into a non-in-progress state clears any existing season,
  // so validate against the *effective* season after that auto-clear.
  const willAutoClearSeason =
    input.status !== undefined && shouldClearSeason(nextStatus);
  const nextSeason = willAutoClearSeason
    ? null
    : input.currentSeason !== undefined
      ? input.currentSeason
      : entry.currentSeason;
  if (!isSeasonValidForStatus(nextStatus, nextSeason)) {
    return { ok: false, error: "invalid_season" };
  }
  // Cap at the highest released season; TMDb's totalSeasons can be ahead
  // of reality (announced-but-unaired seasons).
  if (nextSeason != null) {
    const ceiling = releasedSeasonsCount(
      parseSeasonsJson(entry.show.seasonsJson),
      entry.show.totalSeasons,
    );
    if (ceiling != null && nextSeason > ceiling) {
      return { ok: false, error: "invalid_season" };
    }
  }

  const patch: Prisma.WatchEntryUpdateInput = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.userRating !== undefined) patch.userRating = input.userRating;
  if (input.currentSeason !== undefined) patch.currentSeason = input.currentSeason;
  if (willAutoClearSeason) patch.currentSeason = null;

  await prisma.watchEntry.update({ where: { id: input.id }, data: patch });
  // Mirror status / season onto the partner when the show is co-watched.
  // Skipped for rating-only edits — ratings are personal, never synced.
  if (input.status !== undefined || input.currentSeason !== undefined) {
    await propagateCoWatch(entry.showId, session.userId, {
      status: nextStatus,
      currentSeason: willAutoClearSeason ? null : nextSeason,
      currentSeasonCompleted: entry.currentSeasonCompleted,
    });
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteWatchEntry(
  id: number,
): Promise<WatchEntryActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const entry = await prisma.watchEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== session.userId) {
    return { ok: false, error: "not_found" };
  }
  await prisma.watchEntry.delete({ where: { id } });
  // Removing a co-watched show from your list ends the co-watch — the
  // partner keeps their entry, but progress stops syncing.
  await prisma.coWatch.deleteMany({ where: { showId: entry.showId } });
  // Dashboard, in-progress, and rec-card WTW button visibility all
  // pivot on watch-history membership — bust all three.
  revalidateAll();
  return { ok: true };
}

export type WatchEntryWithShow = Prisma.WatchEntryGetPayload<{
  include: { show: true };
}>;

export async function getWatchEntries(): Promise<WatchEntryWithShow[]> {
  const session = await getSession();
  if (!session.userId) return [];
  return prisma.watchEntry.findMany({
    where: { userId: session.userId },
    include: { show: true },
    orderBy: [{ updatedAt: "desc" }],
  });
}
