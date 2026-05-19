import type { RecModel } from "@prisma/client";

export const REC_MODELS = ["haiku", "sonnet"] as const satisfies readonly RecModel[];

export const REC_MODEL_LABELS: Record<RecModel, string> = {
  haiku: "Haiku 4.5",
  sonnet: "Sonnet 4.6",
};

export const REC_MODEL_BLURBS: Record<RecModel, string> = {
  haiku: "Faster and cheaper. Default. Solid for the household-scale workload.",
  sonnet: "Deeper reasoning over nuanced taste history. ~3× the cost per refresh.",
};

// Map our short keys to the exact Anthropic model IDs. Updating these is the
// single point where a model version bump happens — every consumer reads
// through this map.
export const REC_MODEL_TO_API_ID: Record<RecModel, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
};

// Rough per-refresh cost estimates surfaced in the model-swap confirmation
// dialog. Calculated from current per-token list pricing (Haiku $1/$5,
// Sonnet $3/$15 per MTok) × ~1.5K input + 2K output × 3 parallel lists.
// Not load-bearing; update if pricing or rec list size shifts.
export const REC_MODEL_REFRESH_COST: Record<RecModel, string> = {
  haiku: "~$0.04",
  sonnet: "~$0.12",
};

export function isValidRecModel(v: string): v is RecModel {
  return (REC_MODELS as readonly string[]).includes(v);
}
