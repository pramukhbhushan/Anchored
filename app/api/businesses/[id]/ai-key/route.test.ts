import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionsResponse } from "@/lib/api/contract";
import type { Viewer } from "@/lib/auth/viewer";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The AI key route as the Connections page calls it: an account's key is
// checked with one call to its provider and saved, and the answer shows the
// provider and last four characters but never the key; a key the provider
// turns down is not saved; guests and the example business are refused; and
// removing the key clears it. The provider's endpoint is answered by `fetch`.

const SESSION = "owner-session";
const KEY = "sk-owner-test-key-abcd1234";
const ACCOUNT: Viewer = { id: SESSION, email: "owner@example.com", isGuest: false, authEnabled: true };
const GUEST: Viewer = { id: SESSION, email: null, isGuest: true, authEnabled: true };

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, viewer: null as Viewer | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({
  ...(await original<object>()),
  getSessionId: async () => SESSION,
  findViewer: async () => state.viewer,
}));

const { PUT, DELETE } = await import("./route");

const business = hvacShop();

/** Call the route for business `id` with `method` and an optional JSON body. */
async function call(handler: typeof PUT, id: string, body?: unknown): Promise<{ status: number; text: string }> {
  const request = new Request(`http://localhost/api/businesses/${id}/ai-key`, {
    method: body === undefined ? "DELETE" : "PUT",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve({ id }) });
  return { status: response.status, text: await response.text() };
}

/** Answer OpenAI's chat endpoint with `status`, quoting the key the way OpenAI does on a 401. */
function provider(status: number) {
  const body = status === 200 ? { choices: [{ message: { content: "OK" }, finish_reason: "stop" }] } : { error: { message: `Incorrect API key provided: ${KEY}` } };
  return vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

beforeEach(async () => {
  vi.stubEnv("CONNECTOR_SECRET_KEY", Buffer.alloc(32, 7).toString("base64"));
  state.store = new MemoryStore();
  state.viewer = ACCOUNT;
  await state.store.saveBusiness(SESSION, business);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("PUT and DELETE /api/businesses/[id]/ai-key", () => {
  it("checks and saves an account's key, then shows its provider and last four characters only", async () => {
    provider(200);
    const answer = await call(PUT, business.id, { provider: "openai", apiKey: KEY, model: "gpt-test" });

    expect(answer.status).toBe(200);
    expect((JSON.parse(answer.text) as ConnectionsResponse).ai).toMatchObject({ provider: "openai", lastFour: "1234", model: "gpt-test" });
    expect(answer.text).not.toContain(KEY);
  });

  it("saves nothing when the provider turns the key down, and repeats none of its text", async () => {
    provider(401);
    const answer = await call(PUT, business.id, { provider: "openai", apiKey: KEY, model: "gpt-test" });

    expect(answer.status).toBe(400);
    expect(JSON.parse(answer.text)).toMatchObject({ error: "OpenAI turned down this key. Copy the whole key from your OpenAI account and paste it again." });
    expect(answer.text).not.toContain(KEY);
    expect(await state.store?.listConnections(SESSION, business.id)).toEqual([]);
  });

  it("refuses a guest and the example business without calling the provider", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    state.viewer = GUEST;
    expect((await call(PUT, business.id, { provider: "anthropic", apiKey: KEY })).status).toBe(403);
    state.viewer = ACCOUNT;
    expect((await call(PUT, SAMPLE_BUSINESS.id, { provider: "anthropic", apiKey: KEY })).status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("removes the key, so the business goes back to the rules", async () => {
    provider(200);
    await call(PUT, business.id, { provider: "anthropic", apiKey: KEY });
    const answer = await call(DELETE, business.id);

    expect((JSON.parse(answer.text) as ConnectionsResponse).ai).toMatchObject({ provider: null, lastFour: null });
    expect(await state.store?.listConnections(SESSION, business.id)).toEqual([]);
  });
});
