import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateBusinessResponse } from "@/lib/api/contract";
import { MemoryStore } from "@/lib/store/memory";

// =============================================================================
// Module Overview
// =============================================================================
// Creating a business from the onboarding form stores a selected Google place
// id and merges its sourced facts into the profile before starter work begins.

const SESSION = "owner-session";
const state = vi.hoisted(() => ({
  store: null as MemoryStore | null,
  placeDetails: vi.fn(),
  fetchPage: vi.fn(),
  scheduleStarters: vi.fn(),
}));
vi.mock("@/lib/store", async (original) => ({ ...(await original<object>()), getStore: () => state.store }));
vi.mock("@/lib/server/session", () => ({ getSessionId: async () => SESSION }));
vi.mock("@/lib/server/places", () => ({ placeDetails: state.placeDetails }));
vi.mock("@/lib/server/fetch-page", () => ({ fetchPage: state.fetchPage }));
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
  state.placeDetails.mockReset();
  state.fetchPage.mockReset();
  state.fetchPage.mockResolvedValue(null);
  state.scheduleStarters.mockReset();
});

describe("POST /api/businesses", () => {
  it("stores only the selected place id and its sourced profile facts", async () => {
    state.placeDetails.mockResolvedValue({
      website: "https://apex.example",
      candidates: [
        { key: "address", value: "1 Main St, Laurel, MD", sourceType: "listing", quote: "1 Main St, Laurel, MD", confidence: "high" },
        { key: "businessPhone", value: "(301) 555-0192", sourceType: "listing", quote: "(301) 555-0192", confidence: "high" },
      ],
    });

    const response = await create({ from: "answers", answers: ANSWERS, placeId: "place-a" });
    const result = (await response.json()) as CreateBusinessResponse;

    expect(response.status).toBe(201);
    expect(result.business).toMatchObject({
      placeId: "place-a",
      details: { address: "1 Main St, Laurel, MD", businessPhone: "(301) 555-0192" },
      evidence: {
        address: { sourceType: "listing", quote: "1 Main St, Laurel, MD" },
        businessPhone: { sourceType: "listing", quote: "(301) 555-0192" },
      },
    });
    expect(await state.store?.getBusiness(SESSION, result.id)).toMatchObject({ placeId: "place-a" });
    expect(state.scheduleStarters).toHaveBeenCalledWith(SESSION, expect.objectContaining({ id: result.id }));
  });

  it("continues without listing facts when details are unavailable", async () => {
    state.placeDetails.mockResolvedValue(null);

    const response = await create({ from: "answers", answers: ANSWERS, placeId: "place-a" });
    const result = (await response.json()) as CreateBusinessResponse;

    expect(response.status).toBe(201);
    expect(result.business.placeId).toBe("place-a");
  });

  it("reads a pasted website when the business has no Google listing", async () => {
    state.fetchPage.mockResolvedValue({ url: "https://apex.example/", title: "Apex Heating", text: "Emergency heating repairs in Laurel." });

    const response = await create({ from: "answers", answers: { ...ANSWERS, website: "https://apex.example" } });

    expect(response.status).toBe(201);
    expect(state.placeDetails).not.toHaveBeenCalled();
    expect(state.fetchPage).toHaveBeenCalledWith("https://apex.example");
  });
});
