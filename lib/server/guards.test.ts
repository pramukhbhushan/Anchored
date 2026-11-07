import { describe, expect, it } from "vitest";
import { newFacts } from "./ai";
import { isCardId, keyFromVirtualId, virtualCardId } from "./data";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of two server guards: the rewrite check that refuses invented facts,
// and the ids that let a never-stored draft be decided without page views writing rows.

describe("newFacts", () => {
  const draft = "Hi James, I can hold Thursday's install slot until Friday at 8 a.m. Reply STOP to opt out.";

  it("accepts a rewrite that only changes wording", () => {
    expect(newFacts(draft, "Hey James! Happy to hold Thursday's install slot until Friday, 8am. Reply STOP to opt out.")).toEqual([]);
  });

  it("flags a link, a phone number, an email or a price the draft didn't have", () => {
    expect(newFacts(draft, "James, book at https://evil.example/pay now.")).toContain("https://evil.example/pay");
    expect(newFacts(draft, "Call us at (410) 555-0137 to confirm.").join(" ")).toContain("555-0137");
    expect(newFacts(draft, "Email deals@example.com for the slot.")).toContain("deals@example.com");
    expect(newFacts(draft, "The slot is yours for $99 down.").join(" ")).toContain("$99");
  });

  it("flags a new number even without a currency sign", () => {
    expect(newFacts(draft, "I can hold the slot for 3 more days.")).toContain("3");
  });
});

describe("virtual card ids", () => {
  it("round-trip a draft key, including locked-card keys", () => {
    for (const key of ["hvac:callback", "b_1f2e3d4c-0000-4000-8000-000000000000:closer", "restaurant:locked:0"]) {
      expect(keyFromVirtualId(virtualCardId(key))).toBe(key);
    }
  });

  it("are told apart from stored card ids", () => {
    expect(keyFromVirtualId("8f5e2a1c-3b4d-4e6f-8a9b-0c1d2e3f4a5b")).toBeNull();
    expect(isCardId("8f5e2a1c-3b4d-4e6f-8a9b-0c1d2e3f4a5b")).toBe(true);
    expect(isCardId(virtualCardId("hvac:callback"))).toBe(true);
  });

  it("reject shapes that are neither", () => {
    for (const id of ["constructor", "../etc", "v.", "v.has spaces", "x".repeat(200)]) expect(isCardId(id)).toBe(false);
  });
});
