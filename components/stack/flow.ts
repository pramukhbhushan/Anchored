import { SKILL_STEPS, TOOL_STEPS, TRADE_TRIGGERS } from "@/components/stack/copy";
import { money } from "@/components/view-helpers";
import { STANDING_SKILLS } from "@/lib/domain/agents";
import { toolName } from "@/lib/domain/catalog";
import { activeAgents, chosenTools, monthlyCost, resolveChoices, stackCost, workflowIdsOf } from "@/lib/domain/paths";
import type { AgentRef, BusinessProfile, ChoiceMap, SkillId, Tool } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The routes behind the Stack page's flow diagram. `workFlow` turns the
// owner's picks into `FlowLane`s: one per agent or tool, each holding the
// `FlowRoute`s it handles, from what sets the work off to what the owner gets.
// Agent lanes come first because their drafts all wait for the owner's OK;
// `flowRows` places the lanes on the wide diagram's grid rows.

/** Who picks the work up: one of Anchored's agents, or a tool the owner buys or already has. */
export type FlowHandler =
  | {
      readonly kind: "agent";
      readonly id: AgentRef;
      readonly name: string;
      /** "In your $29 plan", or "Made for you, in your $29 plan" for an agent spawned for this business. */
      readonly note: string;
    }
  | {
      readonly kind: "tool";
      readonly id: string;
      readonly name: string;
      readonly path: "buy" | "turnon";
      /** "New, $250 a month" or "Already in Google Business Profile". */
      readonly note: string;
    };

/** One kind of work from start to finish. */
export interface FlowRoute {
  readonly key: string;
  readonly trigger: string;
  /** For an agent, the draft that waits for the owner's OK; for a tool, who decides what it does. */
  readonly handoff: string;
  readonly result: string;
  /** What the research says rides on this work, or `null` when it gives no figure. */
  readonly stake: string | null;
}

/** One agent or tool and the routes it handles. */
export interface FlowLane {
  readonly handler: FlowHandler;
  readonly routes: readonly FlowRoute[];
}

// =============================================================================
// The flow
// =============================================================================

/** Return the lanes for the flow diagram: agents in `activeAgents` order, then tools in workflow order. */
export function workFlow(business: BusinessProfile, choices: ChoiceMap): FlowLane[] {
  return [...agentLanes(business, choices), ...toolLanes(business, choices)];
}

/** Count the routes whose drafts wait for the owner's OK. */
export function approvalRouteCount(lanes: readonly FlowLane[]): number {
  return lanes.filter((lane) => lane.handler.kind === "agent").reduce((sum, lane) => sum + lane.routes.length, 0);
}

/** A lane and the grid row its first route takes; its other routes take the rows after it. */
export interface PlacedLane {
  readonly lane: FlowLane;
  readonly start: number;
}

/** Grid rows for the wide diagram, 1-based: column headings on row 1, then agent routes, then tool routes. */
export interface FlowRows {
  /** The approvals band runs from row 1 to `foot`, its closing note; `null` when no agent route exists. */
  readonly band: { readonly foot: number } | null;
  /** The row of the line that opens the tool lanes, or `null` when there are none. */
  readonly divider: number | null;
  readonly agents: readonly PlacedLane[];
  readonly tools: readonly PlacedLane[];
}

/** Lay `lanes` onto grid rows: agent lanes inside the approvals band, tool lanes under the divider. */
export function flowRows(lanes: readonly FlowLane[]): FlowRows {
  const approvals = approvalRouteCount(lanes);
  const band = approvals > 0 ? { foot: 2 + approvals } : null;
  const toolLanes = lanes.filter((lane) => lane.handler.kind === "tool");
  const divider = toolLanes.length === 0 ? null : band === null ? 2 : band.foot + 1;
  return {
    band,
    divider,
    agents: stack(lanes.filter((lane) => lane.handler.kind === "agent"), 2),
    tools: stack(toolLanes, (divider ?? 0) + 1),
  };
}

