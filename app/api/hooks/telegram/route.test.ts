import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardRecord } from "@/lib/api/contract";
import { decideCard, queueAcknowledgment } from "@/lib/server/decide";
import { dispatchEntry } from "@/lib/server/dispatch";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The shared Telegram bot's webhook, as Telegram calls it, against the memory
// store and a fake Telegram API. A call without the secret changes nothing.
// /start binds the chat and confirms the business; a message joins the thread
// and becomes one reply card, once, however often Telegram retries; the owner's
// approval queues it and the dispatcher sends it into the chat. /stop and a
// block stop every later send, allergy and billing questions reach the owner
// with no draft, and a chat that opened another business's link gets nothing
// from the first one.

const SESSION = "owner-session";
const SHOP = hvacShop();
const HOOK = "h".repeat(24);
const SECRET = "telegram-webhook-secret";
const ENV = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_BOT_USERNAME: "AnchoredBot", TELEGRAM_WEBHOOK_SECRET: SECRET };
// 10 a.m. in New York, inside sending hours.
const DAYTIME = new Date("2026-11-09T15:00:00Z");

const state = vi.hoisted(() => ({ store: null as MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const route = await import("./route");

/** The fake Telegram API: every call it got, and the message ids it handed out. */
const telegram = {
  calls: [] as { method: string; body: Record<string, unknown> }[],
  status: 200,
  reset() {
    this.calls = [];
    this.status = 200;
  },
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const method = url.split("/").at(-1) ?? "";
    this.calls.push({ method, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    if (this.status !== 200) return new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }), { status: this.status });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 100 + this.calls.length } }), { status: 200 });
  },
};

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

let nextUpdate = 1;

/** Post one update to the webhook with the secret header, unless told to leave it off. */
function post(update: Record<string, unknown>, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-telegram-bot-api-secret-token"] = secret;
  return route.POST(new Request("http://localhost/api/hooks/telegram", { method: "POST", headers, body: JSON.stringify(update) }));
}

/** A private-chat message update from `chatId`, with a fresh update id unless one is given. */
function message(chatId: number, text: string, updateId = nextUpdate++) {
  return { update_id: updateId, message: { message_id: 1, chat: { id: chatId, type: "private" }, from: { first_name: "Dana", last_name: "Ruiz" }, text } };
}

/** A block or unblock update from `chatId`. */
function member(chatId: number, status: "kicked" | "member") {
  return { update_id: nextUpdate++, my_chat_member: { chat: { id: chatId, type: "private" }, new_chat_member: { status } } };
}

async function cards(): Promise<CardRecord[]> {
  return store().listCards(SESSION, SHOP.id);
}

async function contactFor(chatId: number) {
  return (await store().listContacts(SESSION, SHOP.id)).find((contact) => contact.telegramChatId === String(chatId));
}

/** Approve `card` in the daytime and send what it queued, as the scheduled sender would. */
async function approveAndSend(card: CardRecord) {
  const decided = await decideCard(store(), SESSION, card, { decision: "approve" }, DAYTIME);
  if (!decided.ok) throw new Error(decided.error);
  const entry = decided.response.outbox;
  if (entry === undefined) throw new Error("test setup: nothing was queued");
  const outcome = await dispatchEntry(store(), SESSION, entry.id, DAYTIME, { fetch: telegram.fetch.bind(telegram), env: ENV });
  return { entry, outcome };
}

beforeEach(async () => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.stubGlobal("fetch", telegram.fetch.bind(telegram));
  telegram.reset();
  state.store = new MemoryStore();
  await store().saveBusiness(SESSION, SHOP);
  // The business lets Anchored draft its lead replies, so Inquiry Responder answers customers.
  await store().setChoice(SESSION, SHOP.id, "leads", { path: "build", skills: ["inquiry"] });
  await store().telegramHook(SESSION, SHOP.id, HOOK);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the webhook secret", () => {
  it("refuses a call without the right secret and changes nothing", async () => {
    expect((await post(message(1001, `/start ${HOOK}`), null)).status).toBe(404);
    expect((await post(message(1001, `/start ${HOOK}`), "wrong")).status).toBe(404);
    expect(await store().findTelegramChat("1001")).toBeNull();
    expect(telegram.calls).toEqual([]);
  });

  it("refuses every call when the server has no secret set", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    expect((await post(message(1001, `/start ${HOOK}`))).status).toBe(404);
  });

  it("answers 400 to a body that isn't an update", async () => {
    expect((await post({ hello: "world" })).status).toBe(400);
  });
});

