import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicProvider } from "./anthropic";
import { readProviderConfig } from "./config";
import { LlmRefusalError, LlmRequestError, LlmResponseError, type ObjectRequest, type TextRequest } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `AnthropicProvider` with a recording `fetch` handed to the SDK:
// which models get server-side fallbacks and low effort, and how refusals,
// unusable answers and HTTP errors reach the caller. Nothing leaves the process.

/** One request as the SDK handed it to `fetch`. */
interface SentRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: Record<string, unknown>;
}

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const TEXT_REQUEST: TextRequest = { tier: "default", prompt: "Write a welcome text for Rosa's Bakery.", maxTokens: 500 };

const profileSchema = z.object({ trade: z.string(), tasks: z.array(z.string()) });
const OBJECT_REQUEST: ObjectRequest<z.infer<typeof profileSchema>> = {
  tier: "default",
  prompt: "Describe Rosa's Bakery.",
  maxTokens: 800,
  schema: profileSchema,
  schemaName: "profile_text",
};
const PROFILE = { trade: "bakery", tasks: ["orders", "reviews"] };

/** A Messages API reply carrying `content` and `stopReason`. */
function claudeMessage(content: readonly Record<string, unknown>[], stopReason = "end_turn"): Response {
  return Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 12, output_tokens: 34 },
  });
}

/** A `fetch` stand-in that records every request and answers each with `reply()`. */
function recordingFetch(reply: () => Response) {
  const sent: SentRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    sent.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return reply();
  };
  return { fetchImpl, sent };
}

/** Build Claude from an environment, wired to `fetchImpl`. */
function claudeFor(env: Record<string, string>, fetchImpl: typeof fetch): AnthropicProvider {
  const config = readProviderConfig({ AI_PROVIDER: "anthropic", AI_API_KEY: "test-anthropic-key", ...env });
  if (!config) throw new Error("test environment selects no provider");
  return new AnthropicProvider(config, fetchImpl);
}

/** Return what `promise` rejects with, so a test can check its type and fields. */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the call to fail");
    },
    (error: unknown) => error,
  );
}

/** Send one text request at `tier` and return what reached `fetch`. */
async function sentForTier(tier: TextRequest["tier"], env: Record<string, string> = {}): Promise<SentRequest | undefined> {
  const { fetchImpl, sent } = recordingFetch(() => claudeMessage([{ type: "text", text: "Welcome!" }]));
  await claudeFor(env, fetchImpl).generateText({ ...TEXT_REQUEST, tier });
  return sent[0];
}

// =============================================================================
// Requests
// =============================================================================

describe("AnthropicProvider requests", () => {
  it("sends the Messages API request with the key, model and token cap", async () => {
    const request = await sentForTier("default");
    expect(request?.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/);
    // The SDK picks the auth header (`Authorization` in 1.x, `x-api-key` before); either way the configured key goes out.
    expect(request?.headers.get("authorization") ?? request?.headers.get("x-api-key")).toContain("test-anthropic-key");
    expect(request?.body).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 500, messages: [{ role: "user", content: TEXT_REQUEST.prompt }] });
  });

  it.each([
    { tier: "default", model: "claude-sonnet-5-5" },
    { tier: "complex", model: "claude-opus-5-5" },
  ] as const)("opts $model into server-side fallbacks", async ({ tier, model }) => {
    const request = await sentForTier(tier);
    expect(request?.body.model).toBe(model);
    expect(request?.headers.get("anthropic-beta")?.split(",")).toContain(FALLBACK_BETA);
    expect(request?.body.fallbacks).toBe("default");
  });

  it("sends no fallbacks for Haiku 5.5, which has none", async () => {
    const request = await sentForTier("quick");
    expect(request?.body.model).toBe("claude-haiku-5-5");
    expect(request?.headers.get("anthropic-beta") ?? "").not.toContain(FALLBACK_BETA);
    expect(request?.body).not.toHaveProperty("fallbacks");
  });

  it.each(["quick", "default", "complex"] as const)("asks the %s tier's 5.5 model for low effort", async (tier) => {
    const request = await sentForTier(tier);
    expect(request?.body.output_config).toEqual({ effort: "low" });
  });

  it("sends neither effort nor fallbacks for a model outside the 5.5 family", async () => {
    const request = await sentForTier("quick", { AI_MODEL_QUICK: "claude-haiku-4-5" });
    expect(request?.body.model).toBe("claude-haiku-4-5");
    expect(request?.body).not.toHaveProperty("output_config");
    expect(request?.body).not.toHaveProperty("fallbacks");
    expect(request?.headers.get("anthropic-beta") ?? "").not.toContain(FALLBACK_BETA);
  });

  it("asks for structured output with the schema, alongside effort and fallbacks", async () => {
    const { fetchImpl, sent } = recordingFetch(() => claudeMessage([{ type: "text", text: JSON.stringify(PROFILE) }]));
    await claudeFor({}, fetchImpl).generateObject(OBJECT_REQUEST);

    const body = sent[0]?.body;
    expect(body).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 800, fallbacks: "default" });
    expect(body?.output_config).toMatchObject({
      effort: "low",
      format: { type: "json_schema", schema: { type: "object", properties: { trade: { type: "string" } } } },
    });
  });
});

