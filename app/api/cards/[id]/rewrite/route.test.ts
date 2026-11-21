import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardRecord } from "@/lib/api/contract";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import type { BusinessProfile } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";
import { encryptSecret } from "@/lib/server/secrets";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// "Rewrite in my voice" as the owner meets it when AI can't run: with no AI
// key anywhere, the reply says to add one on Connections, or, on the example
// business, that it writes without AI; and when the owner's provider turns
// their key down or doesn't know their model, the reply says so in plain
// words with none of the provider's text. The card lookup is stubbed; the key, the store and the
// model layer are real, with the provider's endpoint answered by `fetch`.

const SESSION = "owner-session";
const CARD_ID = "11111111-2222-4333-8444-555555555555";
const OWNER_KEY = "sk-owner-test-key-abcd1234";

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, business: null as BusinessProfile | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({ ...(await original<object>()), getSessionId: async () => SESSION }));
vi.mock("@/lib/server/data", async (original) => ({
  ...(await original<object>()),
  findBusiness: async () => state.business,
  isCardLive: async () => true,
  materializeCard: async (): Promise<CardRecord | null> =>
    state.business === null
      ? null
      : ({ id: CARD_ID, key: "k1", businessId: state.business.id, status: "pending", channel: "sms", body: "Hi Ana, we can come Tuesday.", edited: false, createdAt: "2026-11-20T15:00:00Z", decidedAt: null } as unknown as CardRecord),
}));

const { POST } = await import("./route");

/** Ask for a rewrite of the test card and return the status and the owner's message. */
async function rewrite(): Promise<{ status: number; error: string | undefined }> {
  const response = await POST(new Request(`http://localhost/api/cards/${CARD_ID}/rewrite`, { method: "POST" }), { params: Promise.resolve({ id: CARD_ID }) });
  const body = (await response.json()) as { error?: string };
  return { status: response.status, error: body.error };
}

beforeEach(() => {
  state.store = new MemoryStore();
  state.business = hvacShop();
  vi.stubEnv("CONNECTOR_SECRET_KEY", Buffer.alloc(32, 7).toString("base64"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/cards/[id]/rewrite", () => {
  it("tells an owner with no AI key to add one on Connections", async () => {
    expect(await rewrite()).toEqual({ status: 503, error: "Add your AI key on Connections to rewrite drafts. Until then, edit the draft yourself." });
  });

  it("tells a visitor to the example business that it writes without AI", async () => {
    state.business = SAMPLE_BUSINESS;
    expect((await rewrite()).error).toBe("The example business writes its drafts without AI. Set up your business and add your AI key to rewrite drafts.");
  });

  it("says the owner's provider turned their key down, with none of the provider's text", async () => {
    const business = state.business as BusinessProfile;
    await state.store?.saveConnection(SESSION, { businessId: business.id, kind: "ai", hookId: "h".repeat(24), settings: { provider: "openai", model: "gpt-test", lastFour: "1234" }, secret: encryptSecret(OWNER_KEY) });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: `Incorrect API key provided: ${OWNER_KEY}` } }), { status: 401 }));

    const answer = await rewrite();

    expect(answer).toEqual({ status: 422, error: "OpenAI turned down your AI key. Check it on Connections." });
  });

  it("says the owner's provider doesn't know their saved model, instead of a server error", async () => {
    const business = state.business as BusinessProfile;
    await state.store?.saveConnection(SESSION, { businessId: business.id, kind: "ai", hookId: "h".repeat(24), settings: { provider: "openai", model: "gpt-typo", lastFour: "1234" }, secret: encryptSecret(OWNER_KEY) });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "The model `gpt-typo` does not exist" } }), { status: 404 }));

    expect(await rewrite()).toEqual({ status: 502, error: "OpenAI doesn't know the model name saved on Connections. Copy the exact name from OpenAI." });
  });
});
