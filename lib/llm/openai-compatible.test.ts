import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readProviderConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { LlmRefusalError, LlmRequestError, LlmResponseError, type ObjectRequest, type TextRequest } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `OpenAICompatibleProvider` against a recording `fetch` stand-in:
// the request each provider's dialect sends, and how each kind of reply or
// failure reaches the caller. No test touches the network or needs a real key.

/** One request as the provider handed it to `fetch`. */
interface SentRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: Record<string, unknown>;
}

const TEXT_REQUEST: TextRequest = { tier: "default", prompt: "Write a welcome text for Rosa's Bakery.", maxTokens: 500 };

const profileSchema = z.object({ trade: z.string(), tasks: z.array(z.string()) });
const OBJECT_REQUEST: ObjectRequest<z.infer<typeof profileSchema>> = {
  tier: "complex",
  prompt: "Describe Rosa's Bakery.",
  maxTokens: 800,
  schema: profileSchema,
  schemaName: "profile_text",
};
const PROFILE = { trade: "bakery", tasks: ["orders", "reviews"] };
// What strict mode receives for `profileSchema`: closed, every property required, no `$schema`.
const STRICT_PROFILE_SCHEMA = {
  type: "object",
  properties: { trade: { type: "string" }, tasks: { type: "array", items: { type: "string" } } },
  required: ["trade", "tasks"],
  additionalProperties: false,
};