// =============================================================================
// Replies and failures
// =============================================================================

describe("AnthropicProvider replies", () => {
  it("returns the text blocks' text and skips thinking blocks", async () => {
    const { fetchImpl } = recordingFetch(() =>
      claudeMessage([
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: "Welcome to Rosa's!" },
      ]),
    );
    expect(await claudeFor({}, fetchImpl).generateText(TEXT_REQUEST)).toBe("Welcome to Rosa's!");
  });

  it("returns a typed object from a valid structured reply", async () => {
    const { fetchImpl } = recordingFetch(() => claudeMessage([{ type: "text", text: JSON.stringify(PROFILE) }]));
    expect(await claudeFor({}, fetchImpl).generateObject(OBJECT_REQUEST)).toEqual(PROFILE);
  });

  it("raises `LlmRefusalError` on a `refusal` stop reason for text", async () => {
    const { fetchImpl } = recordingFetch(() => claudeMessage([], "refusal"));
    expect(await rejectionOf(claudeFor({}, fetchImpl).generateText(TEXT_REQUEST))).toBeInstanceOf(LlmRefusalError);
  });

  it("raises `LlmRefusalError` on a `refusal` stop reason for an object, before any output", async () => {
    const { fetchImpl } = recordingFetch(() => claudeMessage([], "refusal"));
    expect(await rejectionOf(claudeFor({}, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmRefusalError);
  });

  it("raises `LlmRefusalError` when Claude declines an object partway through its answer", async () => {
    const { fetchImpl } = recordingFetch(() => claudeMessage([{ type: "text", text: '{"trade": "bak' }], "refusal"));
    expect(await rejectionOf(claudeFor({}, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmRefusalError);
  });

  it("raises `LlmResponseError` when the answer does not match the schema", async () => {
    const { fetchImpl } = recordingFetch(() => claudeMessage([{ type: "text", text: JSON.stringify({ trade: "bakery", tasks: "orders" }) }]));
    expect(await rejectionOf(claudeFor({}, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmResponseError);
  });

  it("raises `LlmResponseError` when the answer is cut off at `max_tokens`", async () => {
    const { fetchImpl } = recordingFetch(() => claudeMessage([{ type: "text", text: '{"trade": "bakery", "tas' }], "max_tokens"));
    expect(await rejectionOf(claudeFor({}, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmResponseError);
  });

  it("raises `LlmResponseError` when the reply has no text", async () => {
    const { fetchImpl } = recordingFetch(() => claudeMessage([]));
    expect(await rejectionOf(claudeFor({}, fetchImpl).generateText(TEXT_REQUEST))).toBeInstanceOf(LlmResponseError);
  });

  it("raises `LlmRequestError` with the HTTP status when the API rejects the request", async () => {
    const { fetchImpl, sent } = recordingFetch(() =>
      Response.json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, { status: 401 }),
    );
    const error = await rejectionOf(claudeFor({}, fetchImpl).generateText(TEXT_REQUEST));
    expect(error).toBeInstanceOf(LlmRequestError);
    expect(error).toMatchObject({ status: 401 });
    // A 401 is not retried, so the SDK made exactly one call.
    expect(sent).toHaveLength(1);
  });
});
