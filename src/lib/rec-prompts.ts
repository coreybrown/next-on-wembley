import type {
  RecScope,
  RecFocus,
  WatchStatus,
  UserRating,
  VoteValue,
} from "@prisma/client";
import { STATUS_LABELS, RATING_LABELS } from "@/lib/watch-entries";

// One row of watch history we send to the LLM.
export type WatchEntrySummary = {
  tmdbId: number;
  title: string;
  year?: string | null;
  status: WatchStatus;
  currentSeason: number | null;
  currentSeasonCompleted: boolean;
  rating: UserRating | null;
  // Highest season number with aired episodes, per TMDb. Unaired/announced
  // seasons (e.g. Severance S3 before it dropped) are NOT counted — TMDb
  // lists them in `totalSeasons` but they have no episodes, so we exclude
  // them via parseSeasonsJson. 0 when we have no season data.
  airedSeasons: number;
};

// The two continuation categories. A continuation is always one of these;
// `new_show` is reserved for discovery picks.
export type ContinuationCategory = "new_season" | "continue_watching";

// One enumerated continuation candidate handed to the LLM for ranking.
// The app computes the full set from watch state (it is NOT discovered by
// the LLM) — the LLM only orders it by taste and writes explanations.
export type ContinuationCandidate = {
  tmdbId: number;
  title: string;
  year: string | null;
  category: ContinuationCategory;
  // Human-readable season marker, e.g. "Season 2 (finished) · aired S3" —
  // gives the LLM context for the explanation it writes.
  seasonNote: string;
};

export type VoteSummary = {
  title: string;
  vote: VoteValue;
};

export type UserContext = {
  username: string;
  displayName: string;
  subscriptions: string[]; // platform keys
  watchEntries: WatchEntrySummary[];
  recentVotes: VoteSummary[];
};

// Stable across all calls. Keeping this byte-identical is what makes the
// 5-minute prompt cache pay off across the 3 parallel list-gen calls.
// Do NOT interpolate timestamps, request IDs, or user-specific info here —
// per-call counts live in the user prompt instead.
export const REC_SYSTEM_PROMPT = `You are a television recommendation engine for two specific viewers, Corey and Jaimie, who watch together and separately in Canada.

GOAL
Produce TV recommendations in three categories and return a JSON object matching the provided schema. No prose, no preamble, no markdown — only the JSON object. The system over-generates new-show picks intentionally and validates every pick against TMDb — unresolvable hints get dropped before the final list lands.

CATEGORIES
- "new_show" — a show NOT already on the viewer's list. This is discovery: you choose the shows. The user prompt says exactly how many new_show candidates to return.
- "new_season" / "continue_watching" — continuations. You do NOT discover these. The user prompt gives an explicit "Continuations to rank" list, each row pre-tagged with its category. You MUST output every show in that list exactly once, copying its given category and tmdbId verbatim. Your job for these is ranking + writing explanations, nothing else. Never invent a continuation that is not in that list.

LISTS
- "co_watch" — picks both Corey and Jaimie will enjoy together. Lean toward shared genres + shared subscriptions.
- "corey" / "jaimie" — picks for that user alone. Surface taste-aligned shows the other user may not enjoy as much.

COHERENCE RULES — most important
- Each recommendation's \`tmdbId\`, \`title\`, \`shortExplanation\`, and \`longExplanation\` MUST all describe the SAME show. Never write an explanation for one show and pair it with another show's title or tmdbId. If you are unsure which tmdbId belongs to a show, leave the explanation generic to that show — do not borrow text from a different recommendation.
- Do NOT mention specific streaming platforms (Netflix, Crave, Apple TV+, Disney+, Prime Video, Paramount+) inside your explanations. Availability chips are rendered separately by the system from authoritative provider data. Talk about the show itself: plot, tone, performances, what makes it a fit for this viewer.

NEW-SHOW QUALITY
- Shows must be real and findable on TMDb. Return the show's TMDb numeric \`tmdbId\` when you are confident; the system will re-verify every \`tmdbId\` and search by title as a fallback when it doesn't resolve. If the title and tmdbId disagree, the recommendation is dropped.
- Region is Canada. Prefer titles available free-with-subscription on the viewer's active platforms; the system will hard-exclude unavailable new_show picks.
- Do NOT recommend as a new_show any show the viewer has already marked Completed, Dropped, Disliked, Disagreed on, or that already appears in the "Continuations to rank" list. Treat Meh as "OK to suggest a near-neighbour, not the same show."

RANKING CONTINUATIONS
- Rank the continuations by taste, exactly as you would new shows: weigh genre fit, the viewer's ratings, and their watch history. Two continuations are NOT equal — a show in a genre they love and rate highly outranks one they only mildly enjoy.
- Write fresh explanations for each: why this viewer should pick it back up now.

FOCUS
The user prompt may state a focus. It biases EMPHASIS, never inclusion: always return the requested new_show count AND every continuation regardless of focus.
- "discover" — the viewers want fresh new shows; spend extra care on strong, varied new_show picks.
- "new_seasons" — the viewers want to know what got a new season; rank the new_season continuations with particular care.
- "queue" — the viewers want their in-progress queue; rank the continue_watching continuations with particular care.
- "mixed" — no bias; rank everything on pure fit.

CO-WATCH SPLIT RULE (co_watch scope only)
When the user prompt's "Vote combinations on shared shows" section lists shows where both Corey and Jaimie have voted, apply these treatments to the candidate's RANK in the Co-watch list:
- Agree + Agree → strongly boost. Both want it.
- Agree + Maybe (either order) → boost.
- Maybe + Maybe → neutral.
- Agree + Disagree (split — either order) → DEMOTE the rec (do not exclude). The agreer's positive signal still earns a slot, but rank it below unanimous picks.
- Disagree + Maybe (either order) → demote-heavy. Lean negative; usually exclude a new_show unless very strong fit.
- Disagree + Disagree → exclude a new_show. Neither wants it.
This rule overrides the "don't recommend a show the viewer Disagreed on" line for co_watch new_show picks only — a single Disagree demotes rather than excludes. It never removes a continuation: continuations are always included.

OUTPUT FIELDS (per recommendation)
- \`category\` — "new_show", "new_season", or "continue_watching". For continuations, copy the category from the "Continuations to rank" row.
- \`tmdbId\` — TMDb id you believe is correct. Integer. For continuations, copy it from the row verbatim.
- \`title\` — exact title as it appears on TMDb.
- \`year\` — first air year as a string (e.g. "2022"). Empty string if unknown.
- \`shortExplanation\` — ≤ 100 characters, one-sentence reason for this viewer / pair. About the show itself; do not name platforms.
- \`longExplanation\` — ≤ 300 characters, two- or three-sentence justification referencing their history. About the show itself; do not name platforms.

POSITION
Output new_show recommendations first, ranked best fit first, then the continuations ranked best fit first. The array order IS the ranking within each category.`;