/** A chat completions reply with one choice. */
function completion(message: { content?: string | null; refusal?: string | null }, finishReason = "stop"): Response {
  return Response.json({ id: "chatcmpl-test", object: "chat.completion", choices: [{ index: 0, finish_reason: finishReason, message: { role: "assistant", ...message } }] });
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

/** Build the provider an environment selects, wired to `fetchImpl`. */
function providerFor(env: Record<string, string>, fetchImpl: typeof fetch): OpenAICompatibleProvider {
  const config = readProviderConfig(env);
  if (!config) throw new Error("test environment selects no provider");
  return new OpenAICompatibleProvider(config, fetchImpl);
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

const MODELS = { AI_MODEL_QUICK: "quick-model", AI_MODEL_DEFAULT: "default-model", AI_MODEL_COMPLEX: "complex-model" };
const OPENAI = { AI_PROVIDER: "openai", AI_API_KEY: "test-openai-key", ...MODELS };
const OPENROUTER = { AI_PROVIDER: "openrouter", AI_API_KEY: "test-openrouter-key", ...MODELS };
const FEATHERLESS = { AI_PROVIDER: "featherless", AI_API_KEY: "test-featherless-key", ...MODELS };
const CUSTOM = { AI_PROVIDER: "openai-compatible", AI_API_KEY: "test-custom-key", AI_BASE_URL: "https://models.example.com/v1", ...MODELS };

// =============================================================================
// Requests each dialect sends
// =============================================================================

describe("OpenAICompatibleProvider requests", () => {
  it("asks Featherless models not to think, on text and on JSON requests", async () => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: JSON.stringify(PROFILE) }));
    const provider = providerFor(FEATHERLESS, fetchImpl);
    await provider.generateText(TEXT_REQUEST);
    await provider.generateObject(OBJECT_REQUEST);

    expect(sent).toHaveLength(2);
    for (const request of sent) expect(request.body).toMatchObject({ chat_template_kwargs: { enable_thinking: false } });
  });

  it.each([
    { provider: "openai", env: OPENAI },
    { provider: "openrouter", env: OPENROUTER },
    { provider: "openai-compatible", env: CUSTOM },
  ])("sends no thinking switch to $provider", async ({ env }) => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: "Welcome!" }));
    await providerFor(env, fetchImpl).generateText(TEXT_REQUEST);
    expect(sent[0]?.body).not.toHaveProperty("chat_template_kwargs");
  });

  it.each([
    { provider: "openai", env: OPENAI, url: "https://api.openai.com/v1/chat/completions", key: "test-openai-key", tokenParam: "max_completion_tokens" },
    { provider: "openrouter", env: OPENROUTER, url: "https://openrouter.ai/api/v1/chat/completions", key: "test-openrouter-key", tokenParam: "max_tokens" },
    { provider: "featherless", env: FEATHERLESS, url: "https://api.featherless.ai/v1/chat/completions", key: "test-featherless-key", tokenParam: "max_completion_tokens" },
    { provider: "openai-compatible", env: CUSTOM, url: "https://models.example.com/v1/chat/completions", key: "test-custom-key", tokenParam: "max_tokens" },
  ])("sends $provider text requests to its endpoint with its key and `$tokenParam`", async ({ env, url, key, tokenParam }) => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: "Welcome!" }));
    await providerFor(env, fetchImpl).generateText(TEXT_REQUEST);

    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.url).toBe(url);
    expect(request?.headers.get("Authorization")).toBe(`Bearer ${key}`);
    expect(request?.headers.get("Content-Type")).toBe("application/json");
    const otherTokenParam = tokenParam === "max_tokens" ? "max_completion_tokens" : "max_tokens";
    expect(request?.body).toMatchObject({ model: "default-model", messages: [{ role: "user", content: TEXT_REQUEST.prompt }], [tokenParam]: 500 });
    expect(request?.body).not.toHaveProperty(otherTokenParam);
  });

  it.each([
    { provider: "openrouter", env: OPENROUTER, header: "X-OpenRouter-Title" },
    { provider: "featherless", env: FEATHERLESS, header: "X-Title" },
  ])("names the app to $provider in `$header`", async ({ env, header }) => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: "Welcome!" }));
    await providerFor(env, fetchImpl).generateText(TEXT_REQUEST);
    expect(sent[0]?.headers.get(header)).toBe("Anchored");
  });

  it.each([
    { provider: "openai", env: OPENAI },
    { provider: "openai-compatible", env: CUSTOM },
  ])("sends $provider no attribution headers", async ({ env }) => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: "Welcome!" }));
    await providerFor(env, fetchImpl).generateText(TEXT_REQUEST);
    const headers = sent[0]?.headers;
    expect(headers?.has("X-Title")).toBe(false);
    expect(headers?.has("X-OpenRouter-Title")).toBe(false);
    expect(headers?.has("HTTP-Referer")).toBe(false);
  });

  it("sends `HTTP-Referer` when `APP_URL` is set", async () => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: "Welcome!" }));
    await providerFor({ ...OPENROUTER, APP_URL: "https://anchored.example.com" }, fetchImpl).generateText(TEXT_REQUEST);
    expect(sent[0]?.headers.get("HTTP-Referer")).toBe("https://anchored.example.com");
  });

  it("asks OpenAI for structured output with a strict `json_schema` and leaves the prompt alone", async () => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: JSON.stringify(PROFILE) }));
    await providerFor(OPENAI, fetchImpl).generateObject(OBJECT_REQUEST);

    expect(sent[0]?.body).toEqual({
      model: "complex-model",
      messages: [{ role: "user", content: OBJECT_REQUEST.prompt }],
      max_completion_tokens: 800,
      response_format: { type: "json_schema", json_schema: { name: "profile_text", strict: true, schema: STRICT_PROFILE_SCHEMA } },
    });
  });

  it("asks OpenRouter for `json_schema` and to route only to endpoints that honor it", async () => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: JSON.stringify(PROFILE) }));
    await providerFor(OPENROUTER, fetchImpl).generateObject(OBJECT_REQUEST);

    expect(sent[0]?.body).toMatchObject({
      response_format: { type: "json_schema", json_schema: { name: "profile_text", strict: true, schema: STRICT_PROFILE_SCHEMA } },
      provider: { data_collection: "deny", require_parameters: true },
    });
  });

  it("tells OpenRouter not to keep prompts on every request, and adds its routing rule only for structured ones", async () => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: "Welcome!" }));
    await providerFor(OPENROUTER, fetchImpl).generateText(TEXT_REQUEST);
    expect(sent[0]?.body).toMatchObject({ provider: { data_collection: "deny" } });
    expect(sent[0]?.body).not.toHaveProperty("provider.require_parameters");
    expect(sent[0]?.body).not.toHaveProperty("response_format");
  });

  it.each([
    { provider: "featherless", env: FEATHERLESS },
    { provider: "openai-compatible", env: CUSTOM },
  ])("asks $provider for JSON in the prompt, with the schema, instead of `response_format`", async ({ env }) => {
    const { fetchImpl, sent } = recordingFetch(() => completion({ content: JSON.stringify(PROFILE) }));
    await providerFor(env, fetchImpl).generateObject(OBJECT_REQUEST);

    const body = sent[0]?.body;
    expect(body).not.toHaveProperty("response_format");
    expect(body).not.toHaveProperty("provider");
    const prompt = z.array(z.object({ content: z.string() })).parse(body?.messages)[0]?.content;
    expect(prompt?.startsWith(OBJECT_REQUEST.prompt)).toBe(true);
    expect(prompt).toContain("Reply with only one JSON object");
    expect(prompt).toContain(JSON.stringify(STRICT_PROFILE_SCHEMA));
  });
});

