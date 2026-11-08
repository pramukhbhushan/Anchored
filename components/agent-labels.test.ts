import { describe, expect, it } from "vitest";
import { cardSource, displayAgentName } from "./agent-labels";

// =============================================================================
// Module Overview
// =============================================================================
// Owner-facing agent names remain consistent while legacy domain and card
// records coexist with the four canonical presentation identities.

describe("displayAgentName", () => {
  it.each([
    ["Front Desk", "Customer"],
    ["Follow-up", "Customer"],
    ["Bookkeeping and Invoicing", "Bookkeeping"],
    ["Content and Social", "Marketing"],
    ["Customer", "Customer"],
    ["Internal Communications", "Internal Communications"],
    ["Stock Check", "Stock Check"],
  ])("names %s as %s", (source, expected) => {
    expect(displayAgentName(source)).toBe(expected);
  });

  it("keeps agentless cards distinct and uses the canonical source name", () => {
    expect(cardSource(null)).toBe("Anchored");
    expect(cardSource("Follow-up")).toBe("Customer agent");
    expect(cardSource("Content and Social")).toBe("Marketing agent");
  });
});