describe("/start", () => {
  it("binds the chat to the business, saves the customer with their OK, and confirms who they're talking to", async () => {
    const response = await post(message(1002, `/start ${HOOK}`));

    expect(response.status).toBe(200);
    const contact = await contactFor(1002);
    expect(contact).toMatchObject({ name: "Dana Ruiz", phone: null, email: null, consent: { source: "messaged-first" }, optedOutAt: null });
    expect(await store().findTelegramChat("1002")).toMatchObject({ session: SESSION, businessId: SHOP.id, contactId: contact?.id });
    expect(telegram.calls).toEqual([{ method: "sendMessage", body: expect.objectContaining({ chat_id: "1002", text: expect.stringContaining(SHOP.name) }) }]);
    const [notice] = await store().listOutbox(SESSION, SHOP.id);
    expect(notice).toMatchObject({ cardId: null, rule: "protocol", delivery: "sent" });
  });

  it("does nothing for an unknown or missing hook id, and never replies on its own", async () => {
    await post(message(1003, `/start ${"x".repeat(24)}`));
    await post(message(1003, "/start"));
    expect(await store().findTelegramChat("1003")).toBeNull();
    expect(telegram.calls).toEqual([]);
  });
});

describe("a customer's message", () => {
  // The acknowledgment has its own tests below; off here, each test sees only what it covers.
  beforeEach(() => store().setStandingRule(SESSION, SHOP.id, "acknowledge", false, DAYTIME.toISOString()));

  it("joins their thread and becomes one reply card for the owner, with no AI set up", async () => {
    await post(message(1004, `/start ${HOOK}`));
    await post(message(1004, "Do you do weekend furnace tune-ups?"));

    const contact = await contactFor(1004);
    if (contact === undefined) throw new Error("test setup: no contact");
    const [card] = (await cards()).filter((c) => c.channel === "telegram");
    expect(card).toMatchObject({ skill: "inquiry", status: "pending", to: "Dana Ruiz", contact: contact.id, action: "Send on Telegram" });
    expect(card?.body).toContain(SHOP.name);
    expect(card?.reason).toContain("weekend furnace tune-ups");
    const thread = await store().listThreadMessages(SESSION, SHOP.id, contact.id, 10);
    // The bot's /start confirmation went into the chat first, so it is on the thread too.
    expect(thread).toEqual([
      expect.objectContaining({ direction: "out", text: expect.stringContaining("You're now messaging"), cardKey: null }),
      expect.objectContaining({ direction: "in", text: "Do you do weekend furnace tune-ups?", cardKey: card?.key }),
    ]);
  });

  it("processes a retried update once", async () => {
    await post(message(1005, `/start ${HOOK}`));
    const update = message(1005, "Are you open Sunday?");
    expect(await (await post(update)).json()).toMatchObject({ outcome: "drafted" });
    expect(await (await post(update)).json()).toMatchObject({ duplicate: true });
    expect((await cards()).filter((c) => c.channel === "telegram")).toHaveLength(1);
  });

  it("replaces the older waiting reply when the customer writes again", async () => {
    await post(message(1006, `/start ${HOOK}`));
    await post(message(1006, "Hi, are you open today?"));
    await post(message(1006, "Actually, tomorrow?"));
    const statuses = (await cards()).filter((c) => c.channel === "telegram").map((c) => c.status);
    expect(statuses).toEqual(["superseded", "pending"]);
  });

  it("locks an allergy question for the owner with no drafted answer", async () => {
    await post(message(1007, `/start ${HOOK}`));
    await post(message(1007, "Is your shop dog-friendly? My kid has a peanut allergy too"));
    const [card] = (await cards()).filter((c) => c.channel === "locked");
    expect(card).toMatchObject({ skill: "inquiry", title: expect.stringContaining("Allergy question") });
  });

  it("keeps an allergy lock in place when the customer writes again", async () => {
    await post(message(1018, `/start ${HOOK}`));
    await post(message(1018, "Any peanut products in your van?"));
    await post(message(1018, "Thanks!"));
    const statuses = (await cards()).filter((c) => c.title.includes("1018") || c.channel === "locked" || c.channel === "telegram").map((c) => [c.channel, c.status]);
    expect(statuses).toEqual([
      ["locked", "pending"],
      ["telegram", "pending"],
    ]);
  });

  it("hands a billing question to the owner with no amount", async () => {
    await post(message(1008, `/start ${HOOK}`));
    await post(message(1008, "I think I was billed twice"));
    const [card] = (await cards()).filter((c) => c.channel === "flag");
    // This business has no Bookkeeping, so the note sits under Inbox Triage, which every business runs.
    expect(card).toMatchObject({ skill: "triage", title: expect.stringContaining("Billing question") });
    expect(card?.body).not.toMatch(/\$\d/);
  });

  it("is ignored from a chat that never opened a business's link", async () => {
    expect(await (await post(message(1009, "hello?"))).json()).toMatchObject({ outcome: "unbound" });
    expect(await cards()).toEqual([]);
  });
});

