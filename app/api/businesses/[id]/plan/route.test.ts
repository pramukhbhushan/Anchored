import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovePlanResponse } from "@/lib/api/contract";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import type { BusinessProfile } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store/memory";

// =============================================================================
// Module Overview
// =============================================================================
// Approving a plan through PUT /api/businesses/[id]/plan: the owner's yes is
// saved on their business with the picks they saw, another session can't
// approve it, and the example's plan stays as its owner approved it.

const SESSION = "owner-session";

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, session: "owner-session" }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({ ...(await original<object>()), getSessionId: async () => state.session }));

const { PUT } = await import("./route");

const OWN: BusinessProfile = (() => {
  const { planApproval: _approval, ...rest } = SAMPLE_BUSINESS;
  return { ...rest, id: "b_own", name: "Corner Cafe", kind: "custom" };
})();

/** Send the approval request for business `id` with `body`. */
function approve(id: string, body: unknown = { approved: true }) {
  const request = new Request(`http://localhost/api/businesses/${id}/plan`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ id }) });
}

beforeEach(async () => {
  state.store = new MemoryStore();
  state.session = SESSION;
  await state.store.saveBusiness(SESSION, OWN);
  await state.store.setChoice(SESSION, OWN.id, "calls", { path: "skip" });
});

describe("PUT /api/businesses/[id]/plan", () => {
  it("saves the owner's yes with the picks they saw", async () => {
    const response = await approve(OWN.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApprovePlanResponse;
    expect(Date.parse(body.planApproval.approvedAt)).not.toBeNaN();
    const saved = await state.store?.getBusiness(SESSION, OWN.id);
    expect(saved?.planApproval).toEqual(body.planApproval);
    expect(saved?.planApproval?.choices.calls).toEqual({ path: "skip" });
  });

  it("refuses a body that isn't a yes", async () => {
    const response = await approve(OWN.id, { approved: "maybe" });
    expect(response.status).toBe(400);
    expect((await state.store?.getBusiness(SESSION, OWN.id))?.planApproval).toBeUndefined();
  });

  it("can't approve another session's business", async () => {
    state.session = "someone-else";
    expect((await approve(OWN.id)).status).toBe(404);
  });

  it("leaves the example's plan as its owner approved it", async () => {
    const response = await approve(SAMPLE_BUSINESS.id);
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: string }).error).toMatch(/your own business/);
  });
});
