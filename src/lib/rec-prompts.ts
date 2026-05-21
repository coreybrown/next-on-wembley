import type { RecScope, WatchStatus, UserRating, VoteValue } from "@prisma/client";
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
Recommend the exact number of candidate TV shows the user prompt requests. The system over-generates intentionally and then validates every pick against TMDb — unresolvable hints get dropped before the final list lands, so always meet the requested count. Output is a JSON object matching the provided schema. No prose, no preamble, no markdown — only the JSON object.

LISTS
- "co_watch" — picks both Corey and Jaimie will enjoy together. Lean toward shared genres + shared subscriptions.
- "corey" / "jaimie" — picks for that user alone. Surface taste-aligned shows the other user may not enjoy as much.

COHERENCE RULES — most important
- Each recommendation's \`tmdbId\`, \`title\`, \`shortExplanation\`, and \`longExplanation\` MUST all describe the SAME show. Never write an explanation for one show and pair it with another show's title or tmdbId. If you are unsure which tmdbId belongs to a show, leave the explanation generic to that show — do not borrow text from a different recommendation.
- Do NOT mention specific streaming platforms (Netflix, Crave, Apple TV+, Disney+, Prime Video, Paramount+) inside your explanations. Availability chips are rendered separately by the system from authoritative provider data. Talk about the show itself: plot, tone, performances, what makes it a fit for this viewer.

CANDIDATE QUALITY
- Shows must be real and findable on TMDb. Return the show's TMDb numeric \`tmdbId\` when you are confident; the system will re-verify every \`tmdbId\` and search by title as a fallback when it doesn't resolve. If the title and tmdbId disagree, the recommendation is dropped.
- Region is Canada. Prefer titles available free-with-subscription on the user's active platforms; the system will hard-exclude unavailable new-show picks for non-continuations.
- Do NOT recommend a show the user has already marked Completed (they have finished it — nothing left to watch), Dropped, Disliked, or Disagreed on in voting history. Treat Meh as "OK to suggest a near-neighbor, not the same show."
- A "continuation" is a show the user already has on their list with status Watching or Paused where they have UNWATCHED AIRED content remaining. Each watch-history entry shows two season markers:
   - \`season=N\` — the season they're on. \`(finished)\` means they completed it.
   - \`aired=Sm\` — the highest season that has AIRED episodes per TMDb.
  Use them together: a show IS a valid continuation when EITHER \`aired=Sm\` > \`season=N\` (a later season has dropped) OR \`season=N\` lacks the \`(finished)\` marker (mid-season). A show is NOT a continuation when \`season=N (finished)\` and \`aired=Sm\` where m equals N — fully caught up; do not include it even if a later season has been announced.
- **Include valid continuations in your output.** Users want to keep going on shows they're actively watching, so when valid continuations exist in their watch history, prioritize them (they often belong near the top of the list). Mark them with \`isContinuation: true\` and set \`tmdbId\` to that exact show's TMDb id.
- A "new pick" is a show NOT already on the user's list. Mark these with \`isContinuation: false\`.
- Mix continuations with new picks in the same list when both apply. Rank by your judgement of fit.

CO-WATCH SPLIT RULE (co_watch scope only)
When the user prompt's "Vote combinations on shared shows" section lists shows where both Corey and Jaimie have voted, apply these treatments to the candidate's RANK in the Co-watch list:
- Agree + Agree → strongly boost. Both want it.
- Agree + Maybe (either order) → boost.
- Maybe + Maybe → neutral.
- Agree + Disagree (split — either order) → **DEMOTE** the rec (do not exclude). The agreer's positive signal still earns a slot, but rank it below unanimous picks.
- Disagree + Maybe (either order) → demote-heavy. Lean negative; usually exclude unless very strong fit.
- Disagree + Disagree → exclude. Neither wants it.
This rule overrides the "don't recommend a show the user has Disagreed on" line above for co_watch only — a single Disagree on a Co-watch candidate demotes rather than excludes, so the partner's Agree still surfaces something for them together.

OUTPUT FIELDS
- \`tmdbId\` — TMDb id you believe is correct. Integer.
- \`title\` — exact title as it appears on TMDb.
- \`year\` — first air year as a string (e.g. "2022"). Empty string if unknown.
- \`shortExplanation\` — ≤ 100 characters, one-sentence reason for this user / pair. About the show itself; do not name platforms.
- \`longExplanation\` — ≤ 300 characters, two- or three-sentence justification referencing their history. About the show itself; do not name platforms.
- \`isContinuation\` — boolean per the rule above.

POSITION
The order of the array IS the ranking. Best fit first.`;

const STATUS_TEXT: Record<WatchStatus, string> = STATUS_LABELS;
const RATING_TEXT: Record<UserRating, string> = RATING_LABELS;
const VOTE_TEXT: Record<VoteValue, string> = {
  agree: "Agree",
  disagree: "Disagree",
  maybe: "Maybe",
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
  // How many raw candidates to ask the LLM for. Set by the action per
  // scope (co-watch asks for more). Defaults to 16 so test fixtures and
  // ad-hoc callers don't have to thread it through.
  candidateCount?: number;
};

const DEFAULT_CANDIDATE_COUNT = 16;

export function buildUserPrompt(input: BuildUserPromptInput): string {
  const {
    scope,
    primary,
    other,
    sharedSubscriptions,
    voteCombinations,
    mood,
    candidateCount = DEFAULT_CANDIDATE_COUNT,
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

  if (mood && mood.trim()) {
    lines.push("");
    lines.push(`Mood: ${mood.trim()}`);
  }

  lines.push("");
  lines.push(
    `Return EXACTLY ${candidateCount} candidate recommendations ranked best fit first. The system trims to a smaller final list after TMDb validation, so always meet this candidate count.`,
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
          tmdbId: { type: "integer" },
          title: { type: "string" },
          year: { type: "string" },
          shortExplanation: { type: "string" },
          longExplanation: { type: "string" },
          isContinuation: { type: "boolean" },
        },
        required: [
          "tmdbId",
          "title",
          "year",
          "shortExplanation",
          "longExplanation",
          "isContinuation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;

export type RawRecommendation = {
  tmdbId: number;
  title: string;
  year: string;
  shortExplanation: string;
  longExplanation: string;
  isContinuation: boolean;
};

export type RecommendationsResponse = {
  recommendations: RawRecommendation[];
};
