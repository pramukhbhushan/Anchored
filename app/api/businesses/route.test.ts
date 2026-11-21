import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateBusinessResponse } from "@/lib/api/contract";
import { MemoryStore } from "@/lib/store/memory";

// =============================================================================
// Module Overview
// =============================================================================
// Creating a business from the onboarding form saves it and starts its starter
// work. A website the owner pasted is kept as typed and never fetched.

const SESSION = "owner-session";
const state = vi.hoisted(() => ({
  store: null as MemoryStore | null,
  scheduleStarters: vi.fn(),
}));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));
vi.mock("@/lib/server/starters", () => ({ scheduleStarters: state.scheduleStarters }));

const { POST } = await import("./route");

const ANSWERS = {
  name: "Apex Heating",
  kind: "HVAC contractor",
  what: "Heating and cooling service",
  week: "Calls and repair visits",
  voice: "Clear and neighborly",
  reach: ["Phone calls"],
  tools: [],
  signals: [],
  languages: ["English"],
};

/** Create one business through the onboarding answers route. */
function create(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/businesses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  state.store = new MemoryStore();
  state.scheduleStarters.mockReset();
});

describe("POST /api/businesses", () => {
  it("saves the business from the answers and starts its starter work", async () => {
    const response = await create({ from: "answers", answers: ANSWERS });
    const result = (await response.json()) as CreateBusinessResponse;

    expect(response.status).toBe(201);
    expect(result.business.name).toBe("Apex Heating");
    expect(await state.store?.getBusiness(SESSION, result.id)).toMatchObject({ name: "Apex Heating" });
    expect(state.scheduleStarters).toHaveBeenCalledWith(SESSION, expect.objectContaining({ id: result.id }));
  });

  it("never fetches the website the owner pasted", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await create({ from: "answers", answers: { ...ANSWERS, website: "http://169.254.169.254/latest" } });

    expect(response.status).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
