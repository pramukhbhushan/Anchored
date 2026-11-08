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
  vi.unstubAllEnvs();
});

/** Post a Twilio webhook for `event`, signed with `token` unless told otherwise. */
function fromTwilio(event: "sms" | "voice", fields: Record<string, string>, token = TOKEN, hookId = TEXT_HOOK) {
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

  it("refuses a stale or wrongly signed event, and ignores other events", async () => {
    expect((await fromStripe(OVERDUE, Math.floor(Date.now() / 1000) - 3600)).status).toBe(400);
    expect((await fromStripe(OVERDUE, undefined, "whsec_wrongsecret")).status).toBe(400);
    expect(await (await fromStripe({ type: "customer.created", data: { object: {} } })).json()).toEqual({ received: true, drafted: false });
    expect(await cardTitles()).toEqual([]);
  });
});

describe("forwarded email", () => {
  function forward(key: string, mailbox = MAIL_HOOK) {
    const request = new Request(`http://localhost/api/hooks/email?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ From: "pat@example.com", FromName: "Pat", Subject: "Quote for a new AC", TextBody: "Can you send a quote?", MailboxHash: mailbox }),
    });
    return email.POST(request);
  }

  it("hands a forwarded email to Inbox Triage", async () => {
    expect(await (await forward("inbound-key")).json()).toEqual({ received: true, drafted: true });
    expect(await cardTitles()).toEqual(["Forwarded email from Pat <pat@example.com>: Quote for a new AC"]);
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
});

describe("the scheduled sender", () => {
  it("needs CRON_SECRET as a bearer token", async () => {
    expect((await cron.GET(new Request("http://localhost/api/cron/dispatch"))).status).toBe(404);
    const response = await cron.GET(new Request("http://localhost/api/cron/dispatch", { headers: { authorization: "Bearer cron-key" } }));
    expect(await response.json()).toMatchObject({ ok: true, sent: 0 });
  });
});