// =============================================================================
// Replies and failures
// =============================================================================

describe("OpenAICompatibleProvider replies", () => {
  it("returns the reply text, trimmed", async () => {
    const { fetchImpl } = recordingFetch(() => completion({ content: "  Welcome to Rosa's!\n" }));
    expect(await providerFor(OPENAI, fetchImpl).generateText(TEXT_REQUEST)).toBe("Welcome to Rosa's!");
  });

  it("returns a typed object from a valid JSON reply", async () => {
    const { fetchImpl } = recordingFetch(() => completion({ content: JSON.stringify(PROFILE) }));
    expect(await providerFor(OPENAI, fetchImpl).generateObject(OBJECT_REQUEST)).toEqual(PROFILE);
  });

  it.each([
    { shape: "a fenced block", content: `Here you go:\n\`\`\`json\n${JSON.stringify(PROFILE)}\n\`\`\`` },
    { shape: "prose around the object", content: `Sure! ${JSON.stringify(PROFILE)} Let me know if that works.` },
  ])("parses JSON sent as $shape in prompt mode", async ({ content }) => {
    const { fetchImpl } = recordingFetch(() => completion({ content }));
    expect(await providerFor(FEATHERLESS, fetchImpl).generateObject(OBJECT_REQUEST)).toEqual(PROFILE);
  });

  it("raises `LlmResponseError` when the JSON does not match the schema", async () => {
    const { fetchImpl } = recordingFetch(() => completion({ content: JSON.stringify({ trade: "bakery", tasks: "orders" }) }));
    expect(await rejectionOf(providerFor(OPENAI, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmResponseError);
  });

  it("raises `LlmResponseError` when the reply holds no JSON", async () => {
    const { fetchImpl } = recordingFetch(() => completion({ content: "I'd describe it as a cozy bakery." }));
    expect(await rejectionOf(providerFor(CUSTOM, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmResponseError);
  });

  it("raises `LlmResponseError` when the reply has no text", async () => {
    const { fetchImpl } = recordingFetch(() => completion({ content: null }));
    expect(await rejectionOf(providerFor(OPENAI, fetchImpl).generateText(TEXT_REQUEST))).toBeInstanceOf(LlmResponseError);
  });

  it("raises `LlmResponseError` when the body is not a chat completion", async () => {
    const { fetchImpl } = recordingFetch(() => Response.json({ choices: [] }));
    expect(await rejectionOf(providerFor(OPENAI, fetchImpl).generateText(TEXT_REQUEST))).toBeInstanceOf(LlmResponseError);
  });

  it("raises `LlmRefusalError` when the model sends a `refusal`", async () => {
    const { fetchImpl } = recordingFetch(() => completion({ content: null, refusal: "I can't help with that." }));
    expect(await rejectionOf(providerFor(OPENAI, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmRefusalError);
  });

  it("raises `LlmRefusalError` when the provider stops on `content_filter`", async () => {
    const { fetchImpl } = recordingFetch(() => completion({ content: '{"trade": "bak' }, "content_filter"));
    expect(await rejectionOf(providerFor(OPENROUTER, fetchImpl).generateObject(OBJECT_REQUEST))).toBeInstanceOf(LlmRefusalError);
  });

  it("raises `LlmRequestError` with status 429 when rate limited", async () => {
    const { fetchImpl } = recordingFetch(() => Response.json({ error: { message: "Rate limit reached" } }, { status: 429 }));
    const error = await rejectionOf(providerFor(OPENROUTER, fetchImpl).generateText(TEXT_REQUEST));
    expect(error).toBeInstanceOf(LlmRequestError);
    expect(error).toMatchObject({ status: 429 });
  });

  it("raises `LlmRequestError` with a `null` status when the network fails", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await rejectionOf(providerFor(OPENAI, fetchImpl).generateText(TEXT_REQUEST));
    expect(error).toBeInstanceOf(LlmRequestError);
    expect(error).toMatchObject({ status: null });
  });
});
