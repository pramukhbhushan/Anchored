import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardRecord } from "@/lib/api/contract";
import type { FetchLike } from "@/lib/connectors/errors";
import type { Contact } from "@/lib/domain/contacts";
import type { KeyedCard } from "@/lib/domain/types";
import { decideCard } from "@/lib/server/decide";
import { dispatchDue, dispatchEntry } from "@/lib/server/dispatch";
import { encryptSecret } from "@/lib/server/secrets";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Sending, as an owner sees it: approve a text to a customer who agreed to
// texts and Anchored sends it from the owner's Twilio number; without consent,
// after a STOP, or with nothing connected, the owner sends it. Quiet hours hold
// a send, a refusal from Twilio is said plainly, and email goes out with the
// owner as reply-to. A fake `fetch` plays Twilio and the email service.

const SESSION = "owner-session";
const SHOP = hvacShop();
const NOON = new Date("2026-11-09T17:00:00Z");
const NIGHT = new Date("2026-11-10T03:00:00Z");
const DANA: Omit<Contact, "id"> = { businessId: SHOP.id, name: "Dana", phone: "+13015550192", email: null, consent: { source: "texted-first", at: "2026-11-08T15:00:00Z" }, optedOutAt: null };
const ENV = { CONNECTOR_SECRET_KEY: randomBytes(32).toString("base64"), RESEND_API_KEY: "re_test", EMAIL_FROM_ADDRESS: "drafts@mail.anchored.test" };

const TEXT: KeyedCard = {
  key: `${SHOP.id}:event:1`,
  agent: "frontdesk",
  skill: "callback",
  title: "Missed call from (301) 555-0192",
  body: "Sorry we missed you. Reply STOP to opt out.",
  reason: "Callers who wait often try someone else.",
  checks: [],
  action: "Send text",
  channel: "sms",
  to: "(301) 555-0192",
};

let store: MemoryStore;

