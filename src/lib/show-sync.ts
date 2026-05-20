import "server-only";
import { prisma } from "@/lib/db";
import type { TmdbShowMetadata, TmdbProviderInfo } from "@/lib/tmdb";

// Phase 34. Single source of truth for "persist a TMDb show + its
// providers." Previously inlined in three places (rec generation,
// watch-entry adds, in-progress refresh) — any new Show column had
// to be wired into three upserts, which was the load-bearing cause
// of the `overview` field landing late on existing rows.
//
// The two callers can pre-fetch metadata + providers in parallel and
// hand the resolved pair in (rec generation does this), OR they can
// pass the tmdbId and let this helper fetch on their behalf. The
// helper accepts the resolved shape for both paths so the existing
// rec-engine call doesn't need to give up its parallel-fetch
// optimization.

export type ResolvedShow = {
  metadata: TmdbShowMetadata;
  providers: TmdbProviderInfo[];
};

// Upserts the Show row + replaces its ShowProvider rows. Returns the
// resulting Show.id. Always bumps `lastSyncedAt` on update so the
// dashboard's stale-show sweep skips freshly-synced rows.
export async function upsertShowFromResolved(
  resolved: ResolvedShow,
): Promise<number> {
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
