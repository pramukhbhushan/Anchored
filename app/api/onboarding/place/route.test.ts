import { beforeEach, describe, expect, it, vi } from "vitest";

// =============================================================================
// Module Overview
// =============================================================================
// The selected-listing endpoint returns sourced candidates for owner
// confirmation and gives a plain fallback when Google Places is unavailable.

const state = vi.hoisted(() => ({ details: vi.fn() }));
vi.mock("@/lib/server/places", () => ({ placeDetails: state.details }));

const { POST } = await import("./route");

/** Submit one selected Google listing request. */
function selectPlace(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/onboarding/place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  state.details.mockReset();
});

describe("POST /api/onboarding/place", () => {
  it("returns profile candidates from the selected listing", async () => {
    const candidates = [{ key: "hours", value: "Monday: 8 AM to 5 PM", sourceType: "listing", quote: "Monday: 8 AM to 5 PM", confidence: "high" }];
    state.details.mockResolvedValue({ candidates, website: "https://apex.example" });

    const response = await selectPlace({ placeId: "place-a" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ placeId: "place-a", candidates, website: "https://apex.example" });
    expect(state.details).toHaveBeenCalledWith("place-a");
  });

  it("invites the owner to continue when lookup is unavailable", async () => {
    state.details.mockResolvedValue(null);

    const response = await selectPlace({ placeId: "place-a" });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Business lookup is unavailable right now. Continue without it." });
  });

  it("rejects an invalid place id before calling Google", async () => {
    expect((await selectPlace({ placeId: "" })).status).toBe(400);
    expect(state.details).not.toHaveBeenCalled();
  });
});
