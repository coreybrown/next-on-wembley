import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FilmSlate } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/auth";
import { loadShowDetail } from "@/lib/show-detail";
import { PLATFORMS } from "@/lib/platforms";
import {
  STATUS_LABELS,
  RATING_LABELS,
  RATING_GLYPHS,
} from "@/lib/watch-entries";
import { VoteControlsRow } from "@/components/vote-controls-row";

const PLATFORM_NAME = new Map<string, string>(
  PLATFORMS.map((p) => [p.key, p.displayName]),
);

type PageProps = {
  params: Promise<{ tmdbId: string }>;
  searchParams: Promise<{ recItem?: string }>;
};

export default async function ShowDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { tmdbId: tmdbIdStr } = await params;
  const { recItem } = await searchParams;
  const tmdbId = Number(tmdbIdStr);
  if (!Number.isFinite(tmdbId)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recItemId = recItem ? Number(recItem) : null;
  const view = await loadShowDetail(
    tmdbId,
    user.id,
    recItemId != null && Number.isFinite(recItemId) ? recItemId : null,
  );
  if (!view) notFound();

  return (
    <main className="bg-page min-h-svh mx-auto max-w-3xl px-6 pb-16 pt-20">
      <nav className="mb-6">
        <Link
          href="/recs"
          className="
            inline-flex items-center gap-1
            font-mono text-mono uppercase text-ink-muted
            transition-colors hover:text-ink
            focus-visible:outline-2 focus-visible:outline-accent
            focus-visible:outline-offset-2
          "
        >
          <ArrowLeft size={14} weight="bold" aria-hidden />
          <span>Back to recs</span>
        </Link>
      </nav>

      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-3xl font-bold text-ink">
          {view.title}
        </h1>
        {view.recContext?.isContinuation && (
          <span
            className="
              inline-flex items-center rounded-pill
              bg-status-watching px-2 py-0.5
              font-mono text-mono uppercase tracking-wide text-accent-fg
            "
          >
            Continuation
          </span>
        )}
      </header>

      <section className="mt-6 flex flex-col gap-6 sm:flex-row sm:gap-8">
        {view.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={view.posterUrl}
            alt=""
            width={192}
            height={288}
            className="h-72 w-48 flex-shrink-0 rounded-sm bg-surface-overlay object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="h-72 w-48 flex-shrink-0 rounded-sm bg-surface-overlay"
          />
        )}
        <dl className="grid flex-1 grid-cols-[max-content_1fr] gap-x-6 gap-y-2 font-body text-base text-ink">
          {view.tmdbRating != null && (
            <>
              <dt className="font-mono text-mono uppercase text-ink-muted">
                TMDb rating
              </dt>
              <dd>{view.tmdbRating.toFixed(1)} / 10</dd>
            </>
          )}
          {view.genres && (
            <>
              <dt className="font-mono text-mono uppercase text-ink-muted">
                Genres
              </dt>
              <dd>{view.genres}</dd>
            </>
          )}
          {view.totalSeasons != null && (
            <>
              <dt className="font-mono text-mono uppercase text-ink-muted">
                Seasons
              </dt>
              <dd>
                {view.airedSeasons > 0 && view.airedSeasons < view.totalSeasons
                  ? `${view.airedSeasons} aired (of ${view.totalSeasons} announced)`
                  : view.totalSeasons}
                {view.totalEpisodes != null && ` · ${view.totalEpisodes} episodes`}
              </dd>
            </>
          )}
          {view.productionStatus && (
            <>
              <dt className="font-mono text-mono uppercase text-ink-muted">
                Status
              </dt>
              <dd>
                {view.productionStatus}{" "}
                <span className="font-mono text-mono uppercase text-ink-muted">
                  per TMDb · may change
                </span>
              </dd>
            </>
          )}
          {view.trailerUrl && (
            <>
              <dt className="font-mono text-mono uppercase text-ink-muted">
                Trailer
              </dt>
              <dd>
                <a
                  href={view.trailerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="
                    inline-flex items-center gap-1
                    text-accent underline-offset-2 hover:underline
                    focus-visible:outline-2 focus-visible:outline-accent
                    focus-visible:outline-offset-2
                  "
                >
                  <FilmSlate size={16} weight="regular" aria-hidden />
                  Watch on YouTube
                </a>
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="font-mono text-mono uppercase text-ink-muted">
          Where to watch (Canada)
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {view.providerKeys.length === 0 ? (
            <span className="font-mono text-mono uppercase text-ink-muted">
              Availability unknown
            </span>
          ) : (
            view.providerKeys.map((key) => (
              <span
                key={key}
                className="
                  inline-flex items-center rounded-pill
                  border border-border bg-surface
                  px-3 py-1
                  font-mono text-mono uppercase text-ink-secondary
                "
              >
                {PLATFORM_NAME.get(key) ?? key}
              </span>
            ))
          )}
          {view.unavailable && (
            <span
              className="
                inline-flex items-center rounded-pill
                bg-badge-unavailable px-2 py-0.5
                font-mono text-mono uppercase text-accent-fg
              "
            >
              Not on your subscriptions
            </span>
          )}
        </div>
      </section>

      {view.recContext && (
        <section className="mt-8">
          <h2 className="font-mono text-mono uppercase text-ink-muted">
            Why Claude picked this
          </h2>
          <p className="mt-2 font-body text-base text-ink">
            {view.recContext.longExplanation}
          </p>
          <VoteControlsRow
            itemId={view.recContext.itemId}
            title={view.title}
            currentVote={view.recContext.currentVote}
            canVote={view.recContext.canVote}
            isContinuation={view.recContext.isContinuation}
            inWatchHistory={view.userEntry != null}
          />
        </section>
      )}

      {view.overview && (
        <section className="mt-8">
          <h2 className="font-mono text-mono uppercase text-ink-muted">
            About the show
          </h2>
          <p className="mt-2 font-body text-base text-ink">
            {view.overview}
          </p>
          <p className="mt-2 font-mono text-mono uppercase text-ink-muted">
            Source: TMDb
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-mono text-mono uppercase text-ink-muted">
          Your list
        </h2>
        {view.userEntry ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="
                inline-flex items-center rounded-pill
                bg-accent px-3 py-1
                font-mono text-mono uppercase tracking-wide text-accent-fg
              "
            >
              {STATUS_LABELS[view.userEntry.status]}
            </span>
            {view.userEntry.currentSeason != null && (
              <span className="font-mono text-mono uppercase text-ink-muted">
                Season {view.userEntry.currentSeason}
                {view.userEntry.currentSeasonCompleted ? " (finished)" : ""}
              </span>
            )}
            {view.userEntry.userRating && (
              <span
                className="
                  inline-flex items-center gap-1 rounded-pill
                  border border-border bg-surface
                  px-2 py-0.5
                  font-mono text-mono uppercase tracking-wide text-ink-secondary
                "
              >
                <span aria-hidden>
                  {RATING_GLYPHS[view.userEntry.userRating]}
                </span>
                <span>{RATING_LABELS[view.userEntry.userRating]}</span>
              </span>
            )}
            <span className="font-mono text-mono uppercase text-ink-muted">
              Edit on the dashboard
            </span>
          </div>
        ) : (
          <p className="mt-2 font-body text-base text-ink-muted">
            Not on your list yet.
          </p>
        )}
      </section>
    </main>
  );
}
