import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const mockPrisma = mockDeep<PrismaClient>();
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const {
  computeCallCostUsd,
  getCurrentMonthSpendUsd,
  getBudgetStatus,
  logLlmCall,
  MONTHLY_BUDGET_USD,
} = await import("@/lib/llm-budget");

beforeEach(() => {
  mockPrisma.llmCallLog.aggregate.mockReset();
  mockPrisma.llmCallLog.create.mockReset();
});

describe("computeCallCostUsd", () => {
  it("computes Haiku cost at $1 input / $5 output per MTok", () => {
    const cost = computeCallCostUsd("claude-haiku-4-5", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(6, 4); // $1 + $5
  });

  it("computes Sonnet cost at $3 input / $15 output per MTok", () => {
    const cost = computeCallCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 4);
  });

  it("uses Sonnet pricing as a conservative fallback for unknown models", () => {
    const cost = computeCallCostUsd("claude-mystery-9-9", 1_000_000, 0);
    expect(cost).toBeCloseTo(3, 4);
  });

  it("scales linearly under MTok", () => {
    // 1500 input + 2000 output tokens on Haiku ≈ $1500/M + $10000/M = $0.0115
    const cost = computeCallCostUsd("claude-haiku-4-5", 1500, 2000);
    expect(cost).toBeCloseTo(0.0115, 5);
  });
});

describe("getCurrentMonthSpendUsd", () => {
  it("aggregates costUsd since the start of the current UTC month", async () => {
    mockPrisma.llmCallLog.aggregate.mockResolvedValueOnce({
      _sum: { costUsd: 4.2 },
    } as never);
    expect(await getCurrentMonthSpendUsd()).toBeCloseTo(4.2);
    const args = mockPrisma.llmCallLog.aggregate.mock.calls[0]![0];
    expect(args.where?.createdAt).toMatchObject({ gte: expect.any(Date) });
  });

  it("returns 0 when no rows exist this month", async () => {
    mockPrisma.llmCallLog.aggregate.mockResolvedValueOnce({
      _sum: { costUsd: null },
    } as never);
    expect(await getCurrentMonthSpendUsd()).toBe(0);
  });
});

describe("getBudgetStatus", () => {
  it("returns ok below the warning fraction", async () => {
    mockPrisma.llmCallLog.aggregate.mockResolvedValueOnce({
      _sum: { costUsd: 1.0 },
    } as never);
    const status = await getBudgetStatus();
    expect(status.state).toBe("ok");
    expect(status.capUsd).toBe(MONTHLY_BUDGET_USD);
  });

  it("returns warning between 75% and 100%", async () => {
    mockPrisma.llmCallLog.aggregate.mockResolvedValueOnce({
      _sum: { costUsd: 12 }, // 80%
    } as never);
    const status = await getBudgetStatus();
    expect(status.state).toBe("warning");
  });

  it("returns exceeded at 100% or above", async () => {
    mockPrisma.llmCallLog.aggregate.mockResolvedValueOnce({
      _sum: { costUsd: 15.01 },
    } as never);
    const status = await getBudgetStatus();
    expect(status.state).toBe("exceeded");
  });
});

describe("logLlmCall", () => {
  it("computes cost and writes a row with the correct fields", async () => {
    mockPrisma.llmCallLog.create.mockResolvedValueOnce({} as never);
    await logLlmCall({
      modelId: "claude-haiku-4-5",
      inputTokens: 1500,
      outputTokens: 2000,
    });
    expect(mockPrisma.llmCallLog.create).toHaveBeenCalledWith({
      data: {
        modelId: "claude-haiku-4-5",
        inputTokens: 1500,
        outputTokens: 2000,
        costUsd: expect.closeTo(0.0115, 5),
      },
    });
  });
});
