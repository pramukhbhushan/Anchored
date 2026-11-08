import { describe, expect, it } from "vitest";
import { SKILL_STEPS, TOOL_STEPS, TRADE_TRIGGERS } from "@/components/workflows/copy";
import { changeOptions, whoHandles, workflowFlow } from "@/components/workflows/flow";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { resolveChoices, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, ChoiceMap, WorkflowId } from "@/lib/domain/types";
import { careerCoach, hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Each workflow as the Workflows graph tells it: who handles it in the owner's
// words, what starts it, the draft that waits for the owner's OK, and what the
// owner gets. Checked on the example restaurant and on an HVAC shop and a
// coach the rules map, with no path names anywhere in the copy.

/** The flow for `id` at `business` with `saved` picks laid over Anchored's. */
function flowOf(business: BusinessProfile, id: WorkflowId, saved: ChoiceMap = {}) {
  return workflowFlow(business, resolveChoices(business, saved), id);
}

/** Who handles `id` at `business` with `saved` picks laid over Anchored's. */
function handlerOf(business: BusinessProfile, id: WorkflowId, saved: ChoiceMap = {}) {
  return whoHandles(business, resolveChoices(business, saved), id);
}

describe("whoHandles", () => {
  it("names a tool the owner already has as theirs", () => {
    const handler = handlerOf(SAMPLE_BUSINESS, "noshows");
    expect(handler).toMatchObject({ kind: "owned", name: "Your OpenTable", short: "Your OpenTable" });
    expect(handler.line).toBe("Your OpenTable sends booking reminders");
  });

  it("names a new tool with what it costs a month", () => {
    const handler = handlerOf(SAMPLE_BUSINESS, "calls");
    expect(handler).toMatchObject({ kind: "new", name: "Certus", short: "Certus, $250 a month", note: "New, $250 a month" });
    expect(handler.line).toBe("Certus answers the phone for you, $250 a month");
    expect(handlerOf(SAMPLE_BUSINESS, "scheduling").short).toBe("Homebase, free plan");
  });

  it("says Anchored drafts the work and the owner approves it", () => {
    const handler = handlerOf(SAMPLE_BUSINESS, "catering");
    expect(handler).toMatchObject({ kind: "agent", short: "Anchored drafts, you approve" });
    expect(handler.line).toBe("Anchored drafts it, you approve it");
    expect(handler.note).toBe("Front Desk agent, in your $29 plan");
  });

  it("says plainly when nothing handles a workflow", () => {
    expect(handlerOf(SAMPLE_BUSINESS, "books")).toMatchObject({ kind: "none", name: "Not handled yet", short: "Not handled yet" });
  });
});

describe("workflowFlow", () => {
  it("follows an agent's work from what starts it to the draft that waits for the owner", () => {
    const flow = flowOf(SAMPLE_BUSINESS, "catering");
    expect(flow.name).toBe("Catering and events");
    expect(flow.routes).toEqual([
      {
        key: "catering",
        trigger: "Someone asks about catering for an event",
        draft: "A reply with three packages to pick from",
        rule: null,
        result: "A catering order on the books",
      },
    ]);
    expect(flow.stake).toMatch(/^About \$4,700 a year/);
  });

  it("gives a tool no draft to approve and says who decides what it does", () => {
    const [route] = flowOf(SAMPLE_BUSINESS, "calls").routes;
    expect(route?.draft).toBeNull();
    expect(route?.rule).toMatch(/^Answers callers live on its own/);
    expect(route?.trigger).toBe(TOOL_STEPS.calls.trigger);
  });

  it("draws one route for each job when a workflow takes two", () => {
    const flow = flowOf(hvacShop(), "quotes");
    expect(flow.routes.map((r) => r.key)).toEqual(["closer", "debrief"]);
    expect(flow.routes.every((r) => r.draft !== null)).toBe(true);
  });

  it("starts a job in the trade's own words", () => {
    const flow = flowOf(careerCoach(), "noshows", { noshows: { path: "build", skills: ["showup"] } });
    expect(flow.routes[0]?.trigger).toBe("Someone books a discovery call");
  });

  it("keeps the money at stake on work nothing handles yet, with no result", () => {
    const flow = flowOf(SAMPLE_BUSINESS, "disputes", { disputes: { path: "skip" } });
    expect(flow.routes).toEqual([{ key: "disputes", trigger: TOOL_STEPS.disputes.trigger, draft: null, rule: null, result: null }]);
    expect(flow.stake).toMatch(/^\$1,700 to \$2,000/);
  });

  it("gives no stake when the research has no figure", () => {
    expect(flowOf(SAMPLE_BUSINESS, "social").stake).toBeNull();
  });
});

describe("changeOptions", () => {
  it("offers the owner's own tool, a new one, Anchored's draft and leaving it, as outcomes", () => {
    const options = changeOptions(hvacShop(), resolveChoices(hvacShop(), {}), "books");
    expect(options.map((o) => [o.kind, o.title])).toEqual([
      ["owned", "Use your QuickBooks Online"],
      ["new", expect.stringMatching(/^Sign up for /)],
      ["agent", "Let Anchored draft it for your OK"],
      ["none", "Leave it for now"],
    ]);
    expect(options.find((o) => o.kind === "owned")?.current).toBe(true);
    expect(options.find((o) => o.kind === "owned")?.ours).toBe(true);
  });

  it("sends the request the choices route expects for each option", () => {
    const options = changeOptions(SAMPLE_BUSINESS, resolveChoices(SAMPLE_BUSINESS, {}), "calls");
    expect(options.map((o) => o.request)).toContainEqual({ workflow: "calls", path: "buy", toolId: "certus" });
    expect(options.map((o) => o.request)).toContainEqual({ workflow: "calls", path: "skip" });
  });

  it("leaves out what does not exist for a workflow", () => {
    const options = changeOptions(SAMPLE_BUSINESS, resolveChoices(SAMPLE_BUSINESS, {}), "disputes");
    expect(options.map((o) => o.kind)).not.toContain("owned");
  });
});

describe("owner-facing copy", () => {
  const businesses = [SAMPLE_BUSINESS, hvacShop(), careerCoach()];
  const lines = businesses.flatMap((business) => {
    const choices = resolveChoices(business, {});
    return workflowIdsOf(business).flatMap((id) => {
      const handler = whoHandles(business, choices, id);
      const options = changeOptions(business, choices, id);
      return [handler.line, handler.short, handler.name, handler.note, ...options.flatMap((o) => [o.title, o.detail])];
    });
  });
  const steps = [
    ...[...Object.values(SKILL_STEPS), ...Object.values(TOOL_STEPS)].flatMap((s) => Object.values(s)),
    ...Object.values(TRADE_TRIGGERS).flatMap((byTrade) => Object.values(byTrade)),
  ];

  it("never says turn on, buy, build or skip", () => {
    for (const line of lines) expect(line).not.toMatch(/\b(turn on|buy|build|built|skip|skipped|path)\b/i);
  });

  it("never names skills, paths, models or niche agents in the steps", () => {
    for (const phrase of steps) expect(phrase).not.toMatch(/\b(skill|path|model|niche|tier)s?\b/i);
  });

  it("uses plain hyphens and straight quotes only", () => {
    for (const phrase of [...lines, ...steps]) expect(phrase).not.toMatch(/[–—‘’“”]/);
  });
});
