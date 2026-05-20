import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Lazy client so tests can set ANTHROPIC_API_KEY post-import and so a
// missing key surfaces as a typed error at call time, not module load.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError("ANTHROPIC_API_KEY is not configured");
  }
  // 55s per-request cap — a hung call fails fast instead of holding the
  // serverless function open to its platform limit. The client-side
  // refresh flow gives up at 60s, so this surfaces first.
  client = new Anthropic({ apiKey, timeout: 55_000 });
  return client;
}

// Test-only hook: lets tests reset the cached client when they mutate env.
export function _resetAnthropicClientForTests(): void {
  client = null;
}

export class AnthropicError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AnthropicError";
    this.status = status;
  }
}
export class AnthropicAuthError extends AnthropicError {
  constructor(message = "Anthropic authentication failed — check ANTHROPIC_API_KEY") {
    super(message, 401);
    this.name = "AnthropicAuthError";
  }
}
export class AnthropicRateLimitError extends AnthropicError {
  constructor(message = "Anthropic rate limit hit — back off and retry") {
    super(message, 429);
    this.name = "AnthropicRateLimitError";
  }
}
export class AnthropicTransientError extends AnthropicError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = "AnthropicTransientError";
  }
}

export type StructuredCallInput = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  // Raw JSON schema (object). Used for output_config.format = json_schema.
  outputSchema: Record<string, unknown>;
  maxTokens?: number;
  // Lower = more deterministic. Defaults to 0.4 — recommendations need
  // some variety across refreshes but the worse Haiku failure mode is
  // mixing-up explanations between shows in the same response (a
  // coherence problem that lower temperature reins in).
  temperature?: number;
  signal?: AbortSignal;
};

export type AnthropicUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type StructuredCallResult<T> = {
  data: T;
  usage: AnthropicUsage;
};

// One round-trip to Claude that returns parsed JSON matching outputSchema.
// System prompt is cached (`cache_control: ephemeral`) so the stable prelude
// doesn't get re-billed at full rate across the 3 parallel list-gen calls.
// One retry on transient (5xx) errors; auth and rate-limit errors propagate.
// Returns the parsed payload + the token usage so the caller can log
// spend against the PRD §10 monthly cap.
export async function generateStructured<T>(
  input: StructuredCallInput,
): Promise<StructuredCallResult<T>> {
  const c = getClient();
  const callOnce = () =>
    c.messages.create(
      {
        model: input.model,
        max_tokens: input.maxTokens ?? 4096,
        temperature: input.temperature ?? 0.4,
        system: [
          {
            type: "text",
            text: input.systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: input.userPrompt }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output_config: { format: { type: "json_schema", schema: input.outputSchema as any } } as any,
      },
      input.signal ? { signal: input.signal } : undefined,
    );

  let response: Awaited<ReturnType<typeof callOnce>>;
  try {
    response = await callOnce();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AnthropicAuthError();
    if (err instanceof Anthropic.RateLimitError) throw new AnthropicRateLimitError();
    if (err instanceof Anthropic.APIError && err.status >= 500) {
      // Single silent retry on transient server-side failures.
      try {
        response = await callOnce();
      } catch (retryErr) {
        if (retryErr instanceof Anthropic.APIError) {
          throw new AnthropicTransientError(
            `Anthropic ${retryErr.status} after retry: ${retryErr.message}`,
            retryErr.status,
          );
        }
        throw retryErr;
      }
    } else if (err instanceof Anthropic.APIError) {
      throw new AnthropicError(
        `Anthropic API error (${err.status}): ${err.message}`,
        err.status,
      );
    } else {
      throw err;
    }
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AnthropicError("Response contained no text block");
  }
  let parsed: T;
  try {
    parsed = JSON.parse(textBlock.text) as T;
  } catch {
    throw new AnthropicError(
      "Anthropic response was not valid JSON despite output_config.format",
    );
  }
  // Roll cache-creation / cache-read input into the total; the cost
  // helper applies per-tier rates if a finer breakdown is needed later.
  // The SDK currently surfaces them on `usage` but we sum at the call
  // boundary to keep the caller's logging shape simple.
  const u = response.usage;
  const cacheCreation =
    (u as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
  const cacheRead =
    (u as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;
  return {
    data: parsed,
    usage: {
      inputTokens: u.input_tokens + cacheCreation + cacheRead,
      outputTokens: u.output_tokens,
    },
  };
}
