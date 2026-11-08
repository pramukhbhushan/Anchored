import { describe, expect, it } from "vitest";
import { newFacts } from "./ai";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `newFacts`, the check that keeps a model from adding a price,
// number, link, email or phone number the source text didn't hold.

describe("newFacts", () => {
  it("finds an amount, number or link the original doesn't hold", () => {
    expect(newFacts("A tune-up is $89.", "A tune-up is $149.")).toEqual(["$149", "149"]);
    expect(newFacts("Call us.", "Call us at (301) 555-0192 or visit https://example.com")).toContain("https://example.com");
  });

  it("reads punctuation after an amount as the end of the sentence, not part of the amount", () => {
    expect(newFacts("Prices: tune-up $89", "Yes, a tune-up is $89, and that's all.")).toEqual([]);
    expect(newFacts("Prices: tune-up $89. Hours 8 to 5", "It's $89. We're open 8 to 5.")).toEqual([]);
  });
});
