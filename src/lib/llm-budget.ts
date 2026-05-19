import "server-only";
import { prisma } from "@/lib/db";

// Per PRD §10: monthly cap $15 with a 75% warning. Hardcoded for now
// since the household scale doesn't justify a runtime knob; the constant
// lives here so future tuning is one-line.
export const MONTHLY_BUDGET_USD = 15;
export const WARNING_FRACTION = 0.75;

// Per-MTok list prices for the two models we run. Updating these is a
// single-edit drop-in for new model pricing tiers.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};

// Computes USD cost for a single call. Cache reads and cache creation
// are folded into inputTokens upstream (see lib/anthropic.ts) so this
// slightly overestimates real spend — safer for a budget guard.
export function computeCallCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = PRICING_PER_MTOK[modelId];
  if (!rate) {
    // Unknown model — assume Sonnet pricing as a conservative upper
    // bound so an unrecognized id doesn't accidentally bypass the cap.
    const fallback = PRICING_PER_MTOK["claude-sonnet-4-6"]!;
    return (
      (inputTokens * fallback.input + outputTokens * fallback.output) /
      1_000_000
    );
  }
  return (
    (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000
  );
}

// Sums all logged costs since the start of the current calendar month
// (UTC). Cheap query — index on createdAt — but call sparingly.
export async function getCurrentMonthSpendUsd(): Promise<number> {
  const start = startOfCurrentMonthUtc();
  const result = await prisma.llmCallLog.aggregate({
    where: { createdAt: { gte: start } },
    _sum: { costUsd: true },
  });
  return result._sum.costUsd ?? 0;
}

export type BudgetStatus = {
  spentUsd: number;
  capUsd: number;
  warningFraction: number;
  // "ok" → fresh refresh is fine.
  // "warning" → at or past 75%, surface a yellow note.
  // "exceeded" → at or past 100%, action blocks new spend.
  state: "ok" | "warning" | "exceeded";
};

export async function getBudgetStatus(): Promise<BudgetStatus> {
  const spentUsd = await getCurrentMonthSpendUsd();
  const ratio = spentUsd / MONTHLY_BUDGET_USD;
  let state: BudgetStatus["state"] = "ok";
  if (ratio >= 1) state = "exceeded";
  else if (ratio >= WARNING_FRACTION) state = "warning";
  return {
    spentUsd,
    capUsd: MONTHLY_BUDGET_USD,
    warningFraction: WARNING_FRACTION,
    state,
  };
}

// Logs a successful Anthropic call. Caller computes the cost via
// computeCallCostUsd so the math is in one place.
export async function logLlmCall(args: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const costUsd = computeCallCostUsd(
    args.modelId,
    args.inputTokens,
    args.outputTokens,
  );
  await prisma.llmCallLog.create({
    data: {
      modelId: args.modelId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costUsd,
    },
  });
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
