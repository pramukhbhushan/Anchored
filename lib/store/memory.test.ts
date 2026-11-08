import { describe, expect, it } from "vitest";
import type { KeyedCard } from "@/lib/domain/types";
import { MemoryStore } from "./memory";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `MemoryStore` that the server relies on: the pending-only card
// update, the shared daily AI call cap, the bound on how many sessions it keeps,
// the sending queue, contacts kept one per phone number, and connections found
// by the hook id a webhook carries.

const BUSINESS = "b_test";

const card: KeyedCard = {
  key: `${BUSINESS}:callback`,
  agent: "frontdesk",
  skill: "callback",
  title: "Missed call",
  body: "Sorry we missed you. Reply STOP to opt out.",
  reason: "Callers who wait often book the next shop.",
  checks: [],
  action: "Send text",
  channel: "sms",
  to: "(301) 555-0192",
};

describe("updatePendingCard", () => {
  it("updates a pending card and refuses once it is decided", async () => {
    const store = new MemoryStore();
    await store.ensureCards("s1", BUSINESS, [card]);
    const [saved] = await store.listCards("s1", BUSINESS);
    if (!saved) throw new Error("test setup: card was not stored");

    const first = await store.updatePendingCard("s1", saved.id, { status: "approved" });
    const second = await store.updatePendingCard("s1", saved.id, { status: "skipped" });

    expect(first?.status).toBe("approved");
    expect(second).toBeNull();
    expect((await store.getCard("s1", saved.id))?.status).toBe("approved");
  });

  it("returns null for a card that does not exist", async () => {
    expect(await new MemoryStore().updatePendingCard("s1", "missing", { status: "approved" })).toBeNull();
  });
});

describe("useAiCall", () => {
  it("allows calls up to the cap for the day and refuses the rest", async () => {
    const store = new MemoryStore();
    const answers = [];
    for (let i = 0; i < 4; i++) answers.push(await store.useAiCall("2026-11-07", 3));
    expect(answers).toEqual([true, true, true, false]);
  });

  it("starts a new count on a new day", async () => {
    const store = new MemoryStore();
    await store.useAiCall("2026-11-07", 1);
    expect(await store.useAiCall("2026-11-07", 1)).toBe(false);
    expect(await store.useAiCall("2026-11-08", 1)).toBe(true);
  });
});

describe("session bound", () => {
  it("drops the oldest session once 2000 sessions have written, and reads never count", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 2000; i++) await store.ensureCards(`s${i}`, BUSINESS, [card]);
    // A visitor who only reads must not push a real session out.
    await store.listCards("reader-only", BUSINESS);
    expect(await store.listCards("s0", BUSINESS)).toHaveLength(1);

    await store.ensureCards("s2000", BUSINESS, [card]);
    expect(await store.listCards("s0", BUSINESS)).toHaveLength(0);
    expect(await store.listCards("s1", BUSINESS)).toHaveLength(1);
  });
});

describe("the sending queue", () => {
  it("lets one sender claim a queued entry, and lists due entries from every session", async () => {
    const store = new MemoryStore();
    const early = await store.addOutbox("s1", { businessId: BUSINESS, cardId: "c1", channel: "sms", to: "+13015550192", body: "Hi", sentAt: "2026-11-08T13:00:00Z", delivery: "queued" });
    await store.addOutbox("s2", { businessId: BUSINESS, cardId: "c2", channel: "sms", to: "+13015550193", body: "Hi", sentAt: "2026-11-08T14:00:00Z", delivery: "queued" });
    await store.addOutbox("s2", { businessId: BUSINESS, cardId: "c3", channel: "sms", to: "+13015550194", body: "Later", sentAt: "2026-11-09T14:00:00Z", delivery: "queued" });
    await store.addOutbox("s3", { businessId: BUSINESS, cardId: "c4", channel: "sms", to: "Dana", body: "Mine", sentAt: "2026-11-08T12:00:00Z" });

    const due = await store.listDueOutbox("2026-11-08T15:00:00Z", 10);
    expect(due.map(({ session, entry }) => `${session}:${entry.cardId}`)).toEqual(["s1:c1", "s2:c2"]);

    expect((await store.claimOutbox("s1", early.id))?.delivery).toBe("sending");
    expect(await store.claimOutbox("s1", early.id)).toBeNull();
    await store.settleOutbox("s1", early.id, { delivery: "sent", note: null });
    expect((await store.listOutbox("s1", BUSINESS))[0]).toMatchObject({ delivery: "sent", note: null });
  });
});

describe("contacts", () => {
  it("keeps one contact per phone number", async () => {
    const store = new MemoryStore();
    const base = { businessId: BUSINESS, name: "Dana", phone: "+13015550192", email: null, consent: null, optedOutAt: null };
    const first = await store.saveContact("s1", base);
    const again = await store.saveContact("s1", { ...base, name: "Dana Lewis", consent: { source: "texted-first", at: "2026-11-08T13:00:00Z" } });

    expect(again.id).toBe(first.id);
    expect(await store.listContacts("s1", BUSINESS)).toEqual([again]);
    await store.deleteContact("s1", BUSINESS, again.id);
    expect(await store.listContacts("s1", BUSINESS)).toEqual([]);
  });
});

describe("connections", () => {
  it("keeps one connection per kind and finds it by hook id from any session", async () => {
    const store = new MemoryStore();
    await store.saveConnection("s1", { businessId: BUSINESS, kind: "texting", hookId: "hook-old", settings: { phone: "+13015550100" }, secret: "x" });
    const current = await store.saveConnection("s1", { businessId: BUSINESS, kind: "texting", hookId: "hook-new", settings: { phone: "+13015550101" }, secret: "y" });

    expect(await store.listConnections("s1", BUSINESS)).toEqual([current]);
    expect(await store.findConnection("hook-old")).toBeNull();
    expect(await store.findConnection("hook-new")).toEqual({ session: "s1", connection: current });

    await store.reset("s1");
    expect(await store.findConnection("hook-new")).toBeNull();
  });
});
