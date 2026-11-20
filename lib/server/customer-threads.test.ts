import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import type { NewThreadMessage } from "@/lib/domain/threads";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The Customer agent's conversation read: Telegram customers newest first,
// with stop and allergy-lock state, one thread with each send's outcome, no
// other business's or session's customer ever selectable, and the shared
// example with no conversations at all.

const state = vi.hoisted(() => ({ store: null as import("@/lib/store/memory").MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const { customerThreads } = await import("./customer-threads");

const SESSION = "owner";
const SHOP = hvacShop();

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

/** Save a Telegram customer and return their id. */
async function customer(name: string, chatId: string, optedOutAt: string | null = null): Promise<string> {
  const saved = await store().saveContact(SESSION, { businessId: SHOP.id, name, phone: null, email: null, consent: { source: "messaged-first", at: "2026-11-08T10:00:00Z" }, optedOutAt, telegramChatId: chatId });
  return saved.id;
}

/** Add a message to a customer's thread. */
function say(contactId: string, text: string, at: string, extra: Partial<NewThreadMessage> = {}) {
  return store().addThreadMessage(SESSION, { businessId: SHOP.id, contactId, direction: "in", text, skill: null, cardKey: null, outboxId: null, providerId: null, at, ...extra });
}

beforeEach(async () => {
  state.store = new MemoryStore();
  await store().saveBusiness(SESSION, SHOP);
});

describe("customerThreads", () => {
  it("lists Telegram customers newest conversation first, with their stop state, and opens the newest", async () => {
    const dana = await customer("Dana", "1");
    const sam = await customer("Sam", "2", "2026-11-08T12:00:00Z");
    await store().saveContact(SESSION, { businessId: SHOP.id, name: "Phone only", phone: "+13015550192", email: null, consent: null, optedOutAt: null });
    await say(dana, "Morning question", "2026-11-08T09:00:00Z");
    await say(sam, "Afternoon question", "2026-11-08T15:00:00Z");

    const result = await customerThreads(SESSION, SHOP, null);
    expect(result.contacts).toEqual([
      { id: sam, name: "Sam", lastText: "Afternoon question", lastAt: "2026-11-08T15:00:00Z", stopped: true, locked: false },
      { id: dana, name: "Dana", lastText: "Morning question", lastAt: "2026-11-08T09:00:00Z", stopped: false, locked: false },
    ]);
    expect(result.selectedContactId).toBe(sam);
  });

  it("shows each sent message's outcome, and keeps the provider's id out", async () => {
    const dana = await customer("Dana", "1");
    const entry = await store().addOutbox(SESSION, { businessId: SHOP.id, cardId: null, channel: "telegram", to: "Dana", contactId: dana, body: "Thanks!", rule: "acknowledge", delivery: "queued" });
    await store().settleOutbox(SESSION, entry.id, { delivery: "sent", providerId: "tg-msg-quokka" });
    await say(dana, "Hi", "2026-11-08T09:00:00Z", { cardKey: "k1" });
    await say(dana, "Thanks!", "2026-11-08T09:00:01Z", { direction: "out", outboxId: entry.id, providerId: "tg-msg-quokka" });

    const { messages } = await customerThreads(SESSION, SHOP, dana);
    expect(messages.map(({ id: _id, ...message }) => message)).toEqual([
      { direction: "in", text: "Hi", at: "2026-11-08T09:00:00Z", cardKey: "k1" },
      { direction: "out", text: "Thanks!", at: "2026-11-08T09:00:01Z", delivery: "sent", rule: "acknowledge" },
    ]);
    expect(JSON.stringify(messages)).not.toContain("tg-msg-quokka");
  });

  it("marks a customer whose allergy question waits for the owner", async () => {
    const dana = await customer("Dana", "1");
    await store().ensureCards(SESSION, SHOP.id, [{ key: "lock-1", agent: "frontdesk", skill: "inquiry", title: "Allergy question", body: "", reason: "", checks: [], action: "I'll handle it", channel: "locked" }]);
    await say(dana, "Any peanuts?", "2026-11-08T09:00:00Z", { cardKey: "lock-1" });
    expect((await customerThreads(SESSION, SHOP, null)).contacts[0]?.locked).toBe(true);
  });

  it("selects nobody for a customer who isn't this business's, and never another session's", async () => {
    await customer("Dana", "1");
    const theirs = await store().saveContact("other-session", { businessId: SHOP.id, name: "Stranger", phone: null, email: null, consent: null, optedOutAt: null, telegramChatId: "9" });
    const result = await customerThreads(SESSION, SHOP, theirs.id);
    expect(result.selectedContactId).toBeNull();
    expect(result.messages).toEqual([]);
    expect(result.contacts.map((c) => c.name)).toEqual(["Dana"]);
  });

  it("gives the shared example no conversations", async () => {
    expect(await customerThreads(SESSION, SAMPLE_BUSINESS, null)).toMatchObject({ contacts: [], selectedContactId: null, unavailableReason: expect.stringContaining("shared example") });
  });
});