const STATUS_TEXT: Record<WatchStatus, string> = STATUS_LABELS;
const RATING_TEXT: Record<UserRating, string> = RATING_LABELS;
const VOTE_TEXT: Record<VoteValue, string> = {
  agree: "Agree",
  disagree: "Disagree",
  maybe: "Maybe",
};

// One-line focus hint appended to the user prompt. `mixed` adds nothing —
// the absence of a focus line is itself the "no bias" signal.
const FOCUS_TEXT: Record<RecFocus, string | null> = {
  mixed: null,
  discover: "discover — prioritise fresh, varied new shows",
  new_seasons: "new_seasons — emphasise shows that have a new season",
  queue: "queue — emphasise the viewer's in-progress shows",
};

function formatEntries(entries: WatchEntrySummary[]): string {
  if (entries.length === 0) return "(none yet)";
  return entries
    .map((e) => {
      const parts: string[] = [`- ${e.title}${e.year ? ` (${e.year})` : ""}`];
      parts.push(`status=${STATUS_TEXT[e.status]}`);
      if (e.currentSeason != null) {
        parts.push(
          `season=${e.currentSeason}${e.currentSeasonCompleted ? " (finished)" : ""}`,
        );
      }
      if (e.airedSeasons > 0) {
        parts.push(`aired=S${e.airedSeasons}`);
      }
      if (e.rating) parts.push(`rating=${RATING_TEXT[e.rating]}`);
      return parts.join(" · ");
    })
    .join("\n");
}

function formatVotes(votes: VoteSummary[]): string {
  if (votes.length === 0) return "(none yet)";
  return votes
    .map((v) => `- ${v.title} → ${VOTE_TEXT[v.vote]}`)
    .join("\n");
}

function formatSubs(subs: string[]): string {
  if (subs.length === 0) return "(none — every show will be unavailable)";
  return subs.join(", ");
}

// Renders the explicit continuation set the LLM must rank. Each row is
// self-describing: category, tmdbId, and a season marker for context.
function formatContinuations(continuations: ContinuationCandidate[]): string {
  if (continuations.length === 0) {
    return "(none — the viewer has no shows with unwatched aired content)";
  }
  return continuations
    .map(
      (c) =>
        `- ${c.title}${c.year ? ` (${c.year})` : ""} · category=${c.category} · tmdbId=${c.tmdbId} · ${c.seasonNote}`,
    )
    .join("\n");
}

// Co-watch only. Each entry represents a show where BOTH household
// members have voted; the prompt lists these so the LLM can apply the
// CO-WATCH SPLIT RULE in the system prompt (Phase 26).
export type VoteCombination = {
  title: string;
  primaryVote: VoteValue;
  otherVote: VoteValue;
};

type BuildUserPromptInput = {
  scope: RecScope;
  primary: UserContext;
  // Provided for co_watch scope so both perspectives are in the prompt.
  other?: UserContext;
  // The intersection of subscriptions (co_watch only).
  sharedSubscriptions?: string[];
  // Co-watch only — shows both users have voted on. Empty/omitted on
  // user-scoped lists.
  voteCombinations?: VoteCombination[];
  mood?: string;
  // Which intent this refresh is biased toward.
  focus: RecFocus;
  // Refine inputs (Phase 44). Soft genre guidance + a hard platform
  // restriction for the new_show picks. Empty/omitted means no constraint.
  genres?: string[];
  platforms?: string[];
  // The full enumerated continuation set the LLM must rank (membership is
  // computed by the app, not discovered by the LLM).
  continuations: ContinuationCandidate[];
  // How many new_show discovery candidates to ask the LLM for.
  newShowCount: number;
};

