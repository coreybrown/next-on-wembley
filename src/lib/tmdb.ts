import "server-only";
import type { PlatformKey } from "@/lib/platforms";
import { tmdbProviderToPlatformKey } from "@/lib/tmdb-providers";

const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const POSTER_SIZE = "w342";

export class TmdbError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

export class TmdbAuthError extends TmdbError {
  constructor(message = "TMDb authentication failed — check TMDB_API_KEY") {
    super(message, 401);
    this.name = "TmdbAuthError";
  }
}

export class TmdbNotFoundError extends TmdbError {
  constructor(message = "TMDb resource not found") {
    super(message, 404);
    this.name = "TmdbNotFoundError";
  }
}

export class TmdbTransientError extends TmdbError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = "TmdbTransientError";
  }
}

function getApiKey(): string {
  const k = process.env.TMDB_API_KEY;
  if (!k) {
    throw new TmdbError("TMDB_API_KEY is not configured");
  }
  return k;
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const doFetch = () =>
    fetch(url, { signal, headers: { Accept: "application/json" } });

  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    res = await doFetch();
  }

  if (res.ok) return res.json() as Promise<T>;

  if (res.status === 401) throw new TmdbAuthError();
  if (res.status === 404) throw new TmdbNotFoundError();

  if (res.status >= 500) {
    const retry = await doFetch();
    if (retry.ok) return retry.json() as Promise<T>;
    throw new TmdbTransientError(
      `TMDb upstream error (${retry.status})`,
      retry.status,
    );
  }

  throw new TmdbError(`TMDb error (${res.status})`, res.status);
}

// ---------- search ----------

type TmdbSearchTvResponse = {
  results: Array<{
    id: number;
    name: string;
    first_air_date?: string;
    poster_path?: string | null;
    popularity?: number;
  }>;
};

export type TmdbSearchResult = {
  tmdbId: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
};

export async function searchTv(
  query: string,
  signal?: AbortSignal,
): Promise<TmdbSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const data = await tmdbFetch<TmdbSearchTvResponse>(
    "/search/tv",
    { query: trimmed, include_adult: "false" },
    signal,
  );
  // TMDb's default order favors substring-position over popularity, which
  // buries well-known shows (e.g. "Severance" for query "seve" ranks below
  // a wall of low-popularity "Seven..." anime). Re-sorting the first page
  // by popularity before slicing to 8 surfaces what a human actually wants.
  return [...data.results]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 8)
    .map((r) => ({
      tmdbId: r.id,
      title: r.name,
      year: r.first_air_date ? r.first_air_date.slice(0, 4) : null,
      posterUrl: r.poster_path
        ? `${TMDB_IMAGE_BASE}/${POSTER_SIZE}${r.poster_path}`
        : null,
    }));
}

// ---------- details ----------

type TmdbTvDetails = {
  id: number;
  name: string;
  poster_path: string | null;
  genres: Array<{ id: number; name: string }>;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  vote_average: number | null;
  status: string | null;
  seasons?: Array<{
    season_number: number;
    episode_count: number | null;
  }>;
};

export type SeasonInfo = {
  seasonNumber: number;
  episodeCount: number;
};

export type TmdbShowMetadata = {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  genres: string;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  seasonsJson: string | null;
  tmdbRating: number | null;
  productionStatus: string | null;
};

export async function getTvDetails(tmdbId: number): Promise<TmdbShowMetadata> {
  const d = await tmdbFetch<TmdbTvDetails>(`/tv/${tmdbId}`);
  // Filter season 0 (specials) and any seasons with no aired episodes —
  // they shouldn't count toward episodes-remaining.
  const seasons: SeasonInfo[] = (d.seasons ?? [])
    .filter(
      (s) =>
        s.season_number > 0 &&
        typeof s.episode_count === "number" &&
        s.episode_count > 0,
    )
    .map((s) => ({
      seasonNumber: s.season_number,
      episodeCount: s.episode_count as number,
    }));
  return {
    tmdbId: d.id,
    title: d.name,
    posterUrl: d.poster_path
      ? `${TMDB_IMAGE_BASE}/${POSTER_SIZE}${d.poster_path}`
      : null,
    genres: d.genres.map((g) => g.name).join(", "),
    totalSeasons: d.number_of_seasons,
    totalEpisodes: d.number_of_episodes,
    seasonsJson: seasons.length > 0 ? JSON.stringify(seasons) : null,
    tmdbRating: d.vote_average,
    productionStatus: d.status,
  };
}

// ---------- providers ----------

type TmdbProviderEntry = { provider_id: number; provider_name: string };
type TmdbProvidersResponse = {
  results: Record<
    string,
    {
      flatrate?: TmdbProviderEntry[];
      free?: TmdbProviderEntry[];
      ads?: TmdbProviderEntry[];
      rent?: TmdbProviderEntry[];
      buy?: TmdbProviderEntry[];
    }
  >;
};

export type TmdbProviderInfo = {
  platformKey: PlatformKey;
  monetizationType: "flatrate";
};

export async function getTvProviders(
  tmdbId: number,
  region = "CA",
): Promise<TmdbProviderInfo[]> {
  const d = await tmdbFetch<TmdbProvidersResponse>(
    `/tv/${tmdbId}/watch/providers`,
  );
  const regionData = d.results[region];
  if (!regionData?.flatrate) return [];
  const out: TmdbProviderInfo[] = [];
  const seen = new Set<PlatformKey>();
  for (const p of regionData.flatrate) {
    const key = tmdbProviderToPlatformKey(p.provider_id);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push({ platformKey: key, monetizationType: "flatrate" });
    }
  }
  return out;
}

// ---------- videos / trailer ----------

type TmdbVideosResponse = {
  results: Array<{
    site: string;
    type: string;
    key: string;
    official: boolean;
  }>;
};

export async function getTvTrailerUrl(tmdbId: number): Promise<string | null> {
  const d = await tmdbFetch<TmdbVideosResponse>(`/tv/${tmdbId}/videos`);
  const trailers = d.results.filter(
    (v) => v.site === "YouTube" && v.type === "Trailer",
  );
  const chosen =
    trailers.find((v) => v.official) ?? trailers[0] ?? null;
  return chosen ? `https://www.youtube.com/watch?v=${chosen.key}` : null;
}
