import { describe, expect, it } from "vitest";
import { profileFromFacts } from "@/lib/domain/engine";
import type { KeyedCard } from "@/lib/domain/types";
import { MemoryStore } from "./memory";
import { NotFoundError } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `MemoryStore` that the server relies on: the pending-only card
// update, the shared daily AI call cap, the bound on how many sessions it keeps,
// profile versions, replaced drafts, and the Telegram links, chats and deliveries.

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
    const toChat = (n: number): KeyedCard => ({ ...card, key: `${BUSINESS}:tg:${n}`, channel: "telegram", contact: "chat-7" });
    await store.ensureCards("s1", BUSINESS, [toChat(1), toChat(2), { ...card, key: `${BUSINESS}:other`, contact: "chat-9" }]);
    const [one] = await store.listCards("s1", BUSINESS);
    if (!one) throw new Error("test setup: card was not stored");
    await store.updatePendingCard("s1", one.id, { status: "approved" });
    await store.ensureCards("s1", BUSINESS, [toChat(3)]);

    expect(await store.supersedePendingCards("s1", BUSINESS, "chat-7", `${BUSINESS}:tg:3`)).toBe(1);

    const byKey = new Map((await store.listCards("s1", BUSINESS)).map((c) => [c.key, c.status]));
    expect(byKey.get(`${BUSINESS}:tg:1`)).toBe("approved");
    expect(byKey.get(`${BUSINESS}:tg:2`)).toBe("superseded");
    expect(byKey.get(`${BUSINESS}:tg:3`)).toBe("pending");
    expect(byKey.get(`${BUSINESS}:other`)).toBe("pending");
  });
});

describe("Telegram links and conversations", () => {
  const chat = { channel: "telegram", contact: "chat-7", businessId: BUSINESS, displayName: "Sam", owner: "frontdesk", optedOut: false, updatedAt: "2026-11-07T15:00:00Z" } as const;

  it("reuses one link code per business and resolves it to its session", async () => {
    const store = new MemoryStore();
    const code = await store.ensureChannelLink("s1", BUSINESS, "telegram");

    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await store.ensureChannelLink("s1", BUSINESS, "telegram")).toBe(code);
    expect(await store.resolveChannelLink(code)).toEqual({ session: "s1", value: { businessId: BUSINESS, channel: "telegram" } });
    expect(await store.resolveChannelLink("not-a-code")).toBeNull();
  });

  it("binds a chat to one session at a time, and only that session can change it", async () => {
    const store = new MemoryStore();
    await store.bindConversation("s1", chat);

    expect(await store.updateConversation("s2", "telegram", "chat-7", { optedOut: true })).toBeNull();
    expect((await store.updateConversation("s1", "telegram", "chat-7", { owner: "followup" }))?.owner).toBe("followup");

    // A start link from another business moves the chat there.
    await store.bindConversation("s2", { ...chat, businessId: "b_other" });
    expect(await store.getConversation("s1", "telegram", "chat-7")).toBeNull();
    expect((await store.findConversation("telegram", "chat-7"))?.session).toBe("s2");
  });

  it("lists due Telegram entries until each is delivered or refused", async () => {
    const store = new MemoryStore();
    const base = { businessId: BUSINESS, channel: "telegram", to: "Sam", body: "Hi", contact: "chat-7" } as const;
    const now = await store.addOutbox("s1", { ...base, cardId: "c1", sentAt: "2026-11-07T15:00:00Z" });
    await store.addOutbox("s1", { ...base, cardId: "c2", sentAt: "2026-11-08T13:00:00Z" });
    const refused = await store.addOutbox("s1", { ...base, cardId: "c3", sentAt: "2026-11-07T14:00:00Z" });
    await store.addOutbox("s1", { ...base, channel: "sms", cardId: "c4", sentAt: "2026-11-07T14:00:00Z" });
    await store.markDelivered("s1", refused.id, { error: "Telegram didn't take this message." });

    const due = await store.listUndelivered(new Date("2026-11-07T16:00:00Z"), 10);
    expect(due.map((d) => [d.session, d.value.cardId])).toEqual([["s1", "c1"]]);

    await store.markDelivered("s1", now.id, { deliveredAt: "2026-11-07T16:00:01Z" });
    expect(await store.listUndelivered(new Date("2026-11-07T16:00:00Z"), 10)).toEqual([]);
    await expect(store.markDelivered("s2", now.id, { deliveredAt: "2026-11-07T16:00:01Z" })).rejects.toThrow(NotFoundError);
  });

  it("forgets a session's links and chats on reset", async () => {
    const store = new MemoryStore();
    const code = await store.ensureChannelLink("s1", BUSINESS, "telegram");
    await store.bindConversation("s1", chat);

    await store.reset("s1");

    expect(await store.resolveChannelLink(code)).toBeNull();
    expect(await store.findConversation("telegram", "chat-7")).toBeNull();
  });
});
