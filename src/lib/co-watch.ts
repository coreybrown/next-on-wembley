import "server-only";
import { prisma } from "@/lib/db";
import type { WatchProgress } from "@/lib/watch-entries";

// Phase 42: mirrors a progress change onto the partner's WatchEntry when
// a show is co-watched. Called after every status / season mutation in
// the watch-entry and in-progress actions. No-op when the show isn't
// co-watched or the partner has no entry for it (which shouldn't happen
// while the CoWatch row exists — setCoWatchAction creates the partner's
// entry — but updateMany degrades to a harmless no-op if it does).
export async function propagateCoWatch(
  showId: number,
  sourceUserId: number,
  progress: WatchProgress,
): Promise<void> {
  const link = await prisma.coWatch.findUnique({ where: { showId } });
  if (!link) return;
  await prisma.watchEntry.updateMany({
    where: { showId, userId: { not: sourceUserId } },
    data: progress,
  });
}
