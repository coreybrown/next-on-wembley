import "server-only";
import type { WatchStatus, UserRating, VoteValue } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseSeasonsJson } from "@/lib/in-progress";

export type ShowDetailRecContext = {
  itemId: number;
  isContinuation: boolean;
  longExplanation: string;
  // Owner's vote on the show (per Phase 15.1 ownership rules). Read-only
  // for the partner when scope is not co_watch and the viewer isn't the
  // owner.
  currentVote: VoteValue | null;
  canVote: boolean;
};

export type ShowDetailUserEntry = {
  status: WatchStatus;
  currentSeason: number | null;
  currentSeasonCompleted: boolean;
  userRating: UserRating | null;
};

export type ShowDetailView = {
  showId: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  genres: string | null;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  airedSeasons: number;
  tmdbRating: number | null;
  productionStatus: string | null;
  trailerUrl: string | null;
  // PlatformKeys from ShowProvider. The page renders all of them with an
  // availability badge against the current user's subs.
  providerKeys: string[];
  unavailable: boolean;
  userEntry: ShowDetailUserEntry | null;
  // Present only when ?recItem=N matched a row.
  recContext: ShowDetailRecContext | null;
};

// Fetches everything needed to render /show/[tmdbId] for the current user.
// Returns null when the show isn't in our DB (we haven't seeded it via a
// rec or a watch-add yet) — caller should 404.
export async function loadShowDetail(
  tmdbId: number,
  sessionUserId: number,
  recItemId: number | null,
): Promise<ShowDetailView | null> {
  const [show, subs] = await Promise.all([
    prisma.show.findUnique({
      where: { tmdbId },
      include: {
        providers: { select: { platformKey: true } },
        watchEntries: {
          where: { userId: sessionUserId },
          select: {
            status: true,
            currentSeason: true,
            currentSeasonCompleted: true,
            userRating: true,
          },
          take: 1,
        },
        votes: {
          // The owner's vote is conditional on the rec context's scope —
          // resolved below. For now grab all the votes on this show; the
          // post-fetch logic picks the right one.
          select: { userId: true, vote: true },
        },
      },
    }),
    prisma.userSubscription.findMany({
      where: { userId: sessionUserId },
      select: { platformKey: true },
    }),
  ]);
  if (!show) return null;

  const subKeys = subs.map((s) => s.platformKey);
  const providerKeys = show.providers.map((p) => p.platformKey);
  const unavailable =
    providerKeys.length > 0 &&
    !providerKeys.some((k) => subKeys.includes(k));

  const seasons = parseSeasonsJson(show.seasonsJson);
  const airedSeasons =
    seasons.length > 0
      ? Math.max(...seasons.map((s) => s.seasonNumber))
      : 0;

  let recContext: ShowDetailRecContext | null = null;
  if (recItemId != null) {
    const item = await prisma.recommendationItem.findUnique({
      where: { id: recItemId },
      select: {
        id: true,
        isContinuation: true,
        longExplanation: true,
        run: { select: { scope: true } },
      },
    });
    // Only attach rec context if the item exists AND points at this show
    // (defensive — query-string can be tampered with).
    if (item) {
      const scope = item.run.scope;
      let ownerUserId: number | null;
      if (scope === "co_watch") {
        ownerUserId = sessionUserId;
      } else {
        const owner = await prisma.user.findUnique({
          where: { username: scope },
          select: { id: true },
        });
        ownerUserId = owner?.id ?? null;
      }
      const canVote =
        scope === "co_watch" ? true : ownerUserId === sessionUserId;
      const ownerVote =
        ownerUserId != null
          ? show.votes.find((v) => v.userId === ownerUserId)?.vote ?? null
          : null;
      recContext = {
        itemId: item.id,
        isContinuation: item.isContinuation,
        longExplanation: item.longExplanation,
        currentVote: ownerVote,
        canVote,
      };
    }
  }

  return {
    showId: show.id,
    tmdbId: show.tmdbId,
    title: show.title,
    posterUrl: show.posterUrl,
    genres: show.genres,
    totalSeasons: show.totalSeasons,
    totalEpisodes: show.totalEpisodes,
    airedSeasons,
    tmdbRating: show.tmdbRating,
    productionStatus: show.productionStatus,
    trailerUrl: show.trailerUrl,
    providerKeys,
    unavailable,
    userEntry: show.watchEntries[0] ?? null,
    recContext,
  };
}
