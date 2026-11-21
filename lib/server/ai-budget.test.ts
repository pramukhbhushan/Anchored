import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LlmProvider } from "@/lib/llm";
import { MemoryStore } from "@/lib/store/memory";
import { AiBudgetError, AiKeyError, checkOwnerKey, dailyCallCap, DEFAULT_DAILY_CALL_CAP, getBudgetedLlm, withDailyBudget } from "./ai-budget";
import { encryptSecret } from "./secrets";

vi.mock("server-only", () => ({}));

// The server's own key is a fake provider; an owner's key runs the real adapter against a stubbed `fetch`.
const state = vi.hoisted(() => ({ store: null as MemoryStore | null, server: null as LlmProvider | null }));
vi.mock("@/lib/store", () => ({ getStore: () => state.store }));
vi.mock("@/lib/llm", async (original) => ({ ...(await original<object>()), getLlm: () => state.server }));

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the daily AI call cap: calls go through while `spend` allows
// them, stop before reaching the provider once it refuses, and the cap reads
// from `AI_DAILY_CALL_CAP`. Then whose key a business's calls run on: its own
// key from Connections wins and skips the cap, the server's key is the
// fallback and counts against it, no key at all means the rules write, and a
// refused key reaches the owner as plain words with none of the provider's.

function fakeProvider(): LlmProvider & { calls: number } {
  const provider = {
    name: "anthropic" as const,
    label: "Claude",
    calls: 0,
    modelFor: () => "test-model",
    async generateText() {
      provider.calls++;
      return "drafted";
    },
    async generateObject<T>(request: { schema: z.ZodType<T> }) {
      provider.calls++;
      return request.schema.parse({ ok: true });
    },
  };
  return provider;
}

describe("withDailyBudget", () => {
  it("passes calls through while the budget allows them", async () => {
    const provider = fakeProvider();
    const budgeted = withDailyBudget(provider, async () => true);

    expect(await budgeted.generateText({ tier: "quick", prompt: "hi", maxTokens: 10 })).toBe("drafted");
    expect(await budgeted.generateObject({ tier: "quick", prompt: "hi", maxTokens: 10, schema: z.object({ ok: z.boolean() }), schemaName: "t" })).toEqual({ ok: true });
    expect(provider.calls).toBe(2);
  });

  it("throws AiBudgetError without calling the provider once the budget is spent", async () => {
    const provider = fakeProvider();
    const budgeted = withDailyBudget(provider, async () => false);

    await expect(budgeted.generateText({ tier: "quick", prompt: "hi", maxTokens: 10 })).rejects.toBeInstanceOf(AiBudgetError);
    expect(provider.calls).toBe(0);
  });

  it("counts a web search against the budget, and offers no search when the provider has none", async () => {
    const searching = { ...fakeProvider(), searchWeb: async () => ({ text: "found", sources: [] }) };
    const search = { tier: "default" as const, prompt: "find tools", maxTokens: 10, maxSearches: 1 };

    await expect(withDailyBudget(searching, async () => false).searchWeb?.(search)).rejects.toBeInstanceOf(AiBudgetError);
    expect(await withDailyBudget(searching, async () => true).searchWeb?.(search)).toEqual({ text: "found", sources: [] });
    expect(withDailyBudget(fakeProvider(), async () => true).searchWeb).toBeUndefined();
  });
});

describe("dailyCallCap", () => {
  it("uses the default when the variable is unset or blank", () => {
    expect(dailyCallCap({})).toBe(DEFAULT_DAILY_CALL_CAP);
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: " " })).toBe(DEFAULT_DAILY_CALL_CAP);
  });

  it("reads a whole number, including 0 to turn AI calls off", () => {
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "500" })).toBe(500);
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "0" })).toBe(0);
  });

  it("falls back to the default on a value that is not a whole number", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "lots" })).toBe(DEFAULT_DAILY_CALL_CAP);
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "-5" })).toBe(DEFAULT_DAILY_CALL_CAP);
    error.mockRestore();
  });
});

// =============================================================================
// Whose key a business's calls run on
// =============================================================================

const SESSION = "owner-session";
const SCOPE = { session: SESSION, businessId: "b_1" };
const OWNER_KEY = "sk-owner-test-key-abcd1234";
const TEXT = { tier: "quick" as const, prompt: "hi", maxTokens: 10 };

/** Save an OpenAI key for business `b_1`, the way the Connections page does. */
async function saveOwnerKey(apiKey = OWNER_KEY): Promise<void> {
  await state.store?.saveConnection(SESSION, { businessId: "b_1", kind: "ai", hookId: "h".repeat(24), settings: { provider: "openai", model: "gpt-test", lastFour: apiKey.slice(-4) }, secret: encryptSecret(apiKey) });
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

const ANSWER = { choices: [{ message: { content: "Owner key answered." }, finish_reason: "stop" }] };

describe("getBudgetedLlm", () => {
  beforeEach(() => {
    state.store = new MemoryStore();
    state.server = fakeProvider();
    vi.stubEnv("CONNECTOR_SECRET_KEY", Buffer.alloc(32, 7).toString("base64"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("runs a business's calls on its own key, not the server's, and outside the daily cap", async () => {
    vi.stubEnv("AI_DAILY_CALL_CAP", "0");
    await saveOwnerKey();
    const calls = stubOpenAi(200, ANSWER);

    const llm = await getBudgetedLlm(SCOPE);

    expect(llm?.label).toBe("OpenAI");
    expect(await llm?.generateText(TEXT)).toBe("Owner key answered.");
    expect(calls).toEqual([{ url: "https://api.openai.com/v1/chat/completions", auth: `Bearer ${OWNER_KEY}` }]);
    expect((state.server as ReturnType<typeof fakeProvider>).calls).toBe(0);
  });

  it("falls back to the server's key for a business with none, counted against the daily cap", async () => {
    vi.stubEnv("AI_DAILY_CALL_CAP", "1");

    const llm = await getBudgetedLlm(SCOPE);

    expect(llm?.label).toBe("Claude");
    expect(await llm?.generateText(TEXT)).toBe("drafted");
    await expect(llm?.generateText(TEXT)).rejects.toBeInstanceOf(AiBudgetError);
  });

  it("uses only the server's key before a business exists, even when another business has its own", async () => {
    await saveOwnerKey();

    expect((await getBudgetedLlm(null))?.label).toBe("Claude");
  });

  it("returns no provider, so the rules write, when neither the business nor the server has a key", async () => {
    state.server = null;

    expect(await getBudgetedLlm(SCOPE)).toBeNull();
    expect(await getBudgetedLlm(null)).toBeNull();
  });

  it("tells the owner their provider turned down the key, with none of the provider's text", async () => {
    await saveOwnerKey();
    stubOpenAi(401, { error: { message: `Incorrect API key provided: ${OWNER_KEY}` } });

    const attempt = (await getBudgetedLlm(SCOPE))?.generateText(TEXT);

    await expect(attempt).rejects.toBeInstanceOf(AiKeyError);
    await expect(attempt).rejects.toThrow("OpenAI turned down your AI key. Check it on Connections.");
    await expect(attempt).rejects.not.toThrow(/abcd1234/);
  });

  it("falls back to the server's key when the saved key can't be decrypted, and logs no key", async () => {
    await saveOwnerKey();
    vi.stubEnv("CONNECTOR_SECRET_KEY", Buffer.alloc(32, 9).toString("base64"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await getBudgetedLlm(SCOPE))?.label).toBe("Claude");
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