describe("approving a reply", () => {
  // The acknowledgment has its own tests below; off here, each test sees only what it covers.
  beforeEach(() => store().setStandingRule(SESSION, SHOP.id, "acknowledge", false, DAYTIME.toISOString()));

  it("queues it for the customer and sends it into their chat, then adds it to the thread", async () => {
    await post(message(1010, `/start ${HOOK}`));
    await post(message(1010, "Do you service heat pumps?"));
    const [card] = (await cards()).filter((c) => c.channel === "telegram");
    if (card === undefined) throw new Error("test setup: no card");
    telegram.reset();

    const { entry, outcome } = await approveAndSend(card);

    expect(entry).toMatchObject({ channel: "telegram", to: "Dana Ruiz", delivery: "queued", contactId: card.contact });
    expect(outcome).toBe("sent");
    expect(telegram.calls).toEqual([{ method: "sendMessage", body: expect.objectContaining({ chat_id: "1010", text: card.body }) }]);
    expect(telegram.calls[0]?.body).not.toHaveProperty("parse_mode");
    const thread = await store().listThreadMessages(SESSION, SHOP.id, card.contact ?? "", 10);
    expect(thread.map((m) => m.direction)).toEqual(["out", "in", "out"]);
    expect(thread[2]).toMatchObject({ skill: "inquiry", cardKey: card.key, outboxId: entry.id, providerId: "101" });
  });

  it("goes out the moment it's approved, even late at night", async () => {
    await post(message(1011, `/start ${HOOK}`));
    await post(message(1011, "Do you service heat pumps?"));
    const [card] = (await cards()).filter((c) => c.channel === "telegram");
    if (card === undefined) throw new Error("test setup: no card");
    // 11 p.m. in New York: quiet hours hold texts, never a Telegram reply.
    const lateNight = new Date("2026-11-09T04:00:00Z");
    const decided = await decideCard(store(), SESSION, card, { decision: "approve" }, lateNight);
    expect(decided.ok && decided.response.blocked).toBeFalsy();
    expect(decided.ok && decided.response.outbox?.sentAt).toBe(lateNight.toISOString());
  });
});