/** Place `lanes` one after another from row `first`, each taking a row per route. */
function stack(lanes: readonly FlowLane[], first: number): PlacedLane[] {
  let next = first;
  return lanes.map((lane) => {
    const start = next;
    next += lane.routes.length;
    return { lane, start };
  });
}

// -----------------------------------------------------------------
// Agents
// -----------------------------------------------------------------

function agentLanes(business: BusinessProfile, choices: ChoiceMap): FlowLane[] {
  const stakes = stakeBySkill(business, choices);
  const plan = money(stackCost(business, choices).plan);
  return activeAgents(business, choices).flatMap((agent): FlowLane[] => {
    // The daily brief and inbox triage run for every business and start from no customer, so they stay off the flow.
    const skills = agent.skills.filter((skill) => !STANDING_SKILLS.includes(skill));
    if (skills.length === 0) return [];
    const routes = skills.map((skill): FlowRoute => {
      const steps = SKILL_STEPS[skill];
      const trigger = TRADE_TRIGGERS[business.tradeKey]?.[skill] ?? steps.trigger;
      return { key: skill, trigger, handoff: steps.draft, result: steps.result, stake: stakes.get(skill) ?? null };
    });
    const note = agent.niche ? `Made for you, in your ${plan} plan` : `In your ${plan} plan`;
    return [{ handler: { kind: "agent", id: agent.id, name: agent.name, note }, routes }];
  });
}

/** Map the lead skill of each built workflow to that workflow's researched stake. */
function stakeBySkill(business: BusinessProfile, choices: ChoiceMap): Map<SkillId, string> {
  const resolved = resolveChoices(business, choices);
  const stakes = new Map<SkillId, string>();
  for (const id of workflowIdsOf(business)) {
    const choice = resolved[id];
    const stake = business.workflows[id]?.stake ?? "";
    if (choice.path !== "build" || stake === "") continue;
    const [lead] = choice.skills;
    // A workflow's stake is told once, on its lead skill, so two routes never claim the same money.
    if (lead !== undefined && !stakes.has(lead)) stakes.set(lead, stake);
  }
  return stakes;
}

// -----------------------------------------------------------------
// Tools
// -----------------------------------------------------------------

function toolLanes(business: BusinessProfile, choices: ChoiceMap): FlowLane[] {
  const lanes = new Map<string, { handler: FlowHandler; routes: FlowRoute[] }>();
  for (const { tool, path, workflow } of chosenTools(business, choices)) {
    const steps = TOOL_STEPS[workflow];
    const stake = business.workflows[workflow]?.stake ?? "";
    const route: FlowRoute = {
      key: `${tool.id}:${workflow}`,
      trigger: steps.trigger,
      handoff: whoDecides(tool),
      result: steps.result,
      stake: stake === "" ? null : stake,
    };
    const lane = lanes.get(tool.id);
    // One tool can cover two workflows; it gets one lane with a route for each.
    if (lane === undefined) lanes.set(tool.id, { handler: toolHandler(tool, path, business), routes: [route] });
    else lane.routes.push(route);
  }
  return [...lanes.values()];
}

function toolHandler(tool: Tool, path: "buy" | "turnon", business: BusinessProfile): FlowHandler {
  return { kind: "tool", id: tool.id, name: toolName(tool), path, note: toolNote(tool, path, business) };
}

/** Say whether the owner already has a tool or what it adds to the bill. */
function toolNote(tool: Tool, path: "buy" | "turnon", business: BusinessProfile): string {
  if (path === "turnon") return `Already in ${tool.platform ?? tool.maker}`;
  const amount = monthlyCost(tool, business);
  if (amount === null) return "New, priced on quote";
  return amount === 0 ? "New, free plan" : `New, ${money(amount)} a month`;
}

/** Say who decides what a tool does, from its researched "in charge" check. */
function whoDecides(tool: Tool): string {
  const [status, , note] = tool.checks.charge;
  // An unknown check's note reads "Not stated", which means nothing beside a diagram step.
  return status === "unknown" ? "Ask the vendor who approves its work" : note;
}
