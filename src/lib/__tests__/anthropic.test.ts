import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Captured by the constructor; tests set behavior via mockCreate.
const mockCreate = vi.fn();

class AuthErr extends Error {
  status = 401;
}
class RateErr extends Error {
  status = 429;
}
class APIErr extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

class MockAnthropic {
  messages = { create: mockCreate };
  constructor(_opts: { apiKey: string }) {
    // pulled in via SDK construction; we don't care about opts in tests
  }
  static AuthenticationError = AuthErr;
  static RateLimitError = RateErr;
  static APIError = APIErr;
}

vi.mock("@anthropic-ai/sdk", () => ({ default: MockAnthropic }));

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  mockCreate.mockReset();
});

afterAll(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

const {
  generateStructured,
  AnthropicAuthError,
  AnthropicRateLimitError,
  AnthropicTransientError,
  AnthropicError,
  _resetAnthropicClientForTests,
} = await import("@/lib/anthropic");

beforeEach(() => {
  _resetAnthropicClientForTests();
});

const okResponse = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload) }],
});

const schema = {
  type: "object",
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
  additionalProperties: false,
};

describe("generateStructured", () => {
  it("invokes the SDK with the expected request shape", async () => {
    mockCreate.mockResolvedValueOnce(okResponse({ ok: true }));
    const out = await generateStructured<{ ok: boolean }>({
      model: "claude-haiku-4-5",
      systemPrompt: "you are a recommender",
      userPrompt: "give me 10 shows",
      outputSchema: schema,
    });
    expect(out).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0]![0];
    expect(call.model).toBe("claude-haiku-4-5");
    expect(call.system).toEqual([
      {
        type: "text",
        text: "you are a recommender",
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(call.messages).toEqual([
      { role: "user", content: "give me 10 shows" },
    ]);
    expect(call.output_config.format.type).toBe("json_schema");
    expect(call.output_config.format.schema).toBe(schema);
  });

  it("throws AnthropicAuthError on AuthenticationError", async () => {
    mockCreate.mockRejectedValueOnce(new AuthErr("invalid"));
    await expect(
      generateStructured({
        model: "claude-haiku-4-5",
        systemPrompt: "s",
        userPrompt: "u",
        outputSchema: schema,
      }),
    ).rejects.toBeInstanceOf(AnthropicAuthError);
  });

  it("throws AnthropicRateLimitError on RateLimitError", async () => {
    mockCreate.mockRejectedValueOnce(new RateErr("slow down"));
    await expect(
      generateStructured({
        model: "claude-haiku-4-5",
        systemPrompt: "s",
        userPrompt: "u",
        outputSchema: schema,
      }),
    ).rejects.toBeInstanceOf(AnthropicRateLimitError);
  });

  it("retries once on 5xx then succeeds", async () => {
    mockCreate.mockRejectedValueOnce(new APIErr("upstream", 502));
    mockCreate.mockResolvedValueOnce(okResponse({ ok: true }));
    const out = await generateStructured<{ ok: boolean }>({
      model: "claude-haiku-4-5",
      systemPrompt: "s",
      userPrompt: "u",
      outputSchema: schema,
    });
    expect(out).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws AnthropicTransientError after retry exhaustion on 5xx", async () => {
    mockCreate.mockRejectedValueOnce(new APIErr("upstream", 502));
    mockCreate.mockRejectedValueOnce(new APIErr("upstream", 503));
    await expect(
      generateStructured({
        model: "claude-haiku-4-5",
        systemPrompt: "s",
        userPrompt: "u",
        outputSchema: schema,
      }),
    ).rejects.toBeInstanceOf(AnthropicTransientError);
  });

  it("throws AnthropicError when no API key is configured", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    _resetAnthropicClientForTests();
    await expect(
      generateStructured({
        model: "claude-haiku-4-5",
        systemPrompt: "s",
        userPrompt: "u",
        outputSchema: schema,
      }),
    ).rejects.toBeInstanceOf(AnthropicError);
    process.env.ANTHROPIC_API_KEY = prev;
  });

  it("throws AnthropicError when response has no text block", async () => {
    mockCreate.mockResolvedValueOnce({ content: [] });
    await expect(
      generateStructured({
        model: "claude-haiku-4-5",
        systemPrompt: "s",
        userPrompt: "u",
        outputSchema: schema,
      }),
    ).rejects.toThrow(/no text block/i);
  });

  it("throws AnthropicError when text block isn't JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not actually json" }],
    });
    await expect(
      generateStructured({
        model: "claude-haiku-4-5",
        systemPrompt: "s",
        userPrompt: "u",
        outputSchema: schema,
      }),
    ).rejects.toThrow(/not valid json/i);
  });
});
