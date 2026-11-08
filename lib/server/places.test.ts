import { afterEach, describe, expect, it, vi } from "vitest";
import { json, sentJson, stubFetch } from "@/test/http";
import { isPlacesConfigured, placeDetails, reviewLinkFor, searchPlaces } from "./places";

// =============================================================================
// Module Overview
// =============================================================================
// The Google Places client: off with no key, asks only for the fields it uses,
// turns a listing into candidates at the listing tier, and fails quietly.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("searchPlaces", () => {
  it("does nothing without a key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const spy = stubFetch(() => json({}));

    expect(isPlacesConfigured()).toBe(false);
    expect(await searchPlaces("Apex Heating", "Laurel, MD")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("asks for three matches with a small field mask, and returns them as choices", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const spy = stubFetch(() =>
      json({ places: [{ id: "place-a", displayName: { text: "Apex Heating & Air" }, formattedAddress: "1 Main St, Laurel, MD", rating: 4.8 }, { id: "place-b" }] }),
    );

    const choices = await searchPlaces("Apex Heating", "Laurel, MD");

    expect(choices).toEqual([
      { id: "place-a", name: "Apex Heating & Air", address: "1 Main St, Laurel, MD", rating: 4.8 },
      { id: "place-b", name: "Apex Heating", address: "" },
    ]);
    expect(sentJson(spy, 0)).toMatchObject({ method: "POST", body: { textQuery: "Apex Heating, Laurel, MD", maxResultCount: 3 } });
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe("places.id,places.displayName,places.formattedAddress,places.rating");
    expect(headers["X-Goog-Api-Key"]).toBe("test-key");
  });

  it("returns no choices when Google refuses", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch(() => json({ error: { message: "API key not valid" } }, 403));

    expect(await searchPlaces("Apex Heating", "Laurel, MD")).toEqual([]);
  });
});

describe("placeDetails", () => {
  it("turns opening hours into plain words, adds the review link, and passes the website on", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const spy = stubFetch(() =>
      json({
        id: "place-a",
        displayName: { text: "Apex Heating" },
        formattedAddress: "1 Main St, Laurel, MD 20707",
        nationalPhoneNumber: "(301) 555-0192",
        regularOpeningHours: { weekdayDescriptions: ["Monday: 8:00\u202fAM \u2013 5:00\u202fPM", "Sunday: Closed"] },
        websiteUri: "https://apexheating.example",
        types: ["hvac_contractor"],
        editorialSummary: { text: "Repairs and replaces home heating systems." },
        rating: 4.8,
        userRatingCount: 42,
        reviews: [{ text: { text: "They explained the repair clearly." } }],
      }),
    );

    const facts = await placeDetails("place-a");

    expect(facts?.website).toBe("https://apexheating.example");
    expect(facts?.candidates).toEqual([
      { key: "address", value: "1 Main St, Laurel, MD 20707", sourceType: "listing", quote: "1 Main St, Laurel, MD 20707", confidence: "high" },
      { key: "businessPhone", value: "(301) 555-0192", sourceType: "listing", quote: "(301) 555-0192", confidence: "high" },
      { key: "hours", value: "Monday: 8:00 AM to 5:00 PM; Sunday: Closed", sourceType: "listing", quote: "Monday: 8:00 AM to 5:00 PM; Sunday: Closed", confidence: "high" },
      { key: "reviewLink", value: reviewLinkFor("place-a"), sourceType: "listing", quote: "Your Google listing's review link", confidence: "high" },
    ]);
    expect(facts?.listingText).toContain("Repairs and replaces home heating systems.");
    expect(facts?.reviewText).toContain("Overall rating: 4.8 from 42 reviews.");
    expect(facts?.reviewText).toContain("They explained the repair clearly.");
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toContain("reviews");
    expect(headers["X-Goog-FieldMask"]).toContain("nationalPhoneNumber");
  });

  it("returns null when the lookup fails", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch(() => {
      throw new Error("network down");
    });

    expect(await placeDetails("place-a")).toBeNull();
  });
});
