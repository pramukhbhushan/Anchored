import { describe, expect, it } from "vitest";
import { agentProfileSlice, assembleAgentConfigs } from "@/lib/domain/agent-config";
import { profileFromFacts } from "@/lib/domain/engine";

// =============================================================================
// Module Overview
// =============================================================================
// Agent config tests keep profile boundaries explicit and confirm that an
// owner's examples reach only the agent whose work matches them.

const BUSINESS = {
  ...profileFromFacts({
    name: "Rise and Crumb",
    trade: "Bakery",
    tradeKey: "restaurant",
    reach: ["Instagram or Facebook"],
    tools: [],
    signals: [],
  }),
  details: {
    vocabulary: { customer: "guest", workUnit: "order", priceTerm: "price", bookingTerm: "pickup" },
    reminderFirmness: "firm" as const,
    promoteFocus: ["Weekend sourdough"],
    examples: [
      { kind: "post" as const, text: "Warm loaves out at noon." },
      { kind: "message" as const, text: "Thanks for stopping by." },
    ],
  },
};

describe("agentProfileSlice", () => {
  it("keeps bookkeeping-only fields out of Content", () => {
    expect(agentProfileSlice(BUSINESS, "content")).toEqual({
      vocabulary: BUSINESS.details.vocabulary,
      promoteFocus: ["Weekend sourdough"],
      examples: BUSINESS.details.examples,
    });
  });
});

describe("assembleAgentConfigs", () => {
  it("includes matching owner examples and provider-neutral model tiers", () => {
    const configs = assembleAgentConfigs(BUSINESS, {});
    const content = configs.find((config) => config.agent === "content");

    expect(content?.examples).toEqual([{ kind: "post", text: "Warm loaves out at noon." }]);
    expect(["quick", "default", "complex"]).toContain(content?.model);
    expect(content?.outputChannel).toBe("approval-card");
  });
});
