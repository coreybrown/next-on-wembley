"use server";

import { getSession } from "@/lib/session";
import { searchTv, type TmdbSearchResult } from "@/lib/tmdb";

export type SearchShowsResult =
  | { ok: true; results: TmdbSearchResult[] }
  | { ok: false; error: "unauthorized" | "unavailable" };

export async function searchShows(query: string): Promise<SearchShowsResult> {
  const session = await getSession();
  if (!session.userId) {
    return { ok: false, error: "unauthorized" };
  }
  try {
    const results = await searchTv(query);
    return { ok: true, results };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
