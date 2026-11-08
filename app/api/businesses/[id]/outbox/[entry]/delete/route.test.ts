import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The removal boundary accepts explicit confirmation, never chat/provider
// identities, and obtains ownership from the current session. Fake fetch
// proves only an owned, stored message reaches the connector.

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, session: "owner" }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({ ...(await original<object>()), getSessionId: async () => state.session }));
const route = await import("./route");
const shop = hvacShop();
let entryId: string;
let fetch: ReturnType<typeof vi.fn>;
function request(body: unknown) {
  return new Request("http://localhost/api/businesses/shop/outbox/entry/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
function params(id = shop.id) { return { params: Promise.resolve({ id, entry: entryId }) }; }
beforeEach(async () => {
  state.store = new MemoryStore(); state.session = "owner";
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "token"); vi.stubEnv("TELEGRAM_BOT_USERNAME", "TestBot");
  await state.store.saveBusiness("owner", shop);
  const contact = await state.store.saveContact("owner", { businessId: shop.id, name: "Dana", phone: null, email: null, optedOutAt: null, consent: null, telegramChatId: "123" });
  const entry = await state.store.addOutbox("owner", { businessId: shop.id, cardId: null, channel: "telegram", contactId: contact.id, to: "Dana", body: "Hello", sentAt: new Date().toISOString(), delivery: "sent" });
  entryId = entry.id;
  await state.store.settleOutbox("owner", entryId, { delivery: "sent", providerId: "42" });
  fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Telegram removal route", () => {
  it("uses stored recipient identity and preserves audit", async () => {
    const response = await route.POST(request({ confirm: true }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ chat_id: "123", message_id: 42 });
    expect((await state.store!.listOutbox("owner", shop.id))[0]).toMatchObject({ body: "Hello", delivery: "sent", deletionState: "deleted" });
  });
  it.each([{}, { confirm: false }, { confirm: true, chatId: "attacker" }, { confirm: true, providerId: "999" }])("rejects missing consent or injected provider identity", async (body) => {
    expect((await route.POST(request(body), params())).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("cannot remove another owner's message", async () => {
    state.session = "other";
    expect((await route.POST(request({ confirm: true }), params())).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});
