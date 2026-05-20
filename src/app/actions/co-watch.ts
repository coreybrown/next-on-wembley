"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidateAll } from "@/lib/revalidate";
import { furtherAlongProgress, type WatchProgress } from "@/lib/watch-entries";

export type CoWatchActionError =
  | "unauthorized"
  | "not_found"
  | "no_partner";

export type CoWatchActionResult =
  | {
      ok: true;
      on: boolean;
      // The state both profiles were snapped to on enable (the
      // further-along of the two). Null when disabling.
      synced: WatchProgress | null;
      partnerName: string | null;
    }
  | { ok: false; error: CoWatchActionError };

function pickProgress(e: {
  status: WatchProgress["status"];
  currentSeason: number | null;
  currentSeasonCompleted: boolean;
}): WatchProgress {
  return {
    status: e.status,
    currentSeason: e.currentSeason,
    currentSeasonCompleted: e.currentSeasonCompleted,
  };
}

// Phase 42: toggle whether the household co-watches a show. Enabling
// links the two users' WatchEntry rows — from then on, status / season
// changes propagate between them (see propagateCoWatch). On enable both
// profiles snap to the further-along state so neither partner loses
// progress; the partner's entry is created if they hadn't added the
// show. Disabling just drops the link; the entries diverge from there.
export async function setCoWatchAction(
  showId: number,
  on: boolean,
): Promise<CoWatchActionResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "unauthorized" };

  const partner = await prisma.user.findFirst({
    where: { id: { not: session.userId } },
    select: { id: true, displayName: true },
  });

  if (!on) {
    await prisma.coWatch.deleteMany({ where: { showId } });
    revalidateAll();
    return {
      ok: true,
      on: false,
      synced: null,
      partnerName: partner?.displayName ?? null,
    };
  }

  if (!partner) return { ok: false, error: "no_partner" };

  const [viewerEntry, partnerEntry] = await Promise.all([
    prisma.watchEntry.findUnique({
      where: { userId_showId: { userId: session.userId, showId } },
    }),
    prisma.watchEntry.findUnique({
      where: { userId_showId: { userId: partner.id, showId } },
    }),
  ]);
  // The toggle only surfaces on a show the viewer already tracks.
  if (!viewerEntry) return { ok: false, error: "not_found" };

  const merged = furtherAlongProgress(
    pickProgress(viewerEntry),
    partnerEntry ? pickProgress(partnerEntry) : null,
  );

  await prisma.$transaction([
    prisma.coWatch.upsert({
      where: { showId },
      create: { showId },
      update: {},
    }),
    prisma.watchEntry.update({
      where: { id: viewerEntry.id },
      data: merged,
    }),
    partnerEntry
      ? prisma.watchEntry.update({
          where: { id: partnerEntry.id },
          data: merged,
        })
      : prisma.watchEntry.create({
          data: { userId: partner.id, showId, ...merged },
        }),
  ]);

  revalidateAll();
  return {
    ok: true,
    on: true,
    synced: merged,
    partnerName: partner.displayName,
  };
}

export type CoWatchContext = {
  // showIds the household has marked co-watched. Co-watch is
  // household-wide (one CoWatch row per show), so this isn't scoped to
  // the viewer. Powers the dashboard's Together / On-your-own split.
  coWatchedShowIds: number[];
  // The other household member's display name — labels the co-watch
  // toggle. Null in a single-user setup.
  partnerName: string | null;
};

// Co-watch state needed to render the toggle + the dashboard split on a
// page: the set of co-watched shows and the partner's name, in one call.
export async function getCoWatchContext(): Promise<CoWatchContext> {
  const session = await getSession();
  if (!session.userId) return { coWatchedShowIds: [], partnerName: null };
  const [rows, partner] = await Promise.all([
    prisma.coWatch.findMany({ select: { showId: true } }),
    prisma.user.findFirst({
      where: { id: { not: session.userId } },
      select: { displayName: true },
    }),
  ]);
  return {
    coWatchedShowIds: rows.map((r) => r.showId),
    partnerName: partner?.displayName ?? null,
  };
}
