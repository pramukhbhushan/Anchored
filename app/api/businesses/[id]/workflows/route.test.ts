import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddJobResponse } from "@/lib/api/contract";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { workflowIdsOf } from "@/lib/domain/paths";
import { MemoryStore } from "@/lib/store/memory";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Adding a job from the tools page through POST /api/businesses/[id]/workflows:
// the job joins the owner's profile with the tool or agent they picked, gets
// the same checks as any other choice, and can't touch another session's
// business, a job the business already has, or the example business.

const SESSION = "owner-session";

const state = vi.hoisted(() => ({ store: null as MemoryStore | null, session: "owner-session" }));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", async (original) => ({ ...(await original<object>()), getSessionId: async () => state.session }));

const { POST } = await import("./route");

const SHOP = hvacShop();

/** Send the add-a-job request for business `id` with `body`. */
function addJob(id: string, body: unknown) {
  const request = new Request(`http://localhost/api/businesses/${id}/workflows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

/** Read the error an owner would see from `response`. */
async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

beforeEach(async () => {
  state.store = new MemoryStore();
  state.session = SESSION;
  await state.store.saveBusiness(SESSION, SHOP);
});

describe("POST /api/businesses/[id]/workflows", () => {
  it("adds the job with the tool the owner picked", async () => {
    const response = await addJob(SHOP.id, { workflow: "scheduling", path: "buy", toolId: "homebase" });

    expect(response.status).toBe(200);
    expect((await response.json()) as AddJobResponse).toEqual({ workflow: "scheduling", choice: { path: "buy", toolId: "homebase" } });
    const saved = await state.store?.getBusiness(SESSION, SHOP.id);
    expect(saved && workflowIdsOf(saved)).toContain("scheduling");
    expect(saved?.workflows.scheduling?.addedBy).toBe("owner");
    expect((await state.store?.getChoices(SESSION, SHOP.id))?.scheduling).toEqual({ path: "buy", toolId: "homebase" });
  });

  it("adds a job for Anchored to draft with the agent's own skills", async () => {
    const response = await addJob(SHOP.id, { workflow: "licenses", path: "build" });

    expect(response.status).toBe(200);
    const { choice } = (await response.json()) as AddJobResponse;
    expect(choice.path).toBe("build");
    expect(choice.path === "build" && choice.skills.length).toBeGreaterThan(0);
  });

  it("replaces a choice left over from when the business last had the job", async () => {
    await state.store?.setChoice(SESSION, SHOP.id, "scheduling", { path: "skip" });
    await addJob(SHOP.id, { workflow: "scheduling", path: "buy", toolId: "wheniwork" });
    expect((await state.store?.getChoices(SESSION, SHOP.id))?.scheduling).toEqual({ path: "buy", toolId: "wheniwork" });
  });

  it("refuses a job the business already has and points to the Workflows page", async () => {
    const response = await addJob(SHOP.id, { workflow: "calls", path: "build" });
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatch(/already in your workflows/);
  });

  it("refuses a tool that doesn't do the job, and saves nothing", async () => {
    const response = await addJob(SHOP.id, { workflow: "scheduling", path: "buy", toolId: "calendly" });
    expect(response.status).toBe(400);
    expect((await state.store?.getBusiness(SESSION, SHOP.id))?.workflows.scheduling).toBeUndefined();
  });

  it("refuses to turn on a tool the owner doesn't have", async () => {
    const response = await addJob(SHOP.id, { workflow: "noshows", path: "turnon", toolId: "calendly" });
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatch(/Sign up for it instead/);
  });

  it("refuses a request to add a job and leave it undone", async () => {
    expect((await addJob(SHOP.id, { workflow: "scheduling", path: "skip" })).status).toBe(400);
  });

  it("can't add a job to another session's business", async () => {
    state.session = "someone-else";
    expect((await addJob(SHOP.id, { workflow: "scheduling", path: "buy", toolId: "homebase" })).status).toBe(404);
  });

  it("leaves the example's jobs as they are", async () => {
    const response = await addJob(SAMPLE_BUSINESS.id, { workflow: "licenses", path: "build" });
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatch(/your own business/);
  });
});
