import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionsResponse } from "@/lib/api/contract";
import type { Viewer } from "@/lib/auth/viewer";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The connections and contacts routes, as the Connections page calls them: an
// account connects a service and adds and removes customers, a guest and the
// example business are refused with the reason, and every answer is the
// page's data with no secret in it.

const SESSION = "owner-session";
const ACCOUNT: Viewer = { id: SESSION, email: "owner@example.com", isGuest: false, authEnabled: true };
const GUEST: Viewer = { id: SESSION, email: null, isGuest: true, authEnabled: true };

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, viewer: null as Viewer | null }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({
  ...(await original<object>()),
  getSessionId: async () => SESSION,
  findViewer: async () => state.viewer,
}));

const connections = await import("./route");
const contacts = await import("../contacts/route");
const oneContact = await import("../contacts/[contactId]/route");

const business = hvacShop();

/** Build a JSON request to `path` with `method` and `body`. */
function call(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The route's `params` for business `id`. */
function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(async () => {
  vi.stubEnv("CONNECTOR_SECRET_KEY", Buffer.alloc(32, 7).toString("base64"));
  state.store = new MemoryStore();
  state.viewer = ACCOUNT;
  await state.store.saveBusiness(SESSION, business);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/businesses/[id]/connections", () => {
  it("connects texting for an account and answers with the page's data, without the token", async () => {
    const body = { kind: "texting", accountSid: `AC${"b".repeat(32)}`, authToken: "secret-token-1", phone: "301 555 0192" };
    const response = await connections.PUT(call(`/api/businesses/${business.id}/connections`, "PUT", body), params(business.id));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("secret-token-1");
    const data = JSON.parse(text) as ConnectionsResponse;
    expect(data.blocked).toBeNull();
    expect(data.connections.find((c) => c.kind === "texting")).toMatchObject({ connected: true, detail: "+13015550192" });
  });

  it("tells a guest why they can't connect, and refuses their change", async () => {
    state.viewer = GUEST;
    const read = (await (await connections.GET(call(`/api/businesses/${business.id}/connections`, "GET"), params(business.id))).json()) as ConnectionsResponse;
    expect(read.blocked).toMatch(/^Save your work/);

    const response = await connections.PUT(call(`/api/businesses/${business.id}/connections`, "PUT", { kind: "email-in" }), params(business.id));
    expect(response.status).toBe(403);
    expect(await state.store?.listConnections(SESSION, business.id)).toEqual([]);
  });

  it("refuses to connect anything to the example business", async () => {
    const response = await connections.PUT(call(`/api/businesses/${SAMPLE_BUSINESS.id}/connections`, "PUT", { kind: "email-in" }), params(SAMPLE_BUSINESS.id));
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: string }).error).toBe("The example business can't connect services. Set up your business first.");
  });

  it("disconnects the kind named in the query, and refuses an unknown one", async () => {
    vi.stubEnv("INBOUND_EMAIL_ADDRESS", "abc123@inbound.postmarkapp.com");
    await connections.PUT(call(`/api/businesses/${business.id}/connections`, "PUT", { kind: "email-in" }), params(business.id));

    expect((await connections.DELETE(call(`/api/businesses/${business.id}/connections?kind=fax`, "DELETE"), params(business.id))).status).toBe(400);
    const response = await connections.DELETE(call(`/api/businesses/${business.id}/connections?kind=email-in`, "DELETE"), params(business.id));
    const data = (await response.json()) as ConnectionsResponse;
    expect(data.connections.find((c) => c.kind === "email-in")?.connected).toBe(false);
  });
});

describe("/api/businesses/[id]/contacts", () => {
  it("adds a customer and removes them", async () => {
    const added = await contacts.POST(call(`/api/businesses/${business.id}/contacts`, "POST", { name: "Dana Lewis", phone: "410 555 0137", consent: "in-person" }), params(business.id));
    expect(added.status).toBe(200);
    const [dana] = ((await added.json()) as ConnectionsResponse).contacts;
    expect(dana).toMatchObject({ name: "Dana Lewis", phone: "+14105550137", consent: { source: "in-person" } });

    const removed = await oneContact.DELETE(call(`/api/businesses/${business.id}/contacts/${dana?.id}`, "DELETE"), {
      params: Promise.resolve({ id: business.id, contactId: dana?.id ?? "" }),
    });
    expect(((await removed.json()) as ConnectionsResponse).contacts).toEqual([]);
  });

  it("refuses a phone it can't read, saying what form to use", async () => {
    const response = await contacts.POST(call(`/api/businesses/${business.id}/contacts`, "POST", { name: "Dana", phone: "call me", consent: null }), params(business.id));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toMatch(/^Enter the phone number/);
  });
});
