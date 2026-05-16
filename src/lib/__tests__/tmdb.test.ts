import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const ORIGINAL_KEY = process.env.TMDB_API_KEY;

beforeEach(() => {
  process.env.TMDB_API_KEY = "test-key-32chars-aaaaaaaaaaaaaaaa";
  vi.restoreAllMocks();
});

afterAll(() => {
  process.env.TMDB_API_KEY = ORIGINAL_KEY;
});

const {
  searchTv,
  getTvDetails,
  getTvProviders,
  getTvTrailerUrl,
  TmdbAuthError,
  TmdbNotFoundError,
  TmdbTransientError,
  TmdbError,
  TMDB_IMAGE_BASE,
  POSTER_SIZE,
} = await import("@/lib/tmdb");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchOnce(response: Response | Error) {
  const spy = vi.spyOn(globalThis, "fetch");
  if (response instanceof Error) spy.mockRejectedValueOnce(response);
  else spy.mockResolvedValueOnce(response);
  return spy;
}

describe("searchTv", () => {
  it("returns [] for empty / whitespace query without hitting fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await searchTv("")).toEqual([]);
    expect(await searchTv("   ")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("composes the right URL with api_key + query + include_adult", async () => {
    const spy = mockFetchOnce(jsonResponse({ results: [] }));
    await searchTv("Severance");
    const url = new URL(spy.mock.calls[0]![0] as URL);
    expect(url.origin + url.pathname).toBe(
      "https://api.themoviedb.org/3/search/tv",
    );
    expect(url.searchParams.get("api_key")).toBe(
      "test-key-32chars-aaaaaaaaaaaaaaaa",
    );
    expect(url.searchParams.get("query")).toBe("Severance");
    expect(url.searchParams.get("include_adult")).toBe("false");
  });

  it("maps results, slices to 8, and builds poster URLs", async () => {
    const results = Array.from({ length: 12 }, (_, i) => ({
      id: 100 + i,
      name: `Show ${i}`,
      first_air_date: `202${i % 10}-01-01`,
      poster_path: `/p${i}.jpg`,
    }));
    mockFetchOnce(jsonResponse({ results }));
    const out = await searchTv("anything");
    expect(out).toHaveLength(8);
    expect(out[0]).toEqual({
      tmdbId: 100,
      title: "Show 0",
      year: "2020",
      posterUrl: `${TMDB_IMAGE_BASE}/${POSTER_SIZE}/p0.jpg`,
    });
  });

  it("handles missing poster + missing first_air_date", async () => {
    mockFetchOnce(
      jsonResponse({
        results: [{ id: 1, name: "Bare Show", poster_path: null }],
      }),
    );
    const [r] = await searchTv("bare");
    expect(r.posterUrl).toBeNull();
    expect(r.year).toBeNull();
  });

  it("throws TmdbAuthError on 401", async () => {
    mockFetchOnce(jsonResponse({ status_message: "invalid key" }, 401));
    await expect(searchTv("x")).rejects.toBeInstanceOf(TmdbAuthError);
  });

  it("retries once on a network error then succeeds", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    spy.mockRejectedValueOnce(new TypeError("network"));
    spy.mockResolvedValueOnce(jsonResponse({ results: [] }));
    await expect(searchTv("x")).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("retries once on 500 then succeeds", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    spy.mockResolvedValueOnce(jsonResponse({}, 500));
    spy.mockResolvedValueOnce(jsonResponse({ results: [] }));
    await expect(searchTv("x")).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("throws TmdbTransientError after retry exhausted on 5xx", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    spy.mockResolvedValueOnce(jsonResponse({}, 502));
    spy.mockResolvedValueOnce(jsonResponse({}, 502));
    await expect(searchTv("x")).rejects.toBeInstanceOf(TmdbTransientError);
  });

  it("propagates AbortError without retry", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const abortErr = Object.assign(new Error("aborted"), { name: "AbortError" });
    spy.mockRejectedValueOnce(abortErr);
    await expect(searchTv("x")).rejects.toMatchObject({ name: "AbortError" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("throws TmdbError when TMDB_API_KEY is missing", async () => {
    const prev = process.env.TMDB_API_KEY;
    delete process.env.TMDB_API_KEY;
    await expect(searchTv("x")).rejects.toBeInstanceOf(TmdbError);
    process.env.TMDB_API_KEY = prev;
  });
});

describe("getTvDetails", () => {
  it("maps fields and joins genres", async () => {
    mockFetchOnce(
      jsonResponse({
        id: 12,
        name: "Title",
        poster_path: "/p.jpg",
        genres: [{ id: 1, name: "Drama" }, { id: 2, name: "Sci-Fi" }],
        number_of_seasons: 3,
        number_of_episodes: 30,
        vote_average: 8.4,
        status: "Returning Series",
      }),
    );
    const m = await getTvDetails(12);
    expect(m).toEqual({
      tmdbId: 12,
      title: "Title",
      posterUrl: `${TMDB_IMAGE_BASE}/${POSTER_SIZE}/p.jpg`,
      genres: "Drama, Sci-Fi",
      totalSeasons: 3,
      totalEpisodes: 30,
      tmdbRating: 8.4,
      productionStatus: "Returning Series",
    });
  });

  it("throws TmdbNotFoundError on 404", async () => {
    mockFetchOnce(jsonResponse({}, 404));
    await expect(getTvDetails(999)).rejects.toBeInstanceOf(TmdbNotFoundError);
  });
});

describe("getTvProviders", () => {
  it("maps known CA flatrate providers, dedupes, drops unknowns", async () => {
    mockFetchOnce(
      jsonResponse({
        results: {
          CA: {
            flatrate: [
              { provider_id: 8, provider_name: "Netflix" },
              { provider_id: 8, provider_name: "Netflix dupe" },
              { provider_id: 119, provider_name: "Prime" },
              { provider_id: 531, provider_name: "Paramount+ (deferred)" },
              { provider_id: 9999, provider_name: "Unknown" },
            ],
            rent: [{ provider_id: 230, provider_name: "Crave" }],
          },
          US: { flatrate: [{ provider_id: 8, provider_name: "Netflix US" }] },
        },
      }),
    );
    const out = await getTvProviders(1);
    expect(out).toEqual([
      { platformKey: "netflix", monetizationType: "flatrate" },
      { platformKey: "prime_video", monetizationType: "flatrate" },
    ]);
  });

  it("returns [] when region absent", async () => {
    mockFetchOnce(jsonResponse({ results: { US: { flatrate: [] } } }));
    expect(await getTvProviders(1)).toEqual([]);
  });

  it("returns [] when region has no flatrate (rent/buy only)", async () => {
    mockFetchOnce(
      jsonResponse({
        results: { CA: { rent: [{ provider_id: 8, provider_name: "x" }] } },
      }),
    );
    expect(await getTvProviders(1)).toEqual([]);
  });
});

describe("getTvTrailerUrl", () => {
  it("prefers official YouTube trailer", async () => {
    mockFetchOnce(
      jsonResponse({
        results: [
          { site: "YouTube", type: "Trailer", key: "abc", official: false },
          { site: "YouTube", type: "Trailer", key: "xyz", official: true },
          { site: "YouTube", type: "Teaser", key: "tea", official: true },
        ],
      }),
    );
    expect(await getTvTrailerUrl(1)).toBe("https://www.youtube.com/watch?v=xyz");
  });

  it("falls back to first non-official trailer", async () => {
    mockFetchOnce(
      jsonResponse({
        results: [
          { site: "YouTube", type: "Trailer", key: "abc", official: false },
        ],
      }),
    );
    expect(await getTvTrailerUrl(1)).toBe("https://www.youtube.com/watch?v=abc");
  });

  it("returns null when no YouTube trailer exists", async () => {
    mockFetchOnce(
      jsonResponse({
        results: [
          { site: "Vimeo", type: "Trailer", key: "v", official: true },
        ],
      }),
    );
    expect(await getTvTrailerUrl(1)).toBeNull();
  });
});
