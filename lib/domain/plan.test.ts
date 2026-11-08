import { describe, expect, it } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { approvePlan, planStatus } from "@/lib/domain/plan";
import type { BusinessProfile, ChoiceMap } from "@/lib/domain/types";
import { hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's yes to the plan as a whole: a new business waits for it, an
// approval makes the plan live, and changing a step afterwards marks the plan
// changed until the owner approves again or puts the step back.

const NOW = new Date("2026-11-07T15:30:00.000Z");

/** `business` after the owner approved the plan they saw with `choices`. */
function approved(business: BusinessProfile, choices: ChoiceMap = {}): BusinessProfile {
  return { ...business, planApproval: approvePlan(business, choices, NOW) };
}

describe("planStatus", () => {
  it("waits for the owner on a business they just mapped", () => {
    expect(planStatus(hvacShop(), {})).toEqual({ kind: "draft" });
  });

  it("is live once the owner approves Anchored's picks", () => {
    const shop = approved(hvacShop());
    expect(planStatus(shop, {})).toEqual({ kind: "live", approvedAt: "2026-11-07T15:30:00.000Z" });
  });

  it("names the steps the owner changed after approving", () => {
    const shop = approved(hvacShop());
    const status = planStatus(shop, { calls: { path: "skip" }, leads: { path: "skip" } });
    expect(status).toEqual({ kind: "changed", approvedAt: "2026-11-07T15:30:00.000Z", changed: ["calls", "leads"] });
  });

  it("is live again when a changed step goes back to what was approved", () => {
    const skipCalls: ChoiceMap = { calls: { path: "skip" } };
    const shop = approved(hvacShop(), skipCalls);
    expect(planStatus(shop, skipCalls).kind).toBe("live");
    expect(planStatus(shop, {}).kind).toBe("changed");
  });

  it("counts a workflow added after the approval as a change", () => {
    const { catering: _catering, ...without } = SAMPLE_BUSINESS.workflows;
    const before = approved({ ...SAMPLE_BUSINESS, workflows: without });
    const after: BusinessProfile = { ...before, workflows: SAMPLE_BUSINESS.workflows };
    expect(planStatus(before, {}).kind).toBe("live");
    expect(planStatus(after, {})).toMatchObject({ kind: "changed", changed: ["catering"] });
  });

  it("shows the example restaurant's plan as live", () => {
    expect(planStatus(SAMPLE_BUSINESS, {}).kind).toBe("live");
  });
});
