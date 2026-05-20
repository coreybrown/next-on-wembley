import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserSubscriptions } from "@/lib/settings";
import {
  getInProgressEntries,
  refreshStaleInProgress,
} from "@/app/actions/in-progress";
import { getCoWatchContext } from "@/app/actions/co-watch";
import {
  parseSeasonsJson,
  progressLabel,
  releasedSeasonsCount,
  isUnavailableOnSubscriptions,
} from "@/lib/in-progress";
import { InProgressList } from "@/components/in-progress-list";
import type { InProgressCardData } from "@/components/in-progress-card";

export default async function InProgressPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Refresh stale metadata BEFORE we load entries so freshly-pulled
  // seasonsJson + provider data flows into this render. PRD §239: spec
  // calls for skeleton entries on first load — we keep it simple for
  // now and block; revisit when latency becomes visible.
  await refreshStaleInProgress();

  const [entries, userSubs, { coWatchedShowIds, partnerName }] =
    await Promise.all([
      getInProgressEntries(),
      getUserSubscriptions(),
      getCoWatchContext(),
    ]);
  const coWatchedSet = new Set(coWatchedShowIds);

  const cards: InProgressCardData[] = entries.map((entry) => {
    const seasons = parseSeasonsJson(entry.show.seasonsJson);
    const releasedCeiling = releasedSeasonsCount(
      seasons,
      entry.show.totalSeasons,
    );
    return {
      entry,
      label: progressLabel({
        currentSeason: entry.currentSeason,
        currentSeasonCompleted: entry.currentSeasonCompleted,
        totalSeasons: entry.show.totalSeasons,
        releasedCeiling,
      }),
      unavailable: isUnavailableOnSubscriptions(
        entry.show.providers.map((p) => p.platformKey),
        userSubs,
      ),
      coWatch: coWatchedSet.has(entry.showId),
    };
  });

  return (
    <main className="bg-page mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-8 sm:py-12">
      <header className="mb-10">
        <p className="font-mono text-mono uppercase text-ink-muted">
          [In Progress]
        </p>
        <h1 className="mt-3 font-display text-2xl font-black text-ink leading-none sm:text-4xl">
          What you&rsquo;re watching
        </h1>
        <div aria-hidden className="mt-3 h-[2px] w-16 bg-accent-sharp" />
      </header>

      <InProgressList cards={cards} partnerName={partnerName} />
    </main>
  );
}
