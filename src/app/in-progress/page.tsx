import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth";
import { getUserSubscriptions } from "@/lib/settings";
import {
  getInProgressEntries,
  refreshStaleInProgress,
} from "@/app/actions/in-progress";
import {
  parseSeasonsJson,
  episodesRemaining,
  inProgressLabel,
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

  const [entries, userSubs] = await Promise.all([
    getInProgressEntries(),
    getUserSubscriptions(),
  ]);

  const cards: InProgressCardData[] = entries.map((entry) => {
    const seasons = parseSeasonsJson(entry.show.seasonsJson);
    return {
      entry,
      label: inProgressLabel(entry.currentSeason, entry.show.totalSeasons),
      episodesRemaining: episodesRemaining(
        entry.currentSeason,
        seasons,
        entry.show.totalEpisodes,
      ),
      unavailable: isUnavailableOnSubscriptions(
        entry.show.providers.map((p) => p.platformKey),
        userSubs,
      ),
    };
  });

  return (
    <main className="bg-page mx-auto min-h-svh max-w-3xl px-6 py-16 sm:px-8 sm:py-20">
      <Link
        href="/"
        className="
          inline-flex items-center gap-2
          font-mono text-mono uppercase text-ink-muted
          transition-colors hover:text-ink
          focus-visible:outline-2 focus-visible:outline-accent
          focus-visible:outline-offset-2
        "
      >
        <ArrowLeft size={14} weight="regular" aria-hidden />
        <span>Back to list</span>
      </Link>

      <header className="mt-8 mb-10">
        <p className="font-mono text-mono uppercase text-ink-muted">
          [In Progress · {user.displayName}]
        </p>
        <h1 className="mt-3 font-display text-2xl font-black text-ink leading-none sm:text-4xl">
          What you&rsquo;re watching
        </h1>
        <div aria-hidden className="mt-3 h-[2px] w-16 bg-accent-sharp" />
      </header>

      <InProgressList cards={cards} />
    </main>
  );
}