beforeEach(async () => {
  store = new MemoryStore();
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  await store.saveBusiness(SESSION, SHOP);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function connectTexting(): Promise<void> {
  await store.saveConnection(SESSION, {
    businessId: SHOP.id,
    kind: "texting",
    hookId: "a".repeat(24),
    settings: { phone: "+13015550100", accountSid: `AC${"0".repeat(32)}` },
    secret: encryptSecret(JSON.stringify({ authToken: "token-123" }), ENV),
  });
}

/** Store `draft` and approve it at `now`, as the cards route does. */
async function approve(draft: KeyedCard, now: Date): Promise<CardRecord> {
  await store.ensureCards(SESSION, SHOP.id, [draft]);
  const card = (await store.listCards(SESSION, SHOP.id)).find((c) => c.key === draft.key);
  if (!card) throw new Error("test setup: card not stored");
  const result = await decideCard(store, SESSION, card, { decision: "approve" }, now);
  if (!result.ok) throw new Error(result.error);
  return card;
}

/** A fake `fetch` that answers every call with `status` and `body`, and records each request. */
function provider(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { fetchImpl, calls };
}

async function onlyEntry() {
  const [entry] = await store.listOutbox(SESSION, SHOP.id);
  if (!entry) throw new Error("No outbox entry");
  return entry;
}

describe("sending a text", () => {
  it("sends from the owner's Twilio number to a customer who agreed to texts", async () => {
    await connectTexting();
    await store.saveContact(SESSION, DANA);
    await approve(TEXT, NOON);
    const twilio = provider(201, { sid: "SM123" });

    expect(await dispatchEntry(store, SESSION, (await onlyEntry()).id, NOON, { fetch: twilio.fetchImpl, env: ENV })).toBe("sent");

    expect(await onlyEntry()).toMatchObject({ delivery: "sent", note: null });
    expect(twilio.calls[0]?.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/AC${"0".repeat(32)}/Messages.json`);
    expect(new URLSearchParams(String(twilio.calls[0]?.init?.body)).get("To")).toBe("+13015550192");
    expect(new URLSearchParams(String(twilio.calls[0]?.init?.body)).get("From")).toBe("+13015550100");
  });

  it("leaves the text to the owner when the customer has no texting OK on file", async () => {
    await connectTexting();
    await approve(TEXT, NOON);

    expect(await onlyEntry()).toMatchObject({ delivery: "yours", note: expect.stringContaining("No texting OK") });
  });

  it("leaves the text to the owner when nothing is connected, exactly as before", async () => {
    await store.saveContact(SESSION, DANA);
    await approve(TEXT, NOON);

    expect(await onlyEntry()).toMatchObject({ delivery: "yours", note: null });
  });

  it("doesn't send to a customer who texted STOP after the owner approved", async () => {
    await connectTexting();
    const dana = await store.saveContact(SESSION, DANA);
    await approve(TEXT, NOON);
    await store.saveContact(SESSION, { ...dana, optedOutAt: "2026-11-09T17:00:30Z" });
    const twilio = provider(201, { sid: "SM123" });

    expect(await dispatchEntry(store, SESSION, (await onlyEntry()).id, NOON, { fetch: twilio.fetchImpl, env: ENV })).toBe("yours");
    expect(await onlyEntry()).toMatchObject({ delivery: "yours", note: expect.stringContaining("texted STOP") });
    expect(twilio.calls).toHaveLength(0);
  });

  it("holds a text approved at night for 8 a.m., then sends it from the scheduled run", async () => {
    await connectTexting();
    await store.saveContact(SESSION, DANA);
    await approve(TEXT, NIGHT);
    const held = await onlyEntry();
    expect(held.delivery).toBe("queued");
    expect(held.sentAt).toBe("2026-11-10T13:00:00.000Z");

    expect(await dispatchDue(store, NIGHT, 50, { env: ENV })).toMatchObject({ sent: 0 });
    const twilio = provider(201, { sid: "SM9" });
    expect(await dispatchDue(store, new Date("2026-11-10T13:05:00Z"), 50, { fetch: twilio.fetchImpl, env: ENV })).toMatchObject({ sent: 1 });
    expect(await onlyEntry()).toMatchObject({ delivery: "sent" });
  });

  it("says plainly when Twilio refuses", async () => {
    await connectTexting();
    await store.saveContact(SESSION, DANA);
    await approve(TEXT, NOON);

    await dispatchEntry(store, SESSION, (await onlyEntry()).id, NOON, { fetch: provider(400, { code: 30034, message: "Unregistered" }).fetchImpl, env: ENV });

    expect(await onlyEntry()).toMatchObject({ delivery: "failed", note: expect.stringContaining("isn't registered for texting") });
  });

  it("sends a queued entry once, however many senders reach it", async () => {
    await connectTexting();
    await store.saveContact(SESSION, DANA);
    await approve(TEXT, NOON);
    const twilio = provider(201, { sid: "SM1" });
    const id = (await onlyEntry()).id;

    const outcomes = await Promise.all([dispatchEntry(store, SESSION, id, NOON, { fetch: twilio.fetchImpl, env: ENV }), dispatchEntry(store, SESSION, id, NOON, { fetch: twilio.fetchImpl, env: ENV })]);

    expect(outcomes.sort()).toEqual(["sent", "skipped"]);
    expect(twilio.calls).toHaveLength(1);
  });
});

describe("sending an email", () => {
  const EMAIL: KeyedCard = { ...TEXT, key: `${SHOP.id}:event:2`, skill: "nudger", agent: "books", channel: "email", action: "Send email", to: "sam@example.com", body: "Hi Sam, a quick reminder about invoice 1042." };

  it("sends from Anchored under the business's name, with the owner as reply-to", async () => {
    await store.saveConnection(SESSION, { businessId: SHOP.id, kind: "email-out", hookId: "b".repeat(24), settings: { replyTo: "dana@cpha.test" }, secret: null });
    await approve(EMAIL, NOON);
    const resend = provider(200, { id: "em_1" });

    expect(await dispatchEntry(store, SESSION, (await onlyEntry()).id, NOON, { fetch: resend.fetchImpl, env: ENV })).toBe("sent");

    expect(JSON.parse(String(resend.calls[0]?.init?.body))).toMatchObject({
      from: `"College Park Heating & Air" <drafts@mail.anchored.test>`,
      to: ["sam@example.com"],
      reply_to: "dana@cpha.test",
      text: "Hi Sam, a quick reminder about invoice 1042.",
    });
  });

  it("leaves an email with no address to the owner", async () => {
    await store.saveConnection(SESSION, { businessId: SHOP.id, kind: "email-out", hookId: "b".repeat(24), settings: { replyTo: "dana@cpha.test" }, secret: null });
    await approve({ ...EMAIL, to: "Sam Patel" }, NOON);

    expect(await onlyEntry()).toMatchObject({ delivery: "yours", note: expect.stringContaining("no address") });
  });
});
