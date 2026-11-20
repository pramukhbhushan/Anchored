import { SKILL_STEPS, TOOL_STEPS, TRADE_TRIGGERS } from "@/components/workflows/copy";
import { displayAgentName } from "@/components/agent-labels";
import { money } from "@/components/view-helpers";
import type { SetChoiceRequest } from "@/lib/api/contract";
import { SKILLS } from "@/lib/domain/agents";
import { toolById, toolName } from "@/lib/domain/catalog";
import { AGENT_PLAN_MONTHLY, monthlyCost, pathOptions } from "@/lib/domain/paths";
import { rateTool } from "@/lib/domain/rating";
import type { BusinessProfile, Choice, PathOptions, Tool, WorkflowId } from "@/lib/domain/types";
import { WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Each workflow as the owner would tell it, for the Workflows graph and every
// place that says who handles a job. `whoHandles` names the handler in owner
// words, `workflowFlow` follows the work from what starts it to what the owner
// gets, and `changeOptions` offers the other handlers as outcomes. No path
// names (turn on, buy, build, skip) reach the owner from here.

/** Who does a workflow's work: Anchored's agent, a tool the owner has, a new tool, or nobody yet. */
export type HandlerKind = "agent" | "owned" | "new" | "none";

/** Who handles one workflow, in the owner's words at three lengths. */
export interface WhoHandles {
  readonly kind: HandlerKind;
  /** The handler's name on the graph: "Anchored drafts it", "Your OpenTable", "Certus", "Not handled yet". */
  readonly name: string;
  /** The line under the name: "Customer agent, in your $29 plan", "New, $250 a month". */
  readonly note: string;
  /** A full sentence: "Certus answers the phone for you, $250 a month". */
  readonly line: string;
  /** A ledger's few words: "Certus, $250 a month", "Your OpenTable". */
  readonly short: string;
}

/** One kind of work from start to finish. */
export interface FlowRoute {
  readonly key: string;
  readonly trigger: string;
  /** What an agent drafts for the owner's OK, or `null` when nothing waits for the owner. */
  readonly draft: string | null;
  /** For a tool, who decides what it does; `null` otherwise. */
  readonly rule: string | null;
  /** What the owner gets, or `null` while nothing handles the work. */
  readonly result: string | null;
}

/** One workflow on the graph: who handles it, its routes, and the money the research puts on it. */
export interface WorkflowFlow {
  readonly id: WorkflowId;
  readonly name: string;
  readonly handler: WhoHandles;
  readonly routes: readonly FlowRoute[];
  /** What the research says rides on this work, or `null` when it gives no figure. */
  readonly stake: string | null;
}

/** Another handler the owner can pick for a workflow, told as what happens. */
export interface ChangeOption {
  readonly kind: HandlerKind;
  /** "Use your QuickBooks Online", "Sign up for Certus", "Let Anchored draft it for your OK", "Leave it for now". */
  readonly title: string;
  readonly detail: string;
  /** This option handles the workflow now. */
  readonly current: boolean;
  /** Anchored picked this option in the plan. */
  readonly ours: boolean;
  readonly request: SetChoiceRequest;
  /** The tool or agent the toast names once the owner picks this option, when there is one. */
  readonly runner: string | undefined;
}

/** The choices route's word for each handler kind, which the plan's recommendation also uses. */
const PATH_OF: Readonly<Record<HandlerKind, Choice["path"]>> = { agent: "build", owned: "turnon", new: "buy", none: "skip" };

// =============================================================================
// Who handles it
// =============================================================================

/** Say who handles workflow `id` at `business` under `choices`, the picks with Anchored's filled in. */
export function whoHandles(business: BusinessProfile, choices: Readonly<Record<WorkflowId, Choice>>, id: WorkflowId): WhoHandles {
  const choice = choices[id] ?? { path: "skip" };
  if (choice.path === "build") {
    const build = pathOptions(business, id).build;
    const agent = build === null ? "Anchored" : `${displayAgentName(build.agentName)} agent`;
    return {
      kind: "agent",
      name: "Anchored drafts it",
      note: `${agent}, in your ${money(AGENT_PLAN_MONTHLY)} plan`,
      line: "Anchored drafts it, you approve it",
      short: "Anchored drafts, you approve",
    };
  }
  const tool = choice.path === "skip" ? undefined : toolById(choice.toolId);
  if (tool === undefined) return NOT_HANDLED;
  const does = lowerFirst(TOOL_STEPS[id].does);
  if (choice.path === "turnon") {
    const yours = `Your ${platformOf(tool)}`;
    return { kind: "owned", name: yours, note: "Already yours, no new bill", line: `${yours} ${does}`, short: yours };
  }
  const name = toolName(tool);
  const price = priceText(tool, business);
  return { kind: "new", name, note: `New, ${price}`, line: `${name} ${does}, ${price}`, short: `${name}, ${price}` };
}

const NOT_HANDLED: WhoHandles = {
  kind: "none",
  name: "Not handled yet",
  note: "You do this yourself for now",
  line: "Not handled yet",
  short: "Not handled yet",
};

// =============================================================================
// The flow
// =============================================================================

/** Follow workflow `id` at `business` under `choices` from what starts it to what the owner gets. */
export function workflowFlow(business: BusinessProfile, choices: Readonly<Record<WorkflowId, Choice>>, id: WorkflowId): WorkflowFlow {
  const handler = whoHandles(business, choices, id);
  const stake = business.workflows[id]?.stake ?? "";
  return { id, name: WORKFLOWS[id].name, handler, routes: routesOf(business, choices[id], id, handler), stake: stake === "" ? null : stake };
}

function routesOf(business: BusinessProfile, choice: Choice | undefined, id: WorkflowId, handler: WhoHandles): FlowRoute[] {
  const steps = TOOL_STEPS[id];
  if (choice?.path === "build") {
    return choice.skills.map((skill) => {
      const job = SKILL_STEPS[skill];
      const trigger = TRADE_TRIGGERS[business.tradeKey]?.[skill] ?? job.trigger;
      return { key: skill, trigger, draft: job.draft, rule: null, result: job.result };
    });
  }
  const tool = choice === undefined || choice.path === "skip" ? undefined : toolById(choice.toolId);
  if (handler.kind === "none" || tool === undefined) return [{ key: id, trigger: steps.trigger, draft: null, rule: null, result: null }];
  return [{ key: id, trigger: steps.trigger, draft: null, rule: whoDecides(tool), result: steps.result }];
}

// =============================================================================
// Changing who handles it
// =============================================================================

/** The handlers the owner can pick for workflow `id`, as outcomes, in the order: theirs, new, Anchored, leave it. */
export function changeOptions(business: BusinessProfile, choices: Readonly<Record<WorkflowId, Choice>>, id: WorkflowId): ChangeOption[] {
  const choice = choices[id] ?? { path: "skip" };
  const plan = business.workflows[id];
  const options = pathOptions(business, id);
  const steps = TOOL_STEPS[id];
  const option = (kind: HandlerKind, rest: Omit<ChangeOption, "kind" | "current" | "ours">): ChangeOption => ({
    kind,
    current: choice.path === PATH_OF[kind],
    ours: plan?.rec === PATH_OF[kind],
    ...rest,
  });

  const list: ChangeOption[] = [];
  const owned = ownedTool(choice, plan?.tool, options.owned);
  if (owned !== undefined) {
    list.push(
      option("owned", {
        title: `Use your ${platformOf(owned)}`,
        detail: `${steps.does}. Already yours, no new bill.`,
        request: { workflow: id, path: "turnon", toolId: owned.id },
        runner: toolName(owned),
      }),
    );
  }
  const fresh = newTool(choice, plan?.tool, options);
  if (fresh !== undefined) {
    const fit = rateTool(fresh, business).total;
    list.push(
      option("new", {
        title: `Sign up for ${toolName(fresh)}`,
        detail: `${steps.does}. ${capitalize(priceText(fresh, business))}, fits you ${fit} of 100. Price checked ${fresh.checkedOn}.`,
        request: { workflow: id, path: "buy", toolId: fresh.id },
        runner: toolName(fresh),
      }),
    );
  }
  if (options.build !== null) {
    list.push(
      option("agent", {
        title: "Let Anchored draft it for your OK",
        detail: `${options.build.skills.map((skill) => SKILLS[skill].job).join(". ")}. In your ${money(AGENT_PLAN_MONTHLY)} plan.`,
        request: { workflow: id, path: "build" },
        runner: `${displayAgentName(options.build.agentName)} agent`,
      }),
    );
  }
  list.push(option("none", { title: "Leave it for now", detail: "You keep doing this yourself.", request: { workflow: id, path: "skip" }, runner: undefined }));
  return list;
}

/** The owned tool the owner uses now, else Anchored's pick if they own it, else the first they own. */
function ownedTool(choice: Choice, planned: string | undefined, owned: readonly Tool[]): Tool | undefined {
  const chosen = choice.path === "turnon" ? owned.find((t) => t.id === choice.toolId) : undefined;
  return chosen ?? owned.find((t) => t.id === planned) ?? owned[0];
}

/** The new tool the owner picked, else Anchored's pick, else the best-rated one. `pathOptions` already leaves out tools they own. */
function newTool(choice: Choice, planned: string | undefined, options: PathOptions): Tool | undefined {
  if (choice.path === "buy") return toolById(choice.toolId);
  const pick = options.buy.find((entry) => entry.tool.id === planned)?.tool;
  return pick ?? options.buy[0]?.tool;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** What the owner calls software they have: its platform, else its maker. */
function platformOf(tool: Tool): string {
  return tool.platform ?? tool.maker;
}

/** Say what a tool costs this business a month: "$250 a month", "free plan" or "priced on quote". */
function priceText(tool: Tool, business: BusinessProfile): string {
  const amount = monthlyCost(tool, business);
  if (amount === null) return "priced on quote";
  return amount === 0 ? "free plan" : `${money(amount)} a month`;
}

/** Say who decides what a tool does, from its researched "in charge" check. */
function whoDecides(tool: Tool): string {
  const [status, , note] = tool.checks.charge;
  // An unknown check's note reads "Not stated", which means nothing beside a diagram step.
  return status === "unknown" ? "Ask the vendor who approves its work" : note;
}

/** Lower-case the first letter, so "Sends booking reminders" reads inside a sentence. */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
