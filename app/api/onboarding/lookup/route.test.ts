import { beforeEach, describe, expect, it, vi } from "vitest";

// =============================================================================
// Module Overview
// =============================================================================
// The Google listing search endpoint returns bounded listing choices and
// rejects incomplete onboarding lookup requests before calling the provider.

const state = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/lib/server/places", () => ({ searchPlaces: state.search }));

const { POST } = await import("./route");

/** Submit one Google listing lookup request. */
function lookup(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/onboarding/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  state.search.mockReset();
});

describe("POST /api/onboarding/lookup", () => {
  it("returns the matching listing choices", async () => {
    state.search.mockResolvedValue([{ id: "place-a", name: "Apex Heating", address: "1 Main St", rating: 4.8 }]);

    const response = await lookup({ name: "Apex Heating", city: "Laurel, MD" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ choices: [{ id: "place-a", name: "Apex Heating", address: "1 Main St", rating: 4.8 }] });
    expect(state.search).toHaveBeenCalledWith("Apex Heating", "Laurel, MD");
  });

  it("rejects an incomplete lookup without calling Google", async () => {
    expect((await lookup({ name: "Apex Heating", city: "" })).status).toBe(400);
    expect(state.search).not.toHaveBeenCalled();
  });
});
