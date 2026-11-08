import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LicensesResponse } from "@/lib/api/contract";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import type { BusinessProfile } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Structured license facts preserve their source in profile history. Only the
// current owner can save or complete them, and every result remains a private
// reminder rather than a renewal, filing or external message.

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, session: "owner" }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({ ...(await original<object>()), getSessionId: async () => state.session }));
const route = await import("./route");
const base = hvacShop();
const SHOP: BusinessProfile = { ...base, signals: [...base.signals, "licenses"], workflows: { ...base.workflows, licenses: { fit: 3, rec: "build", why: "Owner records expiry dates", stake: "", isNew: true } } };
const license = { id: "contractor-license", name: "Contractor license", expiresOn: "2026-11-30", evidence: "Date printed on the current license." };
function store(): MemoryStore {
  if (state.store === null) throw new Error("Missing test store.");
  return state.store;
}
function params(id = SHOP.id) { return { params: Promise.resolve({ id }) }; }
function request(body?: unknown): Request {
  return new Request(`http://localhost/api/businesses/${SHOP.id}/licenses`, { method: body === undefined ? "GET" : "PUT", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T15:00:00Z"));
  state.store = new MemoryStore();
  state.session = "owner";
  await store().saveBusiness("owner", SHOP);
  await store().setChoice("owner", SHOP.id, "licenses", { path: "build", skills: ["license"] });
});
afterEach(() => { vi.useRealTimers(); });

describe("license dates route", () => {
  it("saves names, dates and sources in the existing profile and history, with an owner-only reminder", async () => {
    const response = await route.PUT(request({ licenses: [license] }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ licenses: [license] });
    expect((await store().getBusiness("owner", SHOP.id))?.details?.licenses).toEqual([license]);
    expect((await store().listProfileVersions("owner", SHOP.id))[0]?.snapshot.details?.licenses).toEqual([license]);
    expect((await (await route.GET(request(), params())).json() as LicensesResponse).licenses).toEqual([license]);
    expect((await store().listCards("owner", SHOP.id))[0]).toMatchObject({ skill: "license", channel: "flag", body: expect.stringContaining(license.evidence), status: "pending" });
    expect(await store().listOutbox("owner", SHOP.id)).toEqual([]);
  });

  it.each([
    { ...license, expiresOn: "2026-02-30" },
    { ...license, expiresOn: "next month" },
    { ...license, evidence: "" },
    { ...license, name: "" },
    { ...license, completed: "yes" },
  ])("rejects missing evidence and invalid facts: %j", async (invalid) => {
    expect((await route.PUT(request({ licenses: [invalid] }), params())).status).toBe(400);
    expect((await store().getBusiness("owner", SHOP.id))?.details?.licenses).toBeUndefined();
    expect(await store().listCards("owner", SHOP.id)).toEqual([]);
  });

  it("rejects duplicate license ids and caller-supplied ownership", async () => {
    expect((await route.PUT(request({ licenses: [license, { ...license, name: "Another license" }] }), params())).status).toBe(400);
    expect((await route.PUT(request({ licenses: [license], session: "other-owner" }), params())).status).toBe(400);
  });

  it("completion preserves the license facts and stops the pending reminder", async () => {
    await route.PUT(request({ licenses: [license] }), params());
    const response = await route.PUT(request({ licenses: [{ ...license, completed: true }] }), params());
    expect(response.status).toBe(200);
    expect((await response.json() as LicensesResponse).licenses).toEqual([{ ...license, completed: true }]);
    expect((await store().listCards("owner", SHOP.id)).every((card) => card.status === "superseded")).toBe(true);
    expect(await store().listOutbox("owner", SHOP.id)).toEqual([]);
  });

  it("lets the owner record dates while the skill is disabled without creating a reminder", async () => {
    await store().setChoice("owner", SHOP.id, "licenses", { path: "skip" });
    expect((await route.PUT(request({ licenses: [license] }), params())).status).toBe(200);
    expect((await store().getBusiness("owner", SHOP.id))?.details?.licenses).toEqual([license]);
    expect(await store().listCards("owner", SHOP.id)).toEqual([]);
  });

  it("refuses other sessions and the shared example without revealing saved dates", async () => {
    await route.PUT(request({ licenses: [license] }), params());
    state.session = "other-owner";
    expect((await route.GET(request(), params())).status).toBe(404);
    expect((await route.PUT(request({ licenses: [] }), params())).status).toBe(404);
    expect((await route.PUT(request({ licenses: [license] }), params(SAMPLE_BUSINESS.id))).status).toBe(404);
    expect((await store().getBusiness("owner", SHOP.id))?.details?.licenses).toEqual([license]);
  });
});
