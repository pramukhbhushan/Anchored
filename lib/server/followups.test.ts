import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FollowupInput } from "@/lib/domain/followups";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The follow-up flows on the in-memory store: a due timer for a customer with
// a number and a texting OK becomes a pending card and sends nothing, each
// refusal writes nothing, and cancelling keeps the timer's facts.

const SESSION = "owner";
const SHOP = hvacShop();
const NOW = new Date("2026-11-09T15:00:00Z");

const state = vi.hoisted(() => ({ store: null as MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { cancelFollowup, listFollowups, recordFollowup } = await import("./followups");

let contactId: string;

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

function input(change: Partial<FollowupInput> = {}): FollowupInput {
  return { contactId, skill: "callback", dueAt: "2026-11-09T09:00:00-05:00", state: "missed-call", sourceId: "call:001", evidence: "Owner recorded this missed call.", ...change };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.store = new MemoryStore();
  await store().saveBusiness(SESSION, SHOP);
  await store().setChoice(SESSION, SHOP.id, "calls", { path: "build", skills: ["callback"] });
  contactId = (await store().saveContact(SESSION, { businessId: SHOP.id, name: "Dana", phone: "+13015550192", email: null, consent: { source: "texted-first", at: "2026-11-08T12:00:00Z" }, optedOutAt: null })).id;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("recordFollowup", () => {
  it("saves a due timer and drafts its card for approval without sending", async () => {
    const result = await recordFollowup(SESSION, SHOP, input());
    expect(result).toMatchObject({ ok: true, records: [{ businessId: SHOP.id, contactId, status: "active", dueAt: "2026-11-09T14:00:00.000Z" }] });
    expect(await store().listCards(SESSION, SHOP.id)).toMatchObject([{ status: "pending", channel: "sms", contact: contactId }]);
    expect(await store().listOutbox(SESSION, SHOP.id)).toEqual([]);
    expect(await listFollowups(SESSION, SHOP)).toHaveLength(1);
  });

  it.each([
    ["a customer from another business", async () => ({ contactId: (await store().saveContact(SESSION, { businessId: "another-shop", name: "Other", phone: null, email: null, consent: null, optedOutAt: null })).id }), 404],
    ["a customer with no number or texting OK", async () => ({ contactId: (await store().saveContact(SESSION, { businessId: SHOP.id, name: "Lee", phone: null, email: null, consent: null, optedOutAt: null })).id }), 409],
    ["a job the owner hasn't chosen", async () => ({ skill: "showup" as const }), 409],
  ] as const)("refuses %s and writes nothing", async (_name, change, status) => {
    const result = await recordFollowup(SESSION, SHOP, input(await change()));
    expect(result).toMatchObject({ ok: false, status });
    expect(await store().listFollowups(SESSION, SHOP.id)).toEqual([]);
    expect(await store().listCards(SESSION, SHOP.id)).toEqual([]);
  });
});

describe("cancelFollowup", () => {
  it("cancels a timer and keeps its facts", async () => {
    const saved = await recordFollowup(SESSION, SHOP, input({ dueAt: "2026-11-10T10:00:00-05:00" }));
    if (!saved.ok) throw new Error(saved.error);
    const id = saved.records[0]?.id ?? "";
    const result = await cancelFollowup(SESSION, SHOP, id);
    expect(result).toMatchObject({ ok: true, records: [{ id, status: "cancelled", sourceId: "call:001", evidence: "Owner recorded this missed call." }] });
  });

  it("refuses a timer the business doesn't have", async () => {
    expect(await cancelFollowup(SESSION, SHOP, "8d1e1f4c-9a6b-4f0e-9e8a-2b1c3d4e5f60")).toMatchObject({ ok: false, status: 404 });
  });
});
