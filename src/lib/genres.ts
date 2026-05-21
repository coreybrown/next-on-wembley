// Curated TV genre list for the /recs Refine panel. Genre is a soft
// generation input — picking chips here nudges the LLM's new-show picks
// rather than hard-filtering results. Names track TMDb's TV genre
// vocabulary so they read naturally in the prompt and line up with the
// comma-separated genres TMDb stores on each Show.
export const TV_GENRES = [
  "Drama",
  "Comedy",
  "Crime",
  "Mystery",
  "Sci-Fi & Fantasy",
  "Action & Adventure",
  "Documentary",
  "Animation",
  "Reality",
  "Family",
] as const;

export type TvGenre = (typeof TV_GENRES)[number];
