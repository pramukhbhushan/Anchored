import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SetChoiceResponse } from "@/lib/api/contract";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Changing who handles a job through PUT /api/businesses/[id]/choices: the
// choice is checked against the job's real options before it is saved, and
// the example business takes choices like any other.

const SESSION = "owner-session";

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, session: "owner-session" }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({ ...(await original<object>()), getSessionId: async () => state.session }));

const { PUT } = await import("./route");

const SHOP = hvacShop();

/** Send the choice request for business `id` with `body`. */
function choose(id: string, body: unknown) {
  const request = new Request(`http://localhost/api/businesses/${id}/choices`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ id }) });
}

beforeEach(async () => {
  state.store = new MemoryStore();
  state.session = SESSION;
  await state.store.saveBusiness(SESSION, SHOP);
});

describe("PUT /api/businesses/[id]/choices", () => {
  it("saves a tool the owner signs up for", async () => {
    const response = await choose(SHOP.id, { workflow: "leads", path: "buy", toolId: "housecall" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as SetChoiceResponse).choice).toEqual({ path: "buy", toolId: "housecall" });
    expect((await state.store?.getChoices(SESSION, SHOP.id))?.leads).toEqual({ path: "buy", toolId: "housecall" });
  });

  it("saves software the owner already pays for as theirs, even when the request says to sign up", async () => {
    const response = await choose(SHOP.id, { workflow: "books", path: "buy", toolId: "quickbooks" });
    expect(((await response.json()) as SetChoiceResponse).choice).toEqual({ path: "turnon", toolId: "quickbooks" });
  });

  it("saves Anchored's drafts with the agent's skills", async () => {
    const { choice } = (await (await choose(SHOP.id, { workflow: "leads", path: "build" })).json()) as SetChoiceResponse;
    expect(choice.path === "build" && choice.skills.length).toBeGreaterThan(0);
  });

  it("refuses a job that isn't part of the business's plan", async () => {
    expect((await choose(SHOP.id, { workflow: "snap", path: "skip" })).status).toBe(400);
  });

  it("refuses a tool that doesn't do the job", async () => {
    expect((await choose(SHOP.id, { workflow: "leads", path: "buy", toolId: "homebase" })).status).toBe(400);
  });

  it("refuses to turn on a tool the owner doesn't have", async () => {
    const response = await choose(SHOP.id, { workflow: "leads", path: "turnon", toolId: "housecall" });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toMatch(/Sign up for it instead/);
  });

  it("takes a choice on the example business", async () => {
    expect((await choose(SAMPLE_BUSINESS.id, { workflow: "calls", path: "skip" })).status).toBe(200);
  });
});
