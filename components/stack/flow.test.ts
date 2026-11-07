import { describe, expect, it } from "vitest";
import { SKILL_STEPS, TOOL_STEPS, TRADE_TRIGGERS } from "@/components/stack/copy";
import { approvalRouteCount, flowRows, workFlow, type FlowLane } from "@/components/stack/flow";
import { caseStudyById } from "@/lib/domain/cases";
import { workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, ChoiceMap } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Checks the flow diagram's routes for the three case studies: who picks each
// kind of work up, which drafts wait for the owner, where the money is told,
// and that the owner-facing copy stays free of jargon and dashes.

function caseStudy(id: string): BusinessProfile {
  const business = caseStudyById(id);
  if (business === undefined) throw new Error(`No case study \`${id}\`; check \`lib/domain/cases.ts\`.`);
  return business;
}

function lane(lanes: readonly FlowLane[], name: string): FlowLane {
  const found = lanes.find((l) => l.handler.name === name);
  if (found === undefined) throw new Error(`No lane named \`${name}\`.`);
  return found;
}

describe("workFlow", () => {
  it("puts the restaurant's agents first and its tools after", () => {
    const lanes = workFlow(caseStudy("restaurant"), {});
    expect(lanes.map((l) => [l.handler.kind, l.handler.name])).toEqual([
      ["agent", "Front Desk"],
      ["agent", "Bookkeeping and Invoicing"],
      ["agent", "Content and Social"],
      ["tool", "Certus"],
      ["tool", "Orders.co Dispute assistant"],
      ["tool", "Homebase"],
      ["tool", "Google Business Profile reply box"],
    ]);
    expect(approvalRouteCount(lanes)).toBe(4);
  });

  it("leaves the daily brief and inbox sorting off the diagram", () => {
    const names = workFlow(caseStudy("coach"), {}).map((l) => l.handler.name);
    expect(names).not.toContain("Internal Communications");
  });

  it("starts each restaurant route from what a customer or supplier does", () => {
    const frontDesk = lane(workFlow(caseStudy("restaurant"), {}), "Front Desk");
    expect(frontDesk.routes.map((r) => r.trigger)).toEqual([
      "A guest books a table",
      "Someone asks about catering for an event",
    ]);
    expect(lane(workFlow(caseStudy("restaurant"), {}), "Bookkeeping and Invoicing").routes[0]?.trigger).toBe(
      "A supplier sends an invoice",
    );
  });

  it("tells a workflow's stake once, on its lead job", () => {
    const followUp = lane(workFlow(caseStudy("hvac"), {}), "Follow-up");
    const stakeOf = (key: string) => followUp.routes.find((r) => r.key === key)?.stake;
    expect(stakeOf("closer")).toMatch(/^\$14K to \$30K/);
    expect(stakeOf("debrief")).toBeNull();
  });

  it("splits a coach's lead follow-up between the two agents that run it", () => {
    const lanes = workFlow(caseStudy("coach"), {});
    expect(lane(lanes, "Front Desk").routes.map((r) => r.key)).toContain("inquiry");
    expect(lane(lanes, "Follow-up").routes.map((r) => r.key)).toContain("callfollow");
    expect(lanes.every((l) => l.handler.kind === "agent")).toBe(true);
    expect(lane(lanes, "Front Desk").routes.find((r) => r.key === "showup")?.trigger).toBe(
      "Someone books a discovery call",
    );
  });

  it("says what a tool costs or where the owner already has it", () => {
    const lanes = workFlow(caseStudy("restaurant"), {});
    const notes = lanes.flatMap((l) => (l.handler.kind === "tool" ? [l.handler.note] : []));
    expect(notes).toEqual([
      "New, $250 a month",
      "New, $29 a month",
      "New, free plan",
      "Already in Google Business Profile",
    ]);
    expect(lane(lanes, "Certus").routes[0]?.handoff).toMatch(/^Answers callers live on its own/);
  });

  it("ties each agent back to the plan on the bill", () => {
    const lanes = workFlow(caseStudy("coach"), {});
    expect(lanes.map((l) => l.handler.note)).toEqual(lanes.map(() => "In your $29 plan"));
  });

  it("draws nothing when every workflow is skipped", () => {
    const hvac = caseStudy("hvac");
    const allSkipped: ChoiceMap = Object.fromEntries(workflowIdsOf(hvac).map((id) => [id, { path: "skip" }]));
    expect(workFlow(hvac, allSkipped)).toEqual([]);
  });
});

describe("flowRows", () => {
  it("puts the restaurant's agent routes inside the band and its tools under the divider", () => {
    // Front Desk 2 routes, Bookkeeping 1, Content 1, then four one-route tools.
    const rows = flowRows(workFlow(caseStudy("restaurant"), {}));
    expect(rows.band).toEqual({ foot: 6 });
    expect(rows.divider).toBe(7);
    expect(rows.agents.map((p) => p.start)).toEqual([2, 4, 5]);
    expect(rows.tools.map((p) => p.start)).toEqual([8, 9, 10, 11]);
  });

  it("draws no band and no divider for an agents-only coach", () => {
    const lanes = workFlow(caseStudy("coach"), {});
    const rows = flowRows(lanes);
    expect(rows.divider).toBeNull();
    expect(rows.band).toEqual({ foot: 2 + approvalRouteCount(lanes) });
  });

  it("starts tools right under the headings when no agent route exists", () => {
    const hvac = caseStudy("hvac");
    const toolsOnly: ChoiceMap = Object.fromEntries(
      workflowIdsOf(hvac).map((id) => [id, id === "books" ? { path: "turnon", toolId: "quickbooks" } : { path: "skip" }]),
    );
    const rows = flowRows(workFlow(hvac, toolsOnly));
    expect(rows.band).toBeNull();
    expect(rows.divider).toBe(2);
    expect(rows.agents).toEqual([]);
    expect(rows.tools.map((p) => [p.lane.handler.name, p.start])).toEqual([["Intuit QuickBooks Online", 3]]);
  });
});

describe("owner-facing copy", () => {
  const phrases = [
    ...[...Object.values(SKILL_STEPS), ...Object.values(TOOL_STEPS)].flatMap((steps) => Object.values(steps)),
    ...Object.values(TRADE_TRIGGERS).flatMap((byTrade) => Object.values(byTrade)),
  ];

  it("never names skills, paths, models or niche agents", () => {
    for (const phrase of phrases) expect(phrase).not.toMatch(/\b(skill|path|model|niche|tier)s?\b/i);
  });

  it("uses plain hyphens and straight quotes only", () => {
    for (const phrase of phrases) expect(phrase).not.toMatch(/[\u2013\u2014\u2018\u2019\u201C\u201D]/);
  });
});
