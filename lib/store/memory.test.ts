import { describe, expect, it } from "vitest";
import { profileFromFacts } from "@/lib/domain/engine";
import type { KeyedCard } from "@/lib/domain/types";
import { MemoryStore } from "./memory";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `MemoryStore` that the server relies on: the pending-only card
// update, the bound on how many sessions it keeps,
// the sending queue, contacts kept one per phone number, and connections found
// by the hook id a webhook carries, profile versions, and replaced drafts.

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

describe("retained events and conversation ownership", () => {
  it("keeps raw event payloads scoped to the business", async () => {
    const store = new MemoryStore();
    await store.recordEvent("s1", BUSINESS, "onboarding_raw", { sentence: "I run a bakery" });
    await store.recordEvent("s1", "other", "text", { body: "hello" });

    expect(await store.listEvents("s1", BUSINESS)).toMatchObject([
      { businessId: BUSINESS, source: "onboarding_raw", payload: { sentence: "I run a bakery" } },
    ]);
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

describe("profile versions", () => {
  it("bumps the version on each save and keeps every earlier copy readable", async () => {
    const store = new MemoryStore();
    const business = profileFromFacts({ name: "Apex Heating", trade: "HVAC", tradeKey: "home", reach: ["Phone calls"], tools: [], signals: [] });

    const first = await store.saveBusiness("s1", business, "onboarding");
    // A caller holding a stale copy still gets the next number: the store owns the count.
    const second = await store.saveBusiness("s1", { ...business, details: { hours: "8 to 6" } }, "owner");

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect((await store.getBusiness("s1", business.id))?.details?.hours).toBe("8 to 6");
    const history = await store.listProfileVersions("s1", business.id);
    expect(history.map((v) => [v.version, v.changedBy])).toEqual([
      [2, "owner"],
      [1, "onboarding"],
    ]);
    expect(history[1]?.snapshot.details).toBeUndefined();
    expect(await store.listProfileVersions("s2", business.id)).toEqual([]);
  });
});

describe("supersedePendingCards", () => {
  it("leaves one pending card per contact and keeps decided cards as they were", async () => {
    const store = new MemoryStore();
    const toContact = (n: number): KeyedCard => ({ ...card, key: `${BUSINESS}:sms:${n}`, contact: "+13015550192" });
    await store.ensureCards("s1", BUSINESS, [toContact(1), toContact(2), { ...card, key: `${BUSINESS}:other`, contact: "+13015550111" }]);
    const [one] = await store.listCards("s1", BUSINESS);
    if (!one) throw new Error("test setup: card was not stored");
    await store.updatePendingCard("s1", one.id, { status: "approved" });
    await store.ensureCards("s1", BUSINESS, [toContact(3)]);

    expect(await store.supersedePendingCards("s1", BUSINESS, "+13015550192", `${BUSINESS}:sms:3`)).toBe(1);

    const byKey = new Map((await store.listCards("s1", BUSINESS)).map((c) => [c.key, c.status]));
    expect(byKey.get(`${BUSINESS}:sms:1`)).toBe("approved");
    expect(byKey.get(`${BUSINESS}:sms:2`)).toBe("superseded");
    expect(byKey.get(`${BUSINESS}:sms:3`)).toBe("pending");
    expect(byKey.get(`${BUSINESS}:other`)).toBe("pending");
  });
});

describe("contacts that share a phone number", () => {
  const base = { businessId: BUSINESS, email: null, consent: null, optedOutAt: null };

  it("update the contact that already has the number", async () => {
    const store = new MemoryStore();
    const first = await store.saveContact("s1", { ...base, name: "Dana", phone: "+12025550100" });

    const saved = await store.saveContact("s1", { ...base, name: "Dana Ruiz", phone: "+12025550100" });

    expect(saved.id).toBe(first.id);
    expect(await store.listContacts("s1", BUSINESS)).toEqual([saved]);
  });

  it("refuses a phone number another contact holds", async () => {
    const store = new MemoryStore();
    await store.saveContact("s1", { ...base, name: "Dana", phone: "+12025550100" });
    const other = await store.saveContact("s1", { ...base, name: "Lee", phone: "+12025550111" });

    await expect(store.saveContact("s1", { ...base, id: other.id, name: "Lee", phone: "+12025550100" })).rejects.toThrow("already has");
    expect(await store.listContacts("s1", BUSINESS)).toHaveLength(2);
  });
});

describe("cancelInvoiceReminders", () => {
  const reminder = (n: number, key: string): KeyedCard => ({
    ...card,
    key: `${BUSINESS}:nudger:${n}`,
    agent: "books",
    skill: "nudger",
    channel: "email",
    to: "maya.chen@example.com",
    invoice: { key, number: key.slice(2), amount: 450 },
  });

  it("stops pending and queued reminders for the paid invoice only, and leaves sent ones alone", async () => {
    const store = new MemoryStore();
    await store.ensureCards("s1", BUSINESS, [reminder(1, "n:1042"), reminder(2, "n:1042"), reminder(3, "n:1046"), { ...card, key: `${BUSINESS}:other` }]);
    const byKey = async () => new Map((await store.listCards("s1", BUSINESS)).map((c) => [c.key, c]));
    const first = (await byKey()).get(`${BUSINESS}:nudger:1`);
    if (!first) throw new Error("test setup: reminder was not stored");
    // The first reminder was approved: one copy already went out, a second is queued.
    await store.updatePendingCard("s1", first.id, { status: "approved" });
    await store.addOutbox("s1", { businessId: BUSINESS, cardId: first.id, channel: "email", to: "maya.chen@example.com", body: "sent", delivery: "sent" });
    await store.addOutbox("s1", { businessId: BUSINESS, cardId: first.id, channel: "email", to: "maya.chen@example.com", body: "queued", delivery: "queued" });

    expect(await store.cancelInvoiceReminders("s1", BUSINESS, "n:1042", "Not sent: invoice 1042 was paid.")).toEqual({ cards: 1, outbox: 1 });

    const cards = await byKey();
    expect(cards.get(`${BUSINESS}:nudger:1`)?.status).toBe("approved");
    expect(cards.get(`${BUSINESS}:nudger:2`)?.status).toBe("superseded");
    expect(cards.get(`${BUSINESS}:nudger:3`)?.status).toBe("pending");
    expect(cards.get(`${BUSINESS}:other`)?.status).toBe("pending");
    const outbox = await store.listOutbox("s1", BUSINESS);
    expect(outbox.map((entry) => [entry.body, entry.delivery, entry.note])).toEqual(
      expect.arrayContaining([
        ["sent", "sent", null],
        ["queued", "failed", "Not sent: invoice 1042 was paid."],
      ]),
    );
  });

  it("touches no other session", async () => {
    const store = new MemoryStore();
    await store.ensureCards("s1", BUSINESS, [reminder(1, "n:1042")]);
    expect(await store.cancelInvoiceReminders("s2", BUSINESS, "n:1042", "paid")).toEqual({ cards: 0, outbox: 0 });
    expect((await store.listCards("s1", BUSINESS))[0]?.status).toBe("pending");
  });
});

describe("an id another session owns", () => {
  it("refuses to save that business or intake, and leaves the owner's copy alone", async () => {
    const store = new MemoryStore();
    const business = profileFromFacts({ name: "Apex Heating", trade: "HVAC", tradeKey: "home", reach: [], tools: [], signals: [] });
    const draft = { facts: { reach: [], tools: [], signals: [], languages: [] }, settled: [], followUp: null, followUps: 0, review: { stage: "confirmed" as const } };
    await store.saveBusiness("s1", business);
    await store.saveIntake("s1", { id: "intake-1", draft, businessId: null });

    await expect(store.saveBusiness("s2", { ...business, name: "Taken" })).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(store.saveIntake("s2", { id: "intake-1", draft, businessId: business.id })).rejects.toMatchObject({ name: "NotFoundError" });

    expect((await store.getBusiness("s1", business.id))?.name).toBe("Apex Heating");
    expect((await store.getIntake("s1", "intake-1"))?.businessId).toBeNull();
    expect(await store.listBusinesses("s2")).toEqual([]);
  });
});

describe("findIntakeByBusiness", () => {
  it("finds the onboarding chat that built a business, in this session only", async () => {
    const store = new MemoryStore();
    const draft = { facts: { reach: [], tools: [], signals: [], languages: [] }, settled: [], followUp: null, followUps: 0, review: { stage: "confirmed" as const } };
    await store.saveIntake("s1", { id: "intake-1", draft, businessId: null });
    await store.saveIntake("s1", { id: "intake-2", draft, businessId: BUSINESS });
    expect((await store.findIntakeByBusiness("s1", BUSINESS))?.id).toBe("intake-2");
    expect(await store.findIntakeByBusiness("s1", "other")).toBeNull();
    expect(await store.findIntakeByBusiness("s2", BUSINESS)).toBeNull();
  });
});

describe("listPostPlaybook", () => {
  it("returns the niche's rows plus the ones for every business, and nothing for another niche", async () => {
    const playbook = await new MemoryStore().listPostPlaybook("restaurant");
    const ids = playbook.formats.map((f) => f.id);
    expect(ids).toContain("dish-spotlight");
    expect(ids).toContain("behind-the-scenes");
    expect(ids).not.toContain("signs-you-need");
    expect(playbook.hashtags.every((h) => h.niches.includes("restaurant") || h.niches.includes("any"))).toBe(true);
  });
});

describe("photos", () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);

  it("saves a photo and returns it only to its own session and business", async () => {
    const store = new MemoryStore();
    const photo = await store.savePhoto("a", "biz-1", bytes, "image/jpeg");
    expect(photo).toMatchObject({ businessId: "biz-1", contentType: "image/jpeg", size: 6 });
    expect((await store.getPhoto("a", "biz-1", photo.id))?.data).toEqual(bytes);
    expect(await store.getPhoto("b", "biz-1", photo.id)).toBeNull();
    expect(await store.getPhoto("a", "biz-2", photo.id)).toBeNull();
  });

  it("forgets a session's photos on reset", async () => {
    const store = new MemoryStore();
    const photo = await store.savePhoto("a", "biz-1", bytes, "image/jpeg");
    await store.reset("a");
    expect(await store.getPhoto("a", "biz-1", photo.id)).toBeNull();
  });
});
