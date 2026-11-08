import { describe, expect, it } from "vitest";
import { EXAMPLES, exampleProfile, isSampleBusinessId, SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { planWorkflows } from "@/lib/domain/engine";
import { defaultChoice, workflowIdsOf } from "@/lib/domain/paths";
import type { WorkflowId, WorkflowPlan } from "@/lib/domain/types";
import { BASE_WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The example business comes from the rules engine plus the restaurant
// research. These tests pin the research overrides, so a new one has to be
// added here on purpose.

type PathFields = Pick<WorkflowPlan, "fit" | "rec" | "skills" | "tool">;

// Every place the research replaces the rules' pick. Each one's reason is in that workflow's `why`.
const OVERRIDES: Partial<Record<WorkflowId, Partial<PathFields>>> = {
  calls: { rec: "buy", tool: "certus" },
  books: { rec: "skip" },
  leads: { rec: "skip" },
};

function pathFields(plan: WorkflowPlan | undefined): PathFields | undefined {
  return plan && { fit: plan.fit, rec: plan.rec, skills: plan.skills, tool: plan.tool };
}

describe("the example business", () => {
  it("is Linden Street Kitchen, the researched restaurant", () => {
    expect(SAMPLE_BUSINESS).toMatchObject({ id: "restaurant", name: "Linden Street Kitchen", kind: "case", builtBy: "case", nicheAgents: [] });
    expect(SAMPLE_BUSINESS.caseStudy).toBeDefined();
    expect(isSampleBusinessId("restaurant")).toBe(true);
    expect(isSampleBusinessId("hvac")).toBe(false);
  });

  it("includes the five base workflows", () => {
    for (const id of BASE_WORKFLOWS) expect(SAMPLE_BUSINESS.workflows[id]).toBeDefined();
  });

  it("matches the rules on its own facts, except the listed overrides", () => {
    const ruled = planWorkflows(SAMPLE_BUSINESS);
    const ruledIds = workflowIdsOf({ workflows: ruled });
    expect(workflowIdsOf(SAMPLE_BUSINESS)).toEqual(ruledIds);
    for (const workflow of ruledIds) {
      const expected = { ...pathFields(ruled[workflow]), ...OVERRIDES[workflow] };
      expect(pathFields(SAMPLE_BUSINESS.workflows[workflow]), workflow).toEqual(expected);
    }
  });

  it("keeps calls on Certus, since a live call can't wait for a tap", () => {
    expect(SAMPLE_BUSINESS.workflows.calls?.why).toContain("can't wait for your tap");
    expect(defaultChoice(SAMPLE_BUSINESS, "calls")).toEqual({ path: "buy", toolId: "certus" });
  });

  it("turns on its own OpenTable for no-shows before building anything", () => {
    expect(defaultChoice(SAMPLE_BUSINESS, "noshows")).toEqual({ path: "turnon", toolId: "opentable" });
  });

  it("carries the researched text and cards", () => {
    expect(SAMPLE_BUSINESS.workflows.invoices?.stake).toBe("About $6,700 a year per point of food cost, estimated");
    expect(SAMPLE_BUSINESS.cards?.catering?.stake).toBe(420);
    expect(SAMPLE_BUSINESS.lockedCards?.[0]?.skill).toBe("catering");
  });

  it("calls its worked-out numbers estimates, as an owner would", () => {
    for (const [workflow, plan] of Object.entries(SAMPLE_BUSINESS.workflows)) {
      expect(`${plan.why} ${plan.stake}`, workflow).not.toMatch(/\bmodel(?:ed|ing)\b/i);
    }
  });
});

describe("examples", () => {
  it("build through the rules engine with id `ex-<id>`", () => {
    for (const example of EXAMPLES) {
      const profile = exampleProfile(example.id);
      expect(profile.id).toBe(`ex-${example.id}`);
      expect(profile.name).toBe(example.name);
      expect(profile.builtBy).toBe("rules");
    }
  });

  it("fall back to the first example for an unknown id", () => {
    expect(exampleProfile("nope").id).toBe(`ex-${EXAMPLES[0].id}`);
  });
});
