import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { AiKeyError, checkOwnerKey, getBusinessLlm, OwnerKeyRequestError } from "./business-llm";
import { encryptSecret } from "./secrets";

vi.mock("server-only", () => ({}));
// An owner's key runs the real adapter against a stubbed `fetch`.
const state = vi.hoisted(() => ({ store: null as unknown as MemoryStore }));
vi.mock("@/lib/store", () => ({ getStore: () => state.store }));

// =============================================================================
// Module Overview
// =============================================================================
// Whose key a business's calls run on: its own key from Connections, or none
// at all, and the rules write. AI settings left in the server's environment do
// nothing. A refused key reaches the owner as plain words with none of the
// provider's.

// =============================================================================
// Whose key a business's calls run on
// =============================================================================

const SESSION = "owner-session";
const OWNER_KEY = "sk-owner-test-key-abcd1234";
const TEXT = { tier: "quick" as const, prompt: "hi", maxTokens: 10 };

/** Save an OpenAI key for business `b_1`, the way the Connections page does. */
async function saveOwnerKey(apiKey = OWNER_KEY): Promise<void> {
  await state.store.saveConnection(SESSION, { businessId: "b_1", kind: "ai", hookId: "h".repeat(24), settings: { provider: "openai", model: "gpt-test", lastFour: apiKey.slice(-4) }, secret: encryptSecret(apiKey) });
}

/** Stub OpenAI's chat endpoint: answer with `status` and `body`, and record each request. */
function stubOpenAi(status: number, body: unknown) {
  const calls: { url: string; auth: string | null }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get("authorization") });
    return new Response(JSON.stringify(body), { status });
  });
  return calls;
}

/** Save an Anthropic key with no model for business `b_1`, so Anchored picks the model. */
async function saveAnthropicKey(): Promise<void> {
  await state.store.saveConnection(SESSION, { businessId: "b_1", kind: "ai", hookId: "a".repeat(24), settings: { provider: "anthropic", lastFour: OWNER_KEY.slice(-4) }, secret: encryptSecret(OWNER_KEY) });
}

/** Stub Anthropic's Messages endpoint to answer every request with `status` and `body`. */
function stubAnthropic(status: number, body: unknown): void {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

const ANSWER = { choices: [{ message: { content: "Owner key answered." }, finish_reason: "stop" }] };

describe("getBusinessLlm", () => {
  beforeEach(() => {
    state.store = new MemoryStore();
    vi.stubEnv("CONNECTOR_SECRET_KEY", Buffer.alloc(32, 7).toString("base64"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("runs a business's calls on its own key", async () => {
    await saveOwnerKey();
    const calls = stubOpenAi(200, ANSWER);

    const llm = await getBusinessLlm(SESSION, "b_1");

    expect(llm?.label).toBe("OpenAI");
    expect(await llm?.generateText(TEXT)).toBe("Owner key answered.");
    expect(calls).toEqual([{ url: "https://api.openai.com/v1/chat/completions", auth: `Bearer ${OWNER_KEY}` }]);
  });

  it("returns no provider, so the rules write, for a business with no key, even with a team key left in the environment", async () => {
    vi.stubEnv("AI_PROVIDER", "anthropic");
    vi.stubEnv("AI_API_KEY", "team-key");

    expect(await getBusinessLlm(SESSION, "b_1")).toBeNull();
  });

  it("keeps one business's key to that business", async () => {
    await saveOwnerKey();

    expect(await getBusinessLlm(SESSION, "b_2")).toBeNull();
  });

  it("tells the owner their provider turned down the key, with none of the provider's text", async () => {
    await saveOwnerKey();
    stubOpenAi(401, { error: { message: `Incorrect API key provided: ${OWNER_KEY}` } });

    const attempt = (await getBusinessLlm(SESSION, "b_1"))?.generateText(TEXT);

    await expect(attempt).rejects.toBeInstanceOf(AiKeyError);
    await expect(attempt).rejects.toThrow("OpenAI turned down your AI key. Check it on Connections.");
    await expect(attempt).rejects.not.toThrow(/abcd1234/);
  });

  it("reads a spent balance as a credit problem, whether the provider says so with 402, 429 or 400", async () => {
    await saveOwnerKey();
    stubOpenAi(429, { error: { code: "insufficient_quota", message: "You exceeded your current quota." } });
    await expect((await getBusinessLlm(SESSION, "b_1"))?.generateText(TEXT)).rejects.toThrow("OpenAI says your AI account is out of credit. Add credit with OpenAI, then try again.");

    await saveAnthropicKey();
    stubAnthropic(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } });
    const attempt = (await getBusinessLlm(SESSION, "b_1"))?.generateText(TEXT);
    await expect(attempt).rejects.toBeInstanceOf(AiKeyError);
    await expect(attempt).rejects.toThrow("Anthropic says your AI account is out of credit. Add credit with Anthropic, then try again.");
  });

  it("points at the model name only when the owner saved one", async () => {
    await saveOwnerKey();
    stubOpenAi(400, { error: { message: "Unsupported parameter" } });
    const named = (await getBusinessLlm(SESSION, "b_1"))?.generateText(TEXT);
    await expect(named).rejects.toBeInstanceOf(OwnerKeyRequestError);
    await expect(named).rejects.toThrow("OpenAI turned down the request. Check the model name on Connections.");

    await saveAnthropicKey();
    stubAnthropic(400, { type: "error", error: { type: "invalid_request_error", message: "Something else is wrong." } });
    await expect((await getBusinessLlm(SESSION, "b_1"))?.generateText(TEXT)).rejects.toThrow("Anthropic turned down the request. Check your account and plan with Anthropic.");
  });

  it("lets the rules write when the saved key can't be decrypted, and logs no key", async () => {
    await saveOwnerKey();
    vi.stubEnv("CONNECTOR_SECRET_KEY", Buffer.alloc(32, 9).toString("base64"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await getBusinessLlm(SESSION, "b_1")).toBeNull();
    expect(error.mock.calls.flat().join(" ")).not.toContain(OWNER_KEY);
    error.mockRestore();
  });
});

describe("checkOwnerKey", () => {
  afterEach(() => vi.unstubAllGlobals());

  const owner = { provider: "openai" as const, apiKey: OWNER_KEY, model: "gpt-test" };

  it("passes a key the provider answers", async () => {
    stubOpenAi(200, ANSWER);
    expect(await checkOwnerKey(owner)).toBeNull();
  });

  it("says what to do about a refused key, a wrong model or a provider that didn't answer", async () => {
    stubOpenAi(401, { error: { message: `Incorrect API key provided: ${OWNER_KEY}` } });
    expect(await checkOwnerKey(owner)).toBe("OpenAI turned down this key. Copy the whole key from your OpenAI account and paste it again.");
    stubOpenAi(404, { error: { message: "The model does not exist" } });
    expect(await checkOwnerKey(owner)).toBe("OpenAI doesn't know that model name. Copy the exact name from OpenAI.");
    stubOpenAi(503, {});
    expect(await checkOwnerKey(owner)).toBe("OpenAI didn't answer. Try again in a minute.");
  });
});
