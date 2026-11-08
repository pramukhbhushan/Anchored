import { describe, expect, it } from "vitest";
import { exampleProfile, SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { profileFromFacts } from "@/lib/domain/engine";
import {
  activeAgents,
  agentForSkill,
  agentName,
  chosenSkills,
  defaultChoice,
  pathOptions,
  resolveChoices,
  stackCost,
  workflowIdsOf,
} from "@/lib/domain/paths";
import type { BusinessProfile, Choice, ChoiceMap, WorkflowId } from "@/lib/domain/types";
import { careerCoach, hvacShop } from "@/test/trades";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the three paths, the owner's picks, the agents those picks put to
// work, and what the stack costs.

/** The given picks, with every other workflow of the business skipped. */
function only(business: BusinessProfile, picks: ChoiceMap): ChoiceMap {
  const choices: Partial<Record<WorkflowId, Choice>> = {};
  for (const id of workflowIdsOf(business)) choices[id] = picks[id] ?? { path: "skip" };
  return choices;
}

describe("default picks", () => {
  it("turns on QuickBooks for HVAC bookkeeping", () => {
    expect(defaultChoice(hvacShop(), "books")).toEqual({ path: "turnon", toolId: "quickbooks" });
  });

  it("builds with the plan's skills", () => {
    expect(defaultChoice(hvacShop(), "quotes")).toEqual({ path: "build", skills: ["closer"] });
  });

  it("resolves only the business's workflows, and a saved pick wins", () => {
    const hvac = hvacShop();
    const resolved = resolveChoices(hvac, { books: { path: "skip" }, snap: { path: "skip" } });
    expect(Object.keys(resolved)).toEqual(workflowIdsOf(hvac));
    expect(resolved.books).toEqual({ path: "skip" });
    expect(resolved.calls).toEqual({ path: "build", skills: ["callback"] });
  });
});

describe("agents", () => {
  it("always runs Internal Communications with the daily brief and inbox triage", () => {
    const hvac = hvacShop();
    expect(activeAgents(hvac, only(hvac, {}))).toEqual([
      expect.objectContaining({ id: "internal", skills: ["brief", "triage"], niche: false, approval: "every-card" }),
    ]);
  });

  it("adds license renewals to Internal Communications when chosen", () => {
    const corner = exampleProfile("corner");
    const agents = activeAgents(corner, only(corner, { licenses: { path: "build", skills: ["license"] } }));
    expect(agents.find((agent) => agent.id === "internal")?.skills).toEqual(["brief", "triage", "license"]);
  });

  it("lists core agents only when one of their skills is chosen", () => {
    const hvac = hvacShop();
    expect(activeAgents(hvac, {}).map((agent) => agent.id)).toEqual(["frontdesk", "followup", "content", "internal"]);
    expect(chosenSkills(hvac, {})).toEqual(["callback", "inquiry", "posts", "closer", "keeper"]);
  });

  it("runs the corner store's SNAP check on its spawned niche agent at every-card approval", () => {
    const corner = exampleProfile("corner");
    expect(corner.nicheAgents).toEqual([
      expect.objectContaining({
        id: "niche:snap-stock-check",
        name: "SNAP Stock Check",
        spawnedBecause: "You accept SNAP or EBT",
        approval: "every-card",
      }),
    ]);
    expect(pathOptions(corner, "snap").build).toEqual({
      agent: "niche:snap-stock-check",
      agentName: "SNAP Stock Check",
      skills: ["stockcheck"],
    });
    expect(agentForSkill(corner, "stockcheck")).toBe("niche:snap-stock-check");
    expect(activeAgents(corner, {})).toContainEqual(
      expect.objectContaining({ id: "niche:snap-stock-check", skills: ["stockcheck"], niche: true, approval: "every-card" }),
    );
  });

  it("has no build path for SNAP without a niche agent to run it", () => {
    const corner = exampleProfile("corner");
    expect(pathOptions({ ...corner, nicheAgents: [] }, "snap").build).toBeNull();
  });

  it("names core and niche agents", () => {
    const corner = exampleProfile("corner");
    expect(agentName(corner, "books")).toBe("Bookkeeping and Invoicing");
    expect(agentName(corner, "niche:snap-stock-check")).toBe("SNAP Stock Check");
  });
});

describe("owned tools", () => {
  const salon = exampleProfile("salon");

  it("doesn't count a paid add-on as owned just because the owner uses its platform", () => {
    for (const workflow of ["scheduling", "social"] as const) {
      const options = pathOptions(salon, workflow);
      expect(options.owned.map((tool) => tool.id), workflow).toEqual([]);
      expect(options.buy.map(({ tool }) => tool.id), workflow).toContain("squaremates");
    }
    const toastShop = { ...SAMPLE_BUSINESS, tools: ["Toast"] };
    expect(pathOptions(toastShop, "social").owned.map((tool) => tool.id)).not.toContain("toastiq");
  });

  it("offers tools the owner already uses: OpenTable for no-shows, Stripe for invoicing", () => {
    expect(pathOptions(SAMPLE_BUSINESS, "noshows").owned.map((tool) => tool.id)).toEqual(["opentable"]);
    expect(pathOptions(careerCoach(), "books").owned.map((tool) => tool.id)).toEqual(["stripe-invoicing"]);
    expect(defaultChoice(exampleProfile("tutor"), "books")).toEqual({ path: "turnon", toolId: "stripe-invoicing" });
    const bistro = profileFromFacts({ name: "Bistro", trade: "Bistro", tradeKey: "restaurant", reach: [], tools: ["OpenTable"], signals: ["appointments"] });
    expect(defaultChoice(bistro, "noshows")).toEqual({ path: "turnon", toolId: "opentable" });
  });

  it("lists Squaremates as priced on quote, since its agent price isn't published", () => {
    const cost = stackCost(salon, only(salon, { scheduling: { path: "buy", toolId: "squaremates" } }));
    expect(cost.onQuote.map((tool) => tool.id)).toEqual(["squaremates"]);
  });

  it("says who decides in an owner's sentence, not a vendor quote", () => {
    const squaremates = pathOptions(salon, "scheduling").buy.find(({ tool }) => tool.id === "squaremates");
    const note = squaremates?.rating.checks.charge[2] ?? "";
    expect(note).not.toMatch(/['"]/);
    expect(note).toMatch(/\byou\b/i);
  });
});

describe("stackCost", () => {
  const hvac = hvacShop();

  it("counts a turned-on tool as zero", () => {
    expect(stackCost(hvac, only(hvac, { books: { path: "turnon", toolId: "quickbooks" } }))).toEqual({
      tools: 0,
      plan: 0,
      total: 0,
      onQuote: [],
    });
  });

  it("charges for a bought tool, per seat when it bills per user", () => {
    expect(stackCost(hvac, only(hvac, { books: { path: "buy", toolId: "quickbooks" } })).total).toBe(38);
    expect(stackCost(hvac, only(hvac, { calls: { path: "buy", toolId: "servicetitan" } })).tools).toBe(250 * 6);
  });

  it("adds the $29 plan only once a build skill is chosen", () => {
    const withAgents = only(hvac, {
      calls: { path: "build", skills: ["callback"] },
      leads: { path: "build", skills: ["inquiry"] },
    });
    expect(stackCost(hvac, withAgents)).toMatchObject({ tools: 0, plan: 29, total: 29 });
  });

  it("lists quote-only tools apart from the monthly total", () => {
    const cost = stackCost(hvac, only(hvac, { leads: { path: "buy", toolId: "housecall" } }));
    expect(cost.total).toBe(0);
    expect(cost.onQuote.map((tool) => tool.id)).toEqual(["housecall"]);
  });
});