describe("/stop and blocking the bot", () => {
  it("/stop records the opt-out, confirms it, and every later send is refused", async () => {
    await post(message(1012, `/start ${HOOK}`));
    await post(message(1012, "Do you service heat pumps?"));
    const [card] = (await cards()).filter((c) => c.channel === "telegram");
    if (card === undefined) throw new Error("test setup: no card");
    telegram.reset();

    await post(message(1012, "/stop"));
    expect((await contactFor(1012))?.optedOutAt).not.toBeNull();
    expect(telegram.calls).toEqual([{ method: "sendMessage", body: expect.objectContaining({ text: expect.stringContaining("won't get more messages") }) }]);

    telegram.reset();
    const decided = await decideCard(store(), SESSION, card, { decision: "approve" }, DAYTIME);
    expect(decided.ok && decided.response.outbox).toMatchObject({ delivery: "yours", note: expect.stringContaining("/stop") });
    expect(telegram.calls).toEqual([]);
  });

  it("a message after /stop reaches the owner as a note with no draft", async () => {
    await post(message(1013, `/start ${HOOK}`));
    await post(message(1013, "/stop"));
    await post(message(1013, "wait, one more question"));
    const [card] = (await cards()).filter((c) => c.channel === "flag");
    expect(card).toMatchObject({ skill: "inquiry", title: expect.stringContaining("after sending /stop") });
  });

  it("opening the link again restarts the conversation", async () => {
    await post(message(1014, `/start ${HOOK}`));
    await post(message(1014, "/stop"));
    await post(message(1014, `/start ${HOOK}`));
    expect((await contactFor(1014))?.optedOutAt).toBeNull();
  });

  it("blocking the bot stops sends already approved", async () => {
    await post(message(1015, `/start ${HOOK}`));
    await post(message(1015, "Do you service heat pumps?"));
    const [card] = (await cards()).filter((c) => c.channel === "telegram");
    if (card === undefined) throw new Error("test setup: no card");
    const decided = await decideCard(store(), SESSION, card, { decision: "approve" }, DAYTIME);
    await post(member(1015, "kicked"));
    telegram.reset();

    const entry = decided.ok ? decided.response.outbox : undefined;
    expect(await dispatchEntry(store(), SESSION, entry?.id ?? "", DAYTIME, { fetch: telegram.fetch.bind(telegram), env: ENV })).toBe("failed");
    expect(telegram.calls).toEqual([]);
    expect((await store().findTelegramChat("1015"))?.blockedAt).not.toBeNull();
  });

  it("a block Telegram reports on send is recorded, so later sends stop too", async () => {
    await post(message(1016, `/start ${HOOK}`));
    await post(message(1016, "Do you service heat pumps?"));
    const [card] = (await cards()).filter((c) => c.channel === "telegram");
    if (card === undefined) throw new Error("test setup: no card");
    telegram.reset();
    telegram.status = 403;

    expect((await approveAndSend(card)).outcome).toBe("failed");
    expect((await store().findTelegramChat("1016"))?.blockedAt).not.toBeNull();
  });
});

describe("another business's link", () => {
  it("a chat that switched businesses gets nothing more from the first one", async () => {
    const other = { ...hvacShop(), id: "other", name: "Bowie Plumbing" };
    await store().saveBusiness(SESSION, other);
    const otherHook = "o".repeat(24);
    await store().telegramHook(SESSION, other.id, otherHook);

    await post(message(1017, `/start ${HOOK}`));
    await post(message(1017, "Do you service heat pumps?"));
    const [card] = (await cards()).filter((c) => c.channel === "telegram");
    if (card === undefined) throw new Error("test setup: no card");
    await post(message(1017, `/start ${otherHook}`));
    telegram.reset();

    expect((await approveAndSend(card)).outcome).toBe("failed");
    expect(telegram.calls).toEqual([]);
    const [entry] = (await store().listOutbox(SESSION, SHOP.id)).filter((e) => e.cardId === card.id);
    expect(entry?.note).toContain("switched to another business's link");
  });
});

