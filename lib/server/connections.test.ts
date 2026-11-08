import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/viewer";
import type { Contact } from "@/lib/domain/contacts";
import { MemoryStore } from "@/lib/store/memory";
import type { Store } from "@/lib/store/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The Connections page's server side, as an owner meets it: who may connect,
// what each service shows once connected and what the owner pastes into it,
// why a server can't offer a service, how a texting number is checked, and how
// a customer's texting OK keeps its date. The store is in memory and each test
// sets the server's settings with `vi.stubEnv`.

const SESSION = "owner-session";
const BASE = "https://anchored.example";
const KEY = Buffer.alloc(32, 7).toString("base64");
const SID = `AC${"a".repeat(32)}`;

const stores = vi.hoisted(() => ({ current: null as Store | null }));
vi.mock("@/lib/store", () => ({ getStore: () => stores.current }));

const { appBaseUrl, connect, connectBlocked, ConnectError, connectionViews, disconnect, saveContactFromOwner } = await import("./connections");
const { decryptSecret } = await import("./secrets");

const ACCOUNT: Viewer = { id: "u1", email: "owner@example.com", isGuest: false, authEnabled: true };
const GUEST: Viewer = { id: "u2", email: null, isGuest: true, authEnabled: true };
const NO_ACCOUNTS: Viewer = { id: "s1", email: null, isGuest: true, authEnabled: false };

const business = hvacShop();

/** Return the stored connection of `kind`, or `undefined`. */
async function stored(kind: string) {
  return (await stores.current?.listConnections(SESSION, business.id))?.find((connection) => connection.kind === kind);
}

/** Return the view of `kind` as the page shows it. */
async function view(kind: string) {
  return (await connectionViews(SESSION, business, BASE)).find((v) => v.kind === kind);
}

beforeEach(() => {
  stores.current = new MemoryStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("connectBlocked", () => {
  it("lets an account connect", () => {
    expect(connectBlocked(ACCOUNT)).toBeNull();
  });

  it("asks a guest, or someone signed out, to save their work first", () => {
    expect(connectBlocked(GUEST)).toMatch(/^Save your work/);
    expect(connectBlocked(null)).toMatch(/^Save your work/);
  });

  it("lets a visitor connect with accounts off only when the server allows guest connections", () => {
    expect(connectBlocked(NO_ACCOUNTS)).toMatch(/^Save your work/);
    vi.stubEnv("ANCHORED_ALLOW_GUEST_CONNECTIONS", "1");
    expect(connectBlocked(NO_ACCOUNTS)).toBeNull();
    expect(connectBlocked(GUEST)).toMatch(/^Save your work/);
  });
});

describe("appBaseUrl", () => {
  it("prefers PUBLIC_APP_URL without its trailing slash", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://app.anchored.example/");
    expect(appBaseUrl(new Request("http://localhost:3000/api/x"))).toBe("https://app.anchored.example");
  });

  it("falls back to the request's origin", () => {
    vi.stubEnv("PUBLIC_APP_URL", "");
    expect(appBaseUrl(new Request("http://localhost:3000/api/x"))).toBe("http://localhost:3000");
  });
});

describe("connecting texting", () => {
  it("is unavailable, with the setting to fix, when the server can't store credentials", async () => {
    vi.stubEnv("CONNECTOR_SECRET_KEY", "");
    expect((await view("texting"))?.unavailable).toBe("This server can't store credentials yet. Set CONNECTOR_SECRET_KEY.");
    await expect(connect(SESSION, business, { kind: "texting", accountSid: SID, authToken: "token-123", phone: "301 555 0192" })).rejects.toBeInstanceOf(ConnectError);
  });

  it("saves the number, encrypts the token, and shows the webhook addresses with no secret", async () => {
    vi.stubEnv("CONNECTOR_SECRET_KEY", KEY);
    await connect(SESSION, business, { kind: "texting", accountSid: SID, authToken: "token-123", phone: "(301) 555-0192" });

    const saved = await stored("texting");
    expect(saved?.settings).toEqual({ phone: "+13015550192", accountSid: SID });
    expect(saved?.secret).not.toContain("token-123");
    expect(JSON.parse(decryptSecret(saved?.secret ?? ""))).toEqual({ authToken: "token-123" });

    const shown = await view("texting");
    expect(shown).toEqual({
      kind: "texting",
      connected: true,
      detail: "+13015550192",
      setup: [
        { label: "When a message comes in", value: `${BASE}/api/hooks/twilio/${saved?.hookId}/sms` },
        { label: "When a call comes in", value: `${BASE}/api/hooks/twilio/${saved?.hookId}/voice` },
      ],
      unavailable: null,
    });
    expect(JSON.stringify(shown)).not.toContain("token-123");
  });

  it("refuses a number it can't read, saying what form to use", async () => {
    vi.stubEnv("CONNECTOR_SECRET_KEY", KEY);
    const attempt = connect(SESSION, business, { kind: "texting", accountSid: SID, authToken: "token-123", phone: "555-01" });
    await expect(attempt).rejects.toMatchObject({ status: 400, message: "Enter the Twilio number in a form like +1 301 555 0192." });
    expect(await stored("texting")).toBeUndefined();
  });

  it("refuses credentials the Twilio check rejects, with its reason", async () => {
    vi.stubEnv("CONNECTOR_SECRET_KEY", KEY);
    const check = vi.fn(async () => "Twilio didn't accept that auth token.");
    const attempt = connect(SESSION, business, { kind: "texting", accountSid: SID, authToken: "wrong", phone: "301 555 0192" }, check);
    await expect(attempt).rejects.toMatchObject({ status: 400, message: "Twilio didn't accept that auth token." });
    expect(check).toHaveBeenCalledWith(SID, "wrong", "+13015550192");
    expect(await stored("texting")).toBeUndefined();
  });

  it("disconnects", async () => {
    vi.stubEnv("CONNECTOR_SECRET_KEY", KEY);
    await connect(SESSION, business, { kind: "texting", accountSid: SID, authToken: "token-123", phone: "301 555 0192" });
    await disconnect(SESSION, business.id, "texting");
    expect(await view("texting")).toMatchObject({ connected: false, detail: null, setup: [] });
  });
});

describe("connecting email and Stripe", () => {
  it("offers sending email only when the server has an email key and a from address", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    expect((await view("email-out"))?.unavailable).toBe("Email sending isn't set up on this server yet.");

    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "drafts@anchored.example");
    await connect(SESSION, business, { kind: "email-out", replyTo: "owner@hvac.example" });
    expect(await view("email-out")).toEqual({ kind: "email-out", connected: true, detail: "owner@hvac.example", setup: [], unavailable: null });
  });

  it("gives a forwarding address made from the inbound address and the connection's id", async () => {
    vi.stubEnv("INBOUND_EMAIL_ADDRESS", "abc123@inbound.postmarkapp.com");
    await connect(SESSION, business, { kind: "email-in" });
    const hook = (await stored("email-in"))?.hookId;
    const address = `abc123+${hook}@inbound.postmarkapp.com`;
    expect(await view("email-in")).toEqual({ kind: "email-in", connected: true, detail: address, setup: [{ label: "Forward customer emails to", value: address }], unavailable: null });
  });

  it("refuses forwarded email when the server has no inbound address", async () => {
    vi.stubEnv("INBOUND_EMAIL_ADDRESS", "");
    expect((await view("email-in"))?.unavailable).not.toBeNull();
    await expect(connect(SESSION, business, { kind: "email-in" })).rejects.toMatchObject({ status: 409 });
  });

  it("encrypts the Stripe signing secret and shows the endpoint and events to send", async () => {
    vi.stubEnv("CONNECTOR_SECRET_KEY", KEY);
    await connect(SESSION, business, { kind: "stripe", signingSecret: "whsec_abcdef123456" });
    const saved = await stored("stripe");
    expect(decryptSecret(saved?.secret ?? "")).toBe("whsec_abcdef123456");
    const shown = await view("stripe");
    expect(shown?.setup).toEqual([
      { label: "Stripe webhook endpoint", value: `${BASE}/api/hooks/stripe/${saved?.hookId}` },
      { label: "Events to send", value: "invoice.overdue, invoice.payment_failed" },
    ]);
    expect(JSON.stringify(shown)).not.toContain("whsec_");
  });
});

