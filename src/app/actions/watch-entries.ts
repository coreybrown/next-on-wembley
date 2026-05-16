"use server";

import { revalidatePath } from "next/cache";
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

  const show = await prisma.show.upsert({
    where: { tmdbId: input.tmdbId },
    create: {
      tmdbId: metadata.tmdbId,
      title: metadata.title,
      posterUrl: metadata.posterUrl,
      genres: metadata.genres,
      totalSeasons: metadata.totalSeasons,
      totalEpisodes: metadata.totalEpisodes,
      tmdbRating: metadata.tmdbRating,
      productionStatus: metadata.productionStatus,
    },
    update: {
      title: metadata.title,
      posterUrl: metadata.posterUrl,
      genres: metadata.genres,
      totalSeasons: metadata.totalSeasons,
      totalEpisodes: metadata.totalEpisodes,
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

  const existing = await prisma.watchEntry.findUnique({
    where: { userId_showId: { userId: session.userId, showId: show.id } },
  });
  if (existing) return { ok: false, error: "already_added" };

  await prisma.watchEntry.create({
    data: {
      userId: session.userId,
      showId: show.id,
      status: input.status,
      currentSeason: shouldClearSeason(input.status)
        ? null
        : input.currentSeason ?? null,
      userRating: input.userRating ?? null,
    },
  });

  revalidatePath("/");
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

  const entry = await prisma.watchEntry.findUnique({ where: { id: input.id } });
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

  const patch: Prisma.WatchEntryUpdateInput = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.userRating !== undefined) patch.userRating = input.userRating;
  if (input.currentSeason !== undefined) patch.currentSeason = input.currentSeason;
  if (willAutoClearSeason) patch.currentSeason = null;

  await prisma.watchEntry.update({ where: { id: input.id }, data: patch });
  revalidatePath("/");
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
  revalidatePath("/");
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