describe("the acknowledgment rule", () => {
  /** Turn the owner's acknowledgment rule on or off. */
  const setRule = (enabled: boolean) => store().setStandingRule(SESSION, SHOP.id, "acknowledge", enabled, DAYTIME.toISOString());
  const acks = async () => (await store().listOutbox(SESSION, SHOP.id)).filter((entry) => entry.rule === "acknowledge");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(DAYTIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the acknowledgment before the owner has touched the rule, since it starts on", async () => {
    await post(message(1100, `/start ${HOOK}`));
    telegram.reset();
    await post(message(1100, "Do you service heat pumps?"));
    expect(telegram.calls).toEqual([{ method: "sendMessage", body: expect.objectContaining({ text: `Thanks, ${SHOP.name} got your message and will reply soon.` }) }]);
  });

  it("sends nothing but the /start notice once the owner turns the rule off", async () => {
    await setRule(false);
    await post(message(1101, `/start ${HOOK}`));
    telegram.reset();
    await post(message(1101, "Do you service heat pumps?"));
    expect(telegram.calls).toEqual([]);
    expect(await acks()).toEqual([]);
  });

  it("once on, sends the fixed text at once, and only once per window however many messages arrive", async () => {
    await setRule(true);
    await post(message(1102, `/start ${HOOK}`));
    telegram.reset();
    await post(message(1102, "Do you service heat pumps?"));
    await post(message(1102, "And boilers?"));

    expect(telegram.calls).toEqual([{ method: "sendMessage", body: expect.objectContaining({ text: `Thanks, ${SHOP.name} got your message and will reply soon.` }) }]);
    expect(await acks()).toEqual([expect.objectContaining({ delivery: "sent", cardId: null })]);
    // The real answers still wait for the owner.
    expect((await cards()).filter((c) => c.channel === "telegram").map((c) => c.status)).toEqual(["superseded", "pending"]);
  });

  it("isn't sent for an allergy question or after /stop", async () => {
    await setRule(true);
    await post(message(1103, `/start ${HOOK}`));
    await post(message(1103, "Is there peanut oil in anything you use?"));
    await post(message(1103, "/stop"));
    await post(message(1103, "one more thing"));
    expect(await acks()).toEqual([]);
  });

  it("goes out at once even late at night", async () => {
    // 11 p.m. in New York: quiet hours hold texts, never a Telegram reply.
    vi.setSystemTime(new Date("2026-11-09T04:00:00Z"));
    await post(message(1104, `/start ${HOOK}`));
    telegram.reset();
    await post(message(1104, "Are you open tomorrow?"));
    expect((await acks())[0]).toMatchObject({ delivery: "sent" });
    expect(telegram.calls).toEqual([{ method: "sendMessage", body: expect.objectContaining({ text: `Thanks, ${SHOP.name} got your message and will reply soon.` }) }]);
  });

  /** Queue an acknowledgment for the chat's customer without sending it, as when Telegram asked us to retry later. */
  async function queuedAck(chatId: number) {
    await post(message(chatId, `/start ${HOOK}`));
    const [contact] = await store().listContacts(SESSION, SHOP.id);
    if (contact === undefined) throw new Error("test setup: no contact");
    const entry = await queueAcknowledgment(store(), SESSION, { business: SHOP, contact, at: DAYTIME });
    if (entry === null) throw new Error("test setup: nothing queued");
    return entry;
  }

  it("turning the rule off cancels one still waiting to send", async () => {
    await queuedAck(1106);
    const { setAcknowledgment } = await import("@/lib/server/standing-rules");
    await setAcknowledgment(SESSION, SHOP, false);
    expect((await acks())[0]).toMatchObject({ delivery: "failed", note: expect.stringContaining("turned off") });
  });

  it("isn't sent when the rule was turned off after it was queued", async () => {
    const queued = await queuedAck(1105);
    // Turned off behind the API's back, so only the dispatcher's own check stands in the way.
    await store().setStandingRule(SESSION, SHOP.id, "acknowledge", false, DAYTIME.toISOString());
    telegram.reset();
    expect(await dispatchEntry(store(), SESSION, queued.id, DAYTIME, { fetch: telegram.fetch.bind(telegram), env: ENV })).toBe("failed");
    expect(telegram.calls).toEqual([]);
  });
});
