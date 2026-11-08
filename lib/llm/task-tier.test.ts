import { describe, expect, it } from "vitest";
import { TASK_TIER, tierForTask } from "@/lib/llm/task-tier";

// =============================================================================
// Module Overview
// =============================================================================
// The model task map keeps short work cheap, normal drafts on the default tier
// and only multi-step work on the strongest configured tier.

describe("TASK_TIER", () => {
  it("uses the complex tier only for discovery and multi-step work", () => {
    expect(tierForTask("live_reply")).toBe("quick");
    expect(tierForTask("extraction")).toBe("default");
    expect(tierForTask("multi_step")).toBe("complex");
    expect(Object.entries(TASK_TIER).filter(([, tier]) => tier === "complex").map(([task]) => task)).toEqual(["discovery", "multi_step"]);
  });
});
