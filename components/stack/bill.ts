import { TOOL_STEPS } from "@/components/workflows/copy";
import { money } from "@/components/view-helpers";
import { SKILLS } from "@/lib/domain/agents";
import { toolName } from "@/lib/domain/catalog";
import { activeAgents, chosenTools, monthlyCost, resolveChoices, stackCost, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, ChoiceMap, Tool, WorkflowId } from "@/lib/domain/types";
import { WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The monthly bill behind the Stack page's cost picture. `monthlyBill` sorts
// the owner's picks into four groups (Anchored's agents, new subscriptions,
// tools they already have, and work nothing handles yet) and lists the paid pieces as
// `BillSegment`s for the stacked bar. Totals come from `stackCost`.

/** The four ways a piece of the stack shows up on the bill. */
export type BillGroupId = "buy" | "build" | "turnon" | "skip";

/** One piece of the stack: a tool, an agent, or a skipped workflow. */
export interface BillLine {
  readonly key: string;
  readonly name: string;
  /** What it does for the owner, one short phrase each. */
  readonly does: readonly string[];
  /** Price as the owner reads it ("$250", "Free", "On quote"), or `null` when the group's total says it. */
  readonly price: string | null;
}

/** The lines in one group and what the group costs a month. */
export interface BillGroup {
  readonly id: BillGroupId;
  readonly amount: number;
  readonly lines: readonly BillLine[];
}

/** One paid piece in the stacked bar, sized by `share` of the priced total. */
export interface BillSegment {
  readonly key: string;
  readonly group: "buy" | "build";
  readonly name: string;
  readonly amount: number;
  /** Fraction of `MonthlyBill.total`, 0 to 1. */
  readonly share: number;
}

/** Everything the cost picture draws. */
export interface MonthlyBill {
  readonly total: number;
  /** Anchored's plan, or 0 when no agent is chosen. */
  readonly plan: number;
  /** Tools whose vendor only quotes, so they sit outside `total`. */
  readonly onQuote: readonly string[];
  readonly segments: readonly BillSegment[];
  /** Always all four groups, in bill order, so the legend keeps its shape. */
  readonly groups: readonly BillGroup[];
}

/** The bill's name for Anchored's own segment. */
export const ANCHORED_SEGMENT_NAME = "Anchored's agents";

// =============================================================================
// The bill
// =============================================================================

/** Sort the owner's picks into the four bill groups and the bar's paid segments. */
export function monthlyBill(business: BusinessProfile, choices: ChoiceMap): MonthlyBill {
  const cost = stackCost(business, choices);
  const tools = toolsOnce(business, choices);
  const bought = tools.filter((t) => t.path === "buy");
  const owned = tools.filter((t) => t.path === "turnon");

  const buyLines = bought.map(({ tool, workflows }) => toolLine(tool, workflows, buyPrice(tool, business)));
  const turnonLines = owned.map(({ tool, workflows }) => toolLine(tool, workflows, "Already paid"));
  const agentLines = activeAgents(business, choices).map(
    (agent): BillLine => ({ key: agent.id, name: agent.name, does: agent.skills.map((s) => SKILLS[s].job), price: null }),
  );
  const resolved = resolveChoices(business, choices);
  const skipLines = workflowIdsOf(business)
    .filter((id) => resolved[id].path === "skip")
    .map((id): BillLine => ({ key: id, name: WORKFLOWS[id].name, does: [], price: null }));

  const toolSegments = bought.flatMap(({ tool }): BillSegment[] => {
    const amount = monthlyCost(tool, business);
    return amount === null || amount <= 0 ? [] : [segment(tool.id, "buy", toolName(tool), amount, cost.total)];
  });
  // Largest first, so the bar reads like the bill's biggest line.
  toolSegments.sort((a, z) => z.amount - a.amount);
  const planSegment = cost.plan > 0 ? [segment("anchored", "build", ANCHORED_SEGMENT_NAME, cost.plan, cost.total)] : [];

  // Anchored leads both the bar and the groups, so the yellow segment and the agents' column line up.
  return {
    total: cost.total,
    plan: cost.plan,
    onQuote: cost.onQuote.map(toolName),
    segments: [...planSegment, ...toolSegments],
    groups: [
      // Agents are listed even when none is chosen, so Internal Communications still shows; the plan is $0 then.
      { id: "build", amount: cost.plan, lines: agentLines },
      { id: "buy", amount: cost.tools, lines: buyLines },
      { id: "turnon", amount: 0, lines: turnonLines },
      { id: "skip", amount: 0, lines: skipLines },
    ],
  };
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** A chosen tool with every workflow it covers here. */
interface ToolPick {
  readonly tool: Tool;
  readonly path: "turnon" | "buy";
  readonly workflows: readonly WorkflowId[];
}

/** Each chosen tool once, with all its workflows. */
function toolsOnce(business: BusinessProfile, choices: ChoiceMap): ToolPick[] {
  const byId = new Map<string, ToolPick>();
  for (const { tool, path, workflow } of chosenTools(business, choices)) {
    const seen = byId.get(tool.id);
    // The first workflow's path wins, the same rule `stackCost` prices by.
    byId.set(tool.id, seen === undefined ? { tool, path, workflows: [workflow] } : { ...seen, workflows: [...seen.workflows, workflow] });
  }
  return [...byId.values()];
}

function toolLine(tool: Tool, workflows: readonly WorkflowId[], price: string): BillLine {
  return { key: tool.id, name: toolName(tool), does: workflows.map((w) => TOOL_STEPS[w].does), price };
}

/** A bought tool's monthly price as the owner reads it. */
function buyPrice(tool: Tool, business: BusinessProfile): string {
  const amount = monthlyCost(tool, business);
  if (amount === null) return "On quote";
  return amount === 0 ? "Free" : money(amount);
}

function segment(key: string, group: BillSegment["group"], name: string, amount: number, total: number): BillSegment {
  return { key, group, name, amount, share: total > 0 ? amount / total : 0 };
}
