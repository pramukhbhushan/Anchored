import { describe, expect, it } from "vitest";
import { cardSource, displayAgentName } from "./agent-labels";

// =============================================================================
// Module Overview
// =============================================================================
// Agents saved under an older name show under the name owners see now, and a
// card names the agent that drafted it, or Anchored.

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

  it("names Anchored for a card no agent drafted, else the agent by its current name", () => {
    expect(cardSource(null)).toBe("Anchored");
    expect(cardSource("Follow-up")).toBe("Customer agent");
    expect(cardSource("Content and Social")).toBe("Marketing agent");
  });
});
