import type { RecScope, WatchStatus, UserRating, VoteValue } from "@prisma/client";
import { STATUS_LABELS, RATING_LABELS } from "@/lib/watch-entries";

// One row of watch history we send to the LLM.
export type WatchEntrySummary = {
  title: string;
  year?: string | null;
  status: WatchStatus;
  currentSeason: number | null;
  currentSeasonCompleted: boolean;
  rating: UserRating | null;
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
// Do NOT interpolate timestamps, request IDs, or user-specific info here.
export const REC_SYSTEM_PROMPT = `You are a television recommendation engine for two specific viewers, Corey and Jaimie, who watch together and separately in Canada.

GOAL
Recommend EXACTLY 10 TV shows for the requested list. Output is a JSON object matching the provided schema. No prose, no preamble, no markdown — only the JSON object.

LISTS
- "co_watch" — picks both Corey and Jaimie will enjoy together. Lean toward shared genres + shared subscriptions.
- "corey" / "jaimie" — picks for that user alone. Surface taste-aligned shows the other user may not enjoy as much.

CONSTRAINTS
- Shows must be real and findable on TMDb. Return the show's TMDb numeric \`tmdbId\` when you are confident; the system will re-verify every \`tmdbId\` and search by title as a fallback when it doesn't resolve.
- Region is Canada. Prefer titles streaming free-with-subscription on the user's active platforms; only break this rule if you are confident the show is exceptional and worth flagging as currently-unavailable. The system will hard-exclude unavailable new-show picks for non-continuations.
- Do NOT recommend a show the user has marked Dropped, Disliked, or Disagreed on in voting history. Treat Meh as "OK to suggest a near-neighbor, not the same show."
- A "continuation" is a show the user already has on their list with status Watching or Paused, where new aired episodes/seasons exist beyond their currentSeason. Mark these with \`isContinuation: true\` and set \`tmdbId\` to that exact show's TMDb id.
- A "new pick" is a show NOT already on the user's list. Mark these with \`isContinuation: false\`.
- Mix continuations with new picks in the same list when both apply. Rank by your judgement of fit.

OUTPUT FIELDS
- \`tmdbId\` — TMDb id you believe is correct. Integer.
- \`title\` — exact title as it appears on TMDb.
- \`year\` — first air year as a string (e.g. "2022"). Empty string if unknown.
- \`shortExplanation\` — ≤ 100 characters, one-sentence reason for this user / pair.
- \`longExplanation\` — ≤ 300 characters, two- or three-sentence justification referencing their history.
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

type BuildUserPromptInput = {
  scope: RecScope;
  primary: UserContext;
  // Provided for co_watch scope so both perspectives are in the prompt.
  other?: UserContext;
  // The intersection of subscriptions (co_watch only).
  sharedSubscriptions?: string[];
  mood?: string;
};

export function buildUserPrompt(input: BuildUserPromptInput): string {
  const { scope, primary, other, sharedSubscriptions, mood } = input;
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
  lines.push("Return EXACTLY 10 recommendations ranked best fit first.");

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
