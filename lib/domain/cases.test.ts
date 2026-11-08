import { describe, expect, it } from "vitest";
import { CASE_STUDIES, caseStudyById, EXAMPLES, exampleProfile } from "@/lib/domain/cases";
import { planWorkflows } from "@/lib/domain/engine";
import { defaultChoice, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, WorkflowId, WorkflowPlan } from "@/lib/domain/types";
import { BASE_WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Case studies come from the rules engine plus research. These tests pin the
// research overrides, so a new one has to be added here on purpose.

type PathFields = Pick<WorkflowPlan, "fit" | "rec" | "skills" | "tool">;

// Every place the research replaces the rules' pick. Each one's reason is in that workflow's `why`.
const OVERRIDES: Readonly<Record<string, Partial<Record<WorkflowId, Partial<PathFields>>>>> = {
  hvac: { social: { skills: ["reactivator"] }, quotes: { skills: ["closer", "debrief"] }, reviews: { rec: "build" } },
  restaurant: { calls: { rec: "buy", tool: "certus" }, books: { rec: "skip" }, leads: { rec: "skip" } },
  coach: { books: { rec: "build" }, leads: { skills: ["inquiry", "callfollow"] }, noshows: { rec: "build" } },
};

function caseStudy(id: string): BusinessProfile {
  const found = caseStudyById(id);
  if (found === undefined) throw new Error(`no case study \`${id}\``);
  return found;
}

function pathFields(plan: WorkflowPlan | undefined): PathFields | undefined {
  return plan && { fit: plan.fit, rec: plan.rec, skills: plan.skills, tool: plan.tool };
}

describe("case studies", () => {
  it("are the HVAC, restaurant and coaching businesses", () => {
    expect(CASE_STUDIES.map((business) => business.id)).toEqual(["hvac", "restaurant", "coach"]);
    for (const business of CASE_STUDIES) {
      expect(business).toMatchObject({ kind: "case", builtBy: "case", nicheAgents: [] });
      expect(business.caseStudy).toBeDefined();
    }
  });

  it.each(CASE_STUDIES.map((business) => [business.id, business] as const))(
    "%s includes the five base workflows",
    (_id, business) => {
      for (const id of BASE_WORKFLOWS) expect(business.workflows[id]).toBeDefined();
    },
  );

  it.each(CASE_STUDIES.map((business) => [business.id, business] as const))(
    "%s matches the rules on its own facts, except the listed overrides",
    (id, business) => {
      const ruled = planWorkflows(business);
      const ruledIds = workflowIdsOf({ workflows: ruled });
      expect(workflowIdsOf(business)).toEqual(ruledIds);
      for (const workflow of ruledIds) {
        const expected = { ...pathFields(ruled[workflow]), ...OVERRIDES[id]?.[workflow] };
        expect(pathFields(business.workflows[workflow]), workflow).toEqual(expected);
      }
    },
  );

  it("keeps the restaurant's calls on Certus, since a live call can't wait for a tap", () => {
    const restaurant = caseStudy("restaurant");
    expect(restaurant.workflows.calls?.why).toContain("can't wait for your tap");
    expect(defaultChoice(restaurant, "calls")).toEqual({ path: "buy", toolId: "certus" });
  });

  it("turns on the restaurant's own OpenTable for no-shows before building anything", () => {
    expect(defaultChoice(caseStudy("restaurant"), "noshows")).toEqual({ path: "turnon", toolId: "opentable" });
  });

  it("carries the researched text and cards", () => {
    const hvac = caseStudy("hvac");
    expect(hvac.workflows.quotes?.stake).toBe("$14K to $30K a month in sales if 2 more of 10 quotes close, modeled");
    expect(hvac.cards?.closer?.stake).toBe(11400);
    expect(caseStudy("restaurant").lockedCards?.[0]?.skill).toBe("catering");
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
