import { prisma } from "@/lib/db";
import { parseSeasonsJson } from "@/lib/in-progress";
import type { UserContext } from "@/lib/rec-prompts";

const RECENT_VOTES_LIMIT = 30;

// Build the per-user context the rec engine reasons over. Pulls watch
// entries with show metadata, active subscriptions, and recent vote
// signals. Returns null if the user doesn't exist.
export async function getUserContext(userId: number): Promise<UserContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      displayName: true,
      subscriptions: { select: { platformKey: true } },
      watchEntries: {
        include: {
          show: {
            select: {
              tmdbId: true,
              title: true,
              productionStatus: true,
              seasonsJson: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      showVotes: {
        orderBy: { createdAt: "desc" },
        take: RECENT_VOTES_LIMIT,
        include: { show: { select: { title: true } } },
      },
    },
  });
  if (!user) return null;
  return {
    username: user.username,
    displayName: user.displayName,
    subscriptions: user.subscriptions.map((s) => s.platformKey),
    watchEntries: user.watchEntries.map((e) => {
      const seasons = parseSeasonsJson(e.show.seasonsJson);
      const airedSeasons =
        seasons.length > 0
          ? Math.max(...seasons.map((s) => s.seasonNumber))
          : 0;
      return {
        tmdbId: e.show.tmdbId,
        title: e.show.title,
        status: e.status,
        currentSeason: e.currentSeason,
        currentSeasonCompleted: e.currentSeasonCompleted,
        rating: e.userRating,
        airedSeasons,
      };
    }),
    recentVotes: user.showVotes.map((v) => ({
      title: v.show.title,
      vote: v.vote,
    })),
  };
}

export function intersectSubscriptions(
  a: readonly string[],
  b: readonly string[],
): string[] {
  const setB = new Set(b);
  return a.filter((p) => setB.has(p));
}
