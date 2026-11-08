import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FollowupsResponse } from "@/lib/api/contract";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Follow-up routes accept recorded facts under the current session only.
// Invalid input, a foreign customer or an inactive skill writes nothing;
// cancellation preserves the source and supersedes its pending approval work.

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, session: "owner" }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({ ...(await original<object>()), getSessionId: async () => state.session }));
const route = await import("./route");
const SHOP = hvacShop();
const NOW = new Date("2026-11-09T15:00:00Z");
let contactId: string;

function store(): MemoryStore {
  if (state.store === null) throw new Error("Missing test store.");
  return state.store;
}
function params(id = SHOP.id) { return { params: Promise.resolve({ id }) }; }
function request(method: string, body?: unknown): Request {
  return new Request(`http://localhost/api/businesses/${SHOP.id}/followups`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
function input() {
  return { contactId, skill: "callback", dueAt: "2026-11-09T09:00:00-05:00", state: "missed-call", sourceId: "call:001", evidence: "Owner recorded this missed call." };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.store = new MemoryStore();
  state.session = "owner";
  await store().saveBusiness(state.session, SHOP);
  await store().setChoice(state.session, SHOP.id, "calls", { path: "build", skills: ["callback"] });
  contactId = (await store().saveContact(state.session, { businessId: SHOP.id, name: "Dana", phone: null, email: null, consent: { source: "messaged-first", at: "2026-11-08T12:00:00Z" }, optedOutAt: null, telegramChatId: "123" })).id;
});
afterEach(() => { vi.useRealTimers(); });

describe("follow-up route", () => {
  it("saves explicit facts, normalizes the due instant and creates a draft without sending", async () => {
    const response = await route.POST(request("POST", input()), params());
    expect(response.status).toBe(200);
    const data = await response.json() as FollowupsResponse;
    expect(data.records).toHaveLength(1);
    expect(data.records[0]).toMatchObject({ businessId: SHOP.id, contactId, status: "active", dueAt: "2026-11-09T14:00:00.000Z", sourceId: "call:001", evidence: input().evidence });
    expect((await store().listCards("owner", SHOP.id))[0]).toMatchObject({ status: "pending", channel: "telegram", contact: contactId });
    expect(await store().listOutbox("owner", SHOP.id)).toEqual([]);
    expect((await (await route.GET(request("GET"), params())).json() as FollowupsResponse).records).toEqual(data.records);
  });

  it("persists future dates without drafting early", async () => {
    const response = await route.POST(request("POST", { ...input(), dueAt: "2026-11-10T10:00:00-05:00" }), params());
    expect(response.status).toBe(200);
    expect(await store().listCards("owner", SHOP.id)).toEqual([]);
  });

  it.each([
    { dueAt: "tomorrow morning" },
    { dueAt: "2026-02-30T12:00:00Z" },
    { dueAt: "2026-11-09T09:00" },
    { evidence: "" },
    { state: "completed-job" },
    { touch: 1 },
    { session: "other-owner" },
    { businessId: "another-shop" },
  ])("refuses invalid or caller-supplied ownership fields: %j", async (change) => {
    expect((await route.POST(request("POST", { ...input(), ...change }), params())).status).toBe(400);
    expect(await store().listFollowups("owner", SHOP.id)).toEqual([]);
    expect(await store().listOutbox("owner", SHOP.id)).toEqual([]);
  });

  it("refuses a customer from another business even in the same session", async () => {
    const foreign = await store().saveContact("owner", { businessId: "another-shop", name: "Other", phone: null, email: null, consent: null, optedOutAt: null });
    expect((await route.POST(request("POST", { ...input(), contactId: foreign.id }), params())).status).toBe(404);
    expect(await store().listFollowups("owner", SHOP.id)).toEqual([]);
  });

  it("requires the skill to be chosen and never lets another session read or mutate records", async () => {
    await store().setChoice("owner", SHOP.id, "calls", { path: "skip" });
    expect((await route.POST(request("POST", input()), params())).status).toBe(409);
    state.session = "other-owner";
    expect((await route.GET(request("GET"), params())).status).toBe(404);
    expect((await route.POST(request("POST", input()), params())).status).toBe(404);
  });

  it("cancels a saved timer by identity and supersedes its pending card", async () => {
    const data = await (await route.POST(request("POST", input()), params())).json() as FollowupsResponse;
    const id = data.records[0]!.id;
    const response = await route.PUT(request("PUT", { id }), params());
    expect(response.status).toBe(200);
    expect((await response.json() as FollowupsResponse).records[0]).toMatchObject({ id, status: "cancelled", evidence: input().evidence });
    expect((await store().listCards("owner", SHOP.id))[0]?.status).toBe("superseded");
    expect(await store().listOutbox("owner", SHOP.id)).toEqual([]);
  });

  it("refuses unknown or foreign timer identities and the shared example", async () => {
    const response = await route.PUT(request("PUT", { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), params());
    expect(response.status).toBe(404);
    expect((await route.POST(request("POST", input()), params(SAMPLE_BUSINESS.id))).status).toBe(404);
  });
});