describe("saveContactFromOwner", () => {
  const NOW = "2026-11-07T15:00:00.000Z";
  const LATER = "2026-11-08T15:00:00.000Z";

  /** Save a contact for the test business with `request`. */
  function save(request: Parameters<typeof saveContactFromOwner>[2], existing: readonly Contact[] = [], now = NOW) {
    return saveContactFromOwner(SESSION, business.id, request, existing, now);
  }

  it("stores the phone in one form and dates the texting OK", async () => {
    const contact = await save({ name: " Dana Lewis ", phone: "(410) 555-0137", email: "dana@example.com", consent: "in-person" });
    expect(contact).toMatchObject({ name: "Dana Lewis", phone: "+14105550137", email: "dana@example.com", consent: { source: "in-person", at: NOW }, optedOutAt: null });
  });

  it("refuses a phone it can't read and an email that isn't one", async () => {
    await expect(save({ name: "Dana", phone: "call me", consent: null })).rejects.toMatchObject({ status: 400 });
    await expect(save({ name: "Dana", email: "dana at example", consent: null })).rejects.toMatchObject({ status: 400 });
    expect(await stores.current?.listContacts(SESSION, business.id)).toEqual([]);
  });

  it("keeps the date of a texting OK whose source didn't change, and the STOP on file", async () => {
    const first = await save({ name: "Dana", phone: "410 555 0137", consent: "paper" });
    const stopped: Contact = { ...first, optedOutAt: "2026-11-07T16:00:00.000Z" };
    await stores.current?.saveContact(SESSION, stopped);

    const renamed = await save({ id: first.id, name: "Dana Lewis", phone: "410 555 0137", consent: "paper" }, [stopped], LATER);
    expect(renamed.consent).toEqual({ source: "paper", at: NOW });
    expect(renamed.optedOutAt).toBe("2026-11-07T16:00:00.000Z");

    const changed = await save({ id: first.id, name: "Dana Lewis", phone: "410 555 0137", consent: "web-form" }, [renamed], LATER);
    expect(changed.consent).toEqual({ source: "web-form", at: LATER });

    const cleared = await save({ id: first.id, name: "Dana Lewis", phone: "410 555 0137", consent: null }, [changed], LATER);
    expect(cleared.consent).toBeNull();
    expect(await stores.current?.listContacts(SESSION, business.id)).toHaveLength(1);
  });
});
