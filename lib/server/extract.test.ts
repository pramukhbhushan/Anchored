import { describe, expect, it } from "vitest";
import { validFacts } from "./extract";

// =============================================================================
// Module Overview
// =============================================================================
// What survives from the model's reading of a source: only requested fields,
// in a format the rules can read, whose quote is really in the source.

const SOURCE = "Open Monday to Friday, 9 to 6. Tune-ups $129. We   quote every install.";

describe("validFacts", () => {
  it("keeps facts whose quote is in the source, read with the rules", () => {
    const found = validFacts(
      {
        facts: [
          { field: "hours", value: "Monday to Friday, 9 to 6", quote: "Open Monday to Friday, 9 to 6", confidence: "high" },
          { field: "pricingMethod", value: "quote", quote: "we quote every install", confidence: "medium" },
        ],
      },
      "website",
      SOURCE,
      ["hours", "pricingMethod", "prices"],
    );

    expect(found).toEqual([
      { key: "hours", value: "Monday to Friday, 9 to 6", sourceType: "website", quote: "Open Monday to Friday, 9 to 6", confidence: "high" },
      { key: "pricingMethod", value: "quote", sourceType: "website", quote: "we quote every install", confidence: "medium" },
    ]);
  });

  it("drops a made-up quote, an unrequested field, an unreadable value and a second answer for one field", () => {
    const found = validFacts(
      {
        facts: [
          { field: "minimumCharge", value: "$75", quote: "minimum charge of $75", confidence: "high" },
          { field: "reviewLink", value: "https://g.page/r/x", quote: "Tune-ups $129", confidence: "high" },
          { field: "prices", value: "it varies", quote: "Tune-ups $129", confidence: "high" },
          { field: "hours", value: "9 to 6", quote: "9 to 6", confidence: "high" },
          { field: "hours", value: "8 to 8", quote: "Monday to Friday", confidence: "high" },
        ],
      },
      "website",
      SOURCE,
      ["hours", "prices", "minimumCharge"],
    );

    expect(found.map((fact) => [fact.key, fact.value])).toEqual([["hours", "9 to 6"]]);
  });

  it("drops a pricing method the quoted words don't state, so prices alone never flip how the owner charges", () => {
    const text = "Drain cleaning, water heater installs and emergency leak repair for homeowners. Service calls start at $129, water heaters around $1,800.";
    const found = validFacts(
      {
        facts: [
          { field: "pricingMethod", value: "menu", quote: "Service calls start at $129, water heaters around $1,800", confidence: "medium" },
          { field: "prices", value: "Service call $129; Water heater $1,800", quote: "Service calls start at $129, water heaters around $1,800", confidence: "high" },
        ],
      },
      "owner",
      text,
      ["pricingMethod", "prices"],
    );

    expect(found.map((fact) => fact.key)).toEqual(["prices"]);
  });
});