export function buildUserPrompt(input: BuildUserPromptInput): string {
  const {
    scope,
    primary,
    other,
    sharedSubscriptions,
    voteCombinations,
    mood,
    focus,
    genres,
    platforms,
    continuations,
    newShowCount,
  } = input;
  const lines: string[] = [];

  lines.push(`List: ${scope}`);
  lines.push(`Region: Canada`);
  lines.push("");

  if (scope === "co_watch") {
    if (!other) {
      throw new Error("co_watch scope requires an `other` user context");
    }
    lines.push(
      `Shared active subscriptions (both ${primary.displayName} and ${other.displayName}): ${formatSubs(sharedSubscriptions ?? [])}`,
    );
    lines.push("");
    lines.push(`${primary.displayName}'s active subscriptions: ${formatSubs(primary.subscriptions)}`);
    lines.push(`${other.displayName}'s active subscriptions: ${formatSubs(other.subscriptions)}`);
    lines.push("");
    lines.push(`${primary.displayName}'s watch history:\n${formatEntries(primary.watchEntries)}`);
    lines.push("");
    lines.push(`${other.displayName}'s watch history:\n${formatEntries(other.watchEntries)}`);
    lines.push("");
    lines.push(`${primary.displayName}'s recent votes:\n${formatVotes(primary.recentVotes)}`);
    lines.push("");
    lines.push(`${other.displayName}'s recent votes:\n${formatVotes(other.recentVotes)}`);
    // CO-WATCH SPLIT RULE input (Phase 26). When both households have
    // voted on the same show, list the combination so the LLM applies
    // the rank treatment described in the system prompt.
    if (voteCombinations && voteCombinations.length > 0) {
      lines.push("");
      lines.push("Vote combinations on shared shows:");
      for (const c of voteCombinations) {
        lines.push(
          `- ${c.title}: ${primary.displayName}: ${VOTE_TEXT[c.primaryVote]}, ${other.displayName}: ${VOTE_TEXT[c.otherVote]}`,
        );
      }
    }
  } else {
    lines.push(`${primary.displayName}'s active subscriptions: ${formatSubs(primary.subscriptions)}`);
    lines.push("");
    lines.push(`${primary.displayName}'s watch history:\n${formatEntries(primary.watchEntries)}`);
    lines.push("");
    lines.push(`${primary.displayName}'s recent votes:\n${formatVotes(primary.recentVotes)}`);
  }

  lines.push("");
  lines.push(`Continuations to rank (output EVERY one, category + tmdbId copied verbatim):\n${formatContinuations(continuations)}`);

  if (mood && mood.trim()) {
    lines.push("");
    lines.push(`Mood: ${mood.trim()}`);
  }

  // Refine inputs (Phase 44). Genre is a soft nudge; platform is a hard
  // restriction on the new_show picks. Continuations are unaffected —
  // they're the viewer's existing shows.
  if (genres && genres.length > 0) {
    lines.push("");
    lines.push(
      `Preferred genres: ${genres.join(", ")} — lean the new_show picks toward these, but still rank by overall fit.`,
    );
  }
  if (platforms && platforms.length > 0) {
    lines.push("");
    lines.push(
      `Platform restriction: only recommend new_show picks available on ${platforms.join(", ")}.`,
    );
  }

  const focusText = FOCUS_TEXT[focus];
  if (focusText) {
    lines.push("");
    lines.push(`Focus: ${focusText}`);
  }

  lines.push("");
  lines.push(
    `Return EXACTLY ${newShowCount} new_show candidate recommendations ranked best fit first, PLUS exactly ${continuations.length} continuation recommendation(s) — one for every show in the "Continuations to rank" list. The system trims new_show picks to a smaller final list after TMDb validation, so always meet the new_show count.`,
  );

  return lines.join("\n");
}

// JSON schema for output_config.format. Per the claude-api skill: only basic
// types, every object needs `additionalProperties: false`, no maxLength.
// The model self-constrains length via the prompt instead.
export const RECOMMENDATIONS_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["new_show", "new_season", "continue_watching"],
          },
          tmdbId: { type: "integer" },
          title: { type: "string" },
          year: { type: "string" },
          shortExplanation: { type: "string" },
          longExplanation: { type: "string" },
        },
        required: [
          "category",
          "tmdbId",
          "title",
          "year",
          "shortExplanation",
          "longExplanation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;

export type RawRecommendation = {
  category: "new_show" | "new_season" | "continue_watching";
  tmdbId: number;
  title: string;
  year: string;
  shortExplanation: string;
  longExplanation: string;
};

export type RecommendationsResponse = {
  recommendations: RawRecommendation[];
};
