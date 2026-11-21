import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { twilioSignature } from "@/lib/connectors/twilio";
import { encryptSecret } from "@/lib/server/secrets";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The signed webhooks, as each provider calls them. A customer's text becomes a
// reply draft and records their OK to get a reply; STOP records their opt-out
// and drafts nothing; a missed call becomes a callback draft and the caller
// hears a short message; an unpaid Stripe invoice becomes a reminder draft; a
// forwarded email reaches Inbox Triage. A request with a bad signature, a wrong
// key or an unknown hook id changes nothing. The scheduled sender needs its secret.

const SESSION = "owner-session";
const SHOP = hvacShop();
const KEY = randomBytes(32).toString("base64");
const TOKEN = "twilio-auth-token";
const TEXT_HOOK = "t".repeat(24);
const STRIPE_HOOK = "s".repeat(24);
const MAIL_HOOK = "m".repeat(24);
const STRIPE_SECRET = "whsec_testsecret123";

const state = vi.hoisted(() => ({ store: null as MemoryStore | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));

const twilio = await import("./twilio/[hookId]/[event]/route");
const stripe = await import("./stripe/[hookId]/route");
const email = await import("./email/route");
const cron = await import("../cron/dispatch/route");

function store(): MemoryStore {
  if (state.store === null) throw new Error("test setup: no store");
  return state.store;
}

beforeEach(async () => {
  vi.stubEnv("CONNECTOR_SECRET_KEY", KEY);
  vi.stubEnv("PUBLIC_APP_URL", "https://anchored.test");
  vi.stubEnv("INBOUND_EMAIL_SECRET", "inbound-key");
  vi.stubEnv("CRON_SECRET", "cron-key");
  state.store = new MemoryStore();
  const s = store();
  await s.saveBusiness(SESSION, SHOP);
  // The front desk, payment reminders and triage are working, so each event has an agent to draft it.
  await s.setChoice(SESSION, SHOP.id, "calls", { path: "build", skills: ["callback"] });
  await s.setChoice(SESSION, SHOP.id, "leads", { path: "build", skills: ["inquiry"] });
  await s.setChoice(SESSION, SHOP.id, "books", { path: "build", skills: ["nudger"] });
  await s.saveConnection(SESSION, { businessId: SHOP.id, kind: "texting", hookId: TEXT_HOOK, settings: { phone: "+13015550100", accountSid: `AC${"0".repeat(32)}` }, secret: encryptSecret(JSON.stringify({ authToken: TOKEN }), { CONNECTOR_SECRET_KEY: KEY }) });
  await s.saveConnection(SESSION, { businessId: SHOP.id, kind: "stripe", hookId: STRIPE_HOOK, settings: {}, secret: encryptSecret(STRIPE_SECRET, { CONNECTOR_SECRET_KEY: KEY }) });
  await s.saveConnection(SESSION, { businessId: SHOP.id, kind: "email-in", hookId: MAIL_HOOK, settings: {}, secret: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Post a Twilio webhook for `event`, signed with `token` unless told otherwise. */
function fromTwilio(event: "sms" | "voice" | "voice-result", fields: Record<string, string>, token = TOKEN, hookId = TEXT_HOOK) {
  const url = `https://anchored.test/api/hooks/twilio/${hookId}/${event}`;
  const request = new Request(`http://localhost/api/hooks/twilio/${hookId}/${event}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": twilioSignature(token, url, fields) },
    body: new URLSearchParams(fields).toString(),
  });
  return twilio.POST(request, { params: Promise.resolve({ hookId, event }) });
}

async function cardTitles(): Promise<string[]> {
  return (await store().listCards(SESSION, SHOP.id)).map((card) => card.title);
}

describe("Twilio texts", () => {
  it("turns a customer's text into a reply draft and records their OK to get a reply", async () => {
    const response = await fromTwilio("sms", { From: "+13015550192", Body: "Is anyone free to look at my furnace today?" });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<Response></Response>");
    const [card] = await store().listCards(SESSION, SHOP.id);
    expect(card).toMatchObject({ title: "New text from +13015550192", channel: "sms", to: "+13015550192", status: "pending" });
    expect(card?.reason).toContain("furnace today");
    expect(await store().listContacts(SESSION, SHOP.id)).toMatchObject([{ phone: "+13015550192", consent: { source: "texted-first" }, optedOutAt: null }]);
  });

  it("records STOP and drafts nothing, then START opts them back in", async () => {
    await fromTwilio("sms", { From: "+13015550192", Body: "STOP" });

    expect(await cardTitles()).toEqual([]);
    expect((await store().listContacts(SESSION, SHOP.id))[0]?.optedOutAt).not.toBeNull();
    await fromTwilio("sms", { From: "+13015550192", Body: "start" });
    expect((await store().listContacts(SESSION, SHOP.id))[0]?.optedOutAt).toBeNull();
  });

  it("refuses a request with a bad signature or an unknown hook, and changes nothing", async () => {
    expect((await fromTwilio("sms", { From: "+13015550192", Body: "Hi" }, "wrong-token")).status).toBe(403);
    expect((await fromTwilio("sms", { From: "+13015550192", Body: "Hi" }, TOKEN, "x".repeat(24))).status).toBe(404);
    expect(await cardTitles()).toEqual([]);
    expect(await store().listContacts(SESSION, SHOP.id)).toEqual([]);
  });

  it("locks a text that asks about allergies for the owner to answer", async () => {
    await fromTwilio("sms", { From: "+13015550192", Body: "Does your cleaner have a peanut smell? My son is allergic" });

    expect((await store().listCards(SESSION, SHOP.id))[0]).toMatchObject({ channel: "locked" });
  });

  it("keeps only the newest reply pending when texts arrive quickly", async () => {
    await fromTwilio("sms", { From: "+13015550192", Body: "First question" });
    await fromTwilio("sms", { From: "+13015550192", Body: "Second question" });
    await fromTwilio("sms", { From: "+13015550192", Body: "Third question" });

    const cards = await store().listCards(SESSION, SHOP.id);
    expect(cards.filter((card) => card.status === "pending")).toHaveLength(1);
    expect(cards.filter((card) => card.status === "superseded")).toHaveLength(2);
    expect(cards.find((card) => card.status === "pending")?.reason).toContain("Third question");
  });
});

describe("Twilio calls", () => {
  it("answers a missed call with a short message, records nothing, and drafts a callback", async () => {
    const response = await fromTwilio("voice", { From: "+13015550177", CallStatus: "ringing" });

    const twiml = await response.text();
    expect(twiml).toContain("Sorry we missed your call at College Park Heating &amp; Air");
    expect(twiml).not.toMatch(/<Record|<Gather/);
    expect(await cardTitles()).toEqual(["Missed call from +13015550177"]);
    // A caller hasn't agreed to texts, so they are kept with no consent.
    expect((await store().listContacts(SESSION, SHOP.id))[0]).toMatchObject({ phone: "+13015550177", consent: null });
  });

  it("rings the owner for 20 seconds, then drafts only when the call was not answered", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T15:00:00Z"));
    await store().saveConnection(SESSION, {
      businessId: SHOP.id,
      kind: "texting",
      hookId: TEXT_HOOK,
      settings: { phone: "+13015550100", accountSid: `AC${"0".repeat(32)}`, forwardTo: "+13015550101" },
      secret: encryptSecret(JSON.stringify({ authToken: TOKEN }), { CONNECTOR_SECRET_KEY: KEY }),
    });

    const ringing = await fromTwilio("voice", { From: "+13015550177", CallStatus: "ringing" });
    const dial = await ringing.text();
    expect(dial).toContain('<Dial timeout="20"');
    expect(dial).toContain("<Number>+13015550101</Number>");
    expect(dial).toContain("/voice-result");
    expect(await cardTitles()).toEqual([]);

    await fromTwilio("voice-result", { From: "+13015550177", DialCallStatus: "no-answer" });
    expect(await cardTitles()).toEqual(["Missed call from +13015550177"]);
  });
});

/** Post a Stripe event, signed at `at` seconds. */
function fromStripe(event: unknown, at = Math.floor(Date.now() / 1000), secret = STRIPE_SECRET) {
  const payload = JSON.stringify(event);
  const signature = createHmac("sha256", secret).update(`${at}.${payload}`).digest("hex");
  const request = new Request(`http://localhost/api/hooks/stripe/${STRIPE_HOOK}`, { method: "POST", headers: { "stripe-signature": `t=${at},v1=${signature}` }, body: payload });
  return stripe.POST(request, { params: Promise.resolve({ hookId: STRIPE_HOOK }) });
}

const OVERDUE = {
  type: "invoice.overdue",
  data: { object: { customer_name: "Jordan Kim", customer_email: "jordan@example.com", amount_due: 24050, currency: "usd", number: "1042" } },
};

describe("Stripe", () => {
  it("drafts a reminder email for an overdue invoice", async () => {
    const response = await fromStripe(OVERDUE);

    expect(await response.json()).toEqual({ received: true, drafted: true });
    const [card] = await store().listCards(SESSION, SHOP.id);
    expect(card).toMatchObject({ title: "Jordan Kim owes $240.50 on invoice 1042", channel: "email", to: "jordan@example.com", stake: 240.5 });
    expect(card?.body).toContain("invoice 1042 from College Park Heating & Air for $240.50 is now past due");
  });

  it("drafts one card for an event Stripe retries or someone replays", async () => {
    const event = { id: "evt_1QxYzReplay", ...OVERDUE };
    expect(await (await fromStripe(event)).json()).toEqual({ received: true, drafted: true });
    expect(await (await fromStripe(event)).json()).toEqual({ received: true, drafted: false });
    expect(await cardTitles()).toEqual(["Jordan Kim owes $240.50 on invoice 1042"]);

    expect(await (await fromStripe({ ...event, id: "evt_1QxYzOther" })).json()).toEqual({ received: true, drafted: true });
    expect(await cardTitles()).toHaveLength(2);
  });

  it("refuses a stale or wrongly signed event, and ignores other events", async () => {
    expect((await fromStripe(OVERDUE, Math.floor(Date.now() / 1000) - 3600)).status).toBe(400);
    expect((await fromStripe(OVERDUE, undefined, "whsec_wrongsecret")).status).toBe(400);
    expect(await (await fromStripe({ type: "customer.created", data: { object: {} } })).json()).toEqual({ received: true, drafted: false });
    expect(await cardTitles()).toEqual([]);
  });
});

describe("forwarded email", () => {
  function forward(key: string, mailbox = MAIL_HOOK, fields: Record<string, string> = {}) {
    const request = new Request(`http://localhost/api/hooks/email?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ From: "pat@example.com", FromName: "Pat", Subject: "Quote for a new AC", TextBody: "Can you send a quote?", MailboxHash: mailbox, ...fields }),
    });
    return email.POST(request);
  }

  it("files a customer's email under the agent that answers customers", async () => {
    expect(await (await forward("inbound-key")).json()).toEqual({ received: true, drafted: true });
    const [card] = await store().listCards(SESSION, SHOP.id);
    expect(card).toMatchObject({ title: "Customer email from Pat <pat@example.com>: Quote for a new AC", skill: "inquiry", channel: "list" });
  });

  it("files a billing email under Payment Nudger and states no amount", async () => {
    await forward("inbound-key", MAIL_HOOK, { Subject: "Invoice 1042 is past due", TextBody: "Your balance is $240.50" });
    const [card] = await store().listCards(SESSION, SHOP.id);
    expect(card).toMatchObject({ skill: "nudger", title: expect.stringContaining("Billing email") });
    expect(card?.reason).toContain("no amount");
  });

  it("gives the owner an email no agent of theirs handles", async () => {
    await forward("inbound-key", MAIL_HOOK, { Subject: "New price list from Ferguson", TextBody: "Prices change next month." });
    await forward("inbound-key", MAIL_HOOK, { Subject: "Hello", TextBody: "Lunch next week?" });
    const cards = await store().listCards(SESSION, SHOP.id);
    expect(cards.map((card) => [card.skill, card.title.split(" from ")[0]])).toEqual([
      ["triage", "Supplier email"],
      ["triage", "Forwarded email"],
    ]);
    expect(cards[0]?.reason).toContain("None of your agents handles this kind of email");
  });

  it("makes one card for an email Postmark delivers twice", async () => {
    await forward("inbound-key", MAIL_HOOK, { MessageID: "abc-123" });
    await forward("inbound-key", MAIL_HOOK, { MessageID: "abc-123" });
    expect(await cardTitles()).toHaveLength(1);
  });

  it("sends nothing to anyone", async () => {
    await forward("inbound-key");
    expect(await store().listOutbox(SESSION, SHOP.id)).toEqual([]);
  });

  it("shows the email's own words and promises no draft that nothing will write", async () => {
    await forward("inbound-key");
    const [card] = await store().listCards(SESSION, SHOP.id);
    expect(card?.body).toContain("Can you send a quote?");
    expect(card?.body).not.toMatch(/will draft|will compare/);
  });

  it("refuses the wrong key and drops mail for no business", async () => {
    expect((await forward("guess")).status).toBe(404);
    expect(await (await forward("inbound-key", "n".repeat(24))).json()).toEqual({ received: true, drafted: false });
    expect(await cardTitles()).toEqual([]);
  });

  it("answers 400 to a body that isn't JSON, so Postmark stops retrying it", async () => {
    const request = new Request("http://localhost/api/hooks/email?key=inbound-key", { method: "POST", headers: { "content-type": "application/json" }, body: "not json" });
    expect((await email.POST(request)).status).toBe(400);
    expect(await cardTitles()).toEqual([]);
  });
});

describe("the scheduled sender", () => {
  it("needs CRON_SECRET as a bearer token", async () => {
    expect((await cron.GET(new Request("http://localhost/api/cron/dispatch"))).status).toBe(404);
    const response = await cron.GET(new Request("http://localhost/api/cron/dispatch", { headers: { authorization: "Bearer cron-key" } }));
    expect(await response.json()).toMatchObject({ ok: true, sent: 0 });
  });
});
