import { describe, expect, it } from "vitest";
import { profileFromFacts } from "@/lib/domain/engine";
import type { KeyedCard } from "@/lib/domain/types";
import { MemoryStore } from "./memory";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `MemoryStore` that the server relies on: the pending-only card
// update, the shared daily AI call cap, the bound on how many sessions it keeps,
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

describe("retained events and conversation ownership", () => {
  it("keeps raw event payloads scoped to the business", async () => {
    const store = new MemoryStore();
    await store.recordEvent("s1", BUSINESS, "onboarding_raw", { sentence: "I run a bakery" });
    await store.recordEvent("s1", "other", "text", { body: "hello" });

    expect(await store.listEvents("s1", BUSINESS)).toMatchObject([
      { businessId: BUSINESS, source: "onboarding_raw", payload: { sentence: "I run a bakery" } },
    ]);
  });

  it("starts a conversation at Front Desk and saves a handoff", async () => {
    const store = new MemoryStore();

    expect(await store.getConversationOwner("s1", BUSINESS, "contact-1")).toBe("frontdesk");
    await store.setConversationOwner("s1", BUSINESS, "contact-1", "followup", "2026-11-08T12:00:00Z");
    expect(await store.getConversationOwner("s1", BUSINESS, "contact-1")).toBe("followup");
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

describe("Telegram hook ids", () => {
  it("saves the first candidate, keeps it, and finds the business by it from any session", async () => {
    const store = new MemoryStore();
    const business = await store.saveBusiness("s1", profileFromFacts({ name: "Apex Heating", trade: "HVAC", tradeKey: "home", reach: [], tools: [], signals: [] }));

    expect(await store.telegramHook("s1", business.id, "firsthookid0000000000000")).toBe("firsthookid0000000000000");
    expect(await store.telegramHook("s1", business.id, "secondhookid000000000000")).toBe("firsthookid0000000000000");
    expect(await store.findTelegramHook("firsthookid0000000000000")).toEqual({ session: "s1", businessId: business.id });
    expect(await store.findTelegramHook("secondhookid000000000000")).toBeNull();
  });

  it("refuses a business the session doesn't own", async () => {
    const store = new MemoryStore();
    const business = await store.saveBusiness("s1", profileFromFacts({ name: "Apex Heating", trade: "HVAC", tradeKey: "home", reach: [], tools: [], signals: [] }));
    await expect(store.telegramHook("s2", business.id, "x".repeat(24))).rejects.toThrow(/not found/);
  });
});

describe("Telegram chats", () => {
  const chat = { chatId: "5551234567", businessId: BUSINESS, contactId: "c1", boundAt: "2026-11-08T10:00:00.000Z" };

  it("binds a chat to the latest business and clears a block on rebinding", async () => {
    const store = new MemoryStore();
    await store.bindTelegramChat("s1", chat);
    await store.setTelegramChatBlocked(chat.chatId, "2026-11-08T11:00:00.000Z");
    expect((await store.findTelegramChat(chat.chatId))?.blockedAt).toBe("2026-11-08T11:00:00.000Z");

    await store.bindTelegramChat("s2", { ...chat, businessId: "b_other", contactId: "c9" });
    expect(await store.findTelegramChat(chat.chatId)).toEqual({ ...chat, session: "s2", businessId: "b_other", contactId: "c9", blockedAt: null });
  });

  it("forgets a chat once its session is reset", async () => {
    const store = new MemoryStore();
    await store.bindTelegramChat("s1", chat);
    await store.reset("s1");
    expect(await store.findTelegramChat(chat.chatId)).toBeNull();
  });
});

describe("claimTelegramUpdate", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 10, 8, 12, minutes)).toISOString();

  it("lets one caller process an update, and refuses repeats once it's done", async () => {
    const store = new MemoryStore();
    expect(await store.claimTelegramUpdate(7, at(0), 120_000)).toBe(true);
    expect(await store.claimTelegramUpdate(7, at(0), 120_000)).toBe(false);
    await store.finishTelegramUpdate(7, "done");
    expect(await store.claimTelegramUpdate(7, at(10), 120_000)).toBe(false);
  });

  it("lets a failed update, or one claimed long ago and never finished, be claimed again", async () => {
    const store = new MemoryStore();
    await store.claimTelegramUpdate(8, at(0), 120_000);
    await store.finishTelegramUpdate(8, "failed");
    expect(await store.claimTelegramUpdate(8, at(1), 120_000)).toBe(true);

    await store.claimTelegramUpdate(9, at(0), 120_000);
    expect(await store.claimTelegramUpdate(9, at(1), 120_000)).toBe(false);
    expect(await store.claimTelegramUpdate(9, at(2), 120_000)).toBe(true);
  });
});

describe("customer threads", () => {
  const message = (text: string, at: string, contactId = "c1") => ({
    businessId: BUSINESS,
    contactId,
    direction: "in" as const,
    text,
    skill: null,
    cardKey: null,
    outboxId: null,
    providerId: null,
    at,
  });

  it("returns the latest messages of one contact's thread, oldest first, in its own session only", async () => {
    const store = new MemoryStore();
    await store.addThreadMessage("s1", message("third", "2026-11-08T10:03:00.000Z"));
    await store.addThreadMessage("s1", message("first", "2026-11-08T10:01:00.000Z"));
    await store.addThreadMessage("s1", message("second", "2026-11-08T10:02:00.000Z"));
    await store.addThreadMessage("s1", message("other customer", "2026-11-08T10:02:30.000Z", "c2"));

    expect((await store.listThreadMessages("s1", BUSINESS, "c1", 10)).map((m) => m.text)).toEqual(["first", "second", "third"]);
    expect((await store.listThreadMessages("s1", BUSINESS, "c1", 2)).map((m) => m.text)).toEqual(["second", "third"]);
    expect(await store.listThreadMessages("s2", BUSINESS, "c1", 10)).toEqual([]);
  });
});

describe("standing rules", () => {
  it("start unsaved, keep the last approval when turned off, and stay in their session", async () => {
    const store = new MemoryStore();
    expect(await store.getStandingRules("s1", BUSINESS)).toEqual([]);

    await store.setStandingRule("s1", BUSINESS, "acknowledge", true, "2026-11-08T10:00:00.000Z");
    const off = await store.setStandingRule("s1", BUSINESS, "acknowledge", false, "2026-11-08T11:00:00.000Z");

    expect(off).toEqual({ rule: "acknowledge", enabled: false, approvedAt: "2026-11-08T10:00:00.000Z", changedAt: "2026-11-08T11:00:00.000Z" });
    expect(await store.getStandingRules("s1", BUSINESS)).toEqual([off]);
    expect(await store.getStandingRules("s1", "b_other")).toEqual([]);
    expect(await store.getStandingRules("s2", BUSINESS)).toEqual([]);
  });
});

describe("Telegram contacts", () => {
  it("keep one contact per chat per business, with no phone or email needed", async () => {
    const store = new MemoryStore();
    const base = { businessId: BUSINESS, name: "Dana", phone: null, email: null, consent: { source: "messaged-first" as const, at: "2026-11-08T10:00:00.000Z" }, optedOutAt: null, telegramChatId: "42" };
    const first = await store.saveContact("s1", base);
    const again = await store.saveContact("s1", { ...base, name: "Dana Ruiz", telegramName: "Dana Ruiz" });

    expect(again.id).toBe(first.id);
    expect(await store.listContacts("s1", BUSINESS)).toEqual([again]);
  });
});

describe("outbox entries a rule authorized", () => {
  it("keep their rule and need no card", async () => {
    const store = new MemoryStore();
    const entry = await store.addOutbox("s1", { businessId: BUSINESS, cardId: null, channel: "telegram", to: "42", body: "You're now messaging Apex.", rule: "protocol", delivery: "queued" });
    expect(entry).toMatchObject({ cardId: null, channel: "telegram", rule: "protocol", delivery: "queued" });
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
