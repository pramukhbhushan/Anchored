import { CORE_AGENTS, SKILLS, STANDING_SKILLS, WORKFLOW_SKILLS } from "@/lib/domain/agents";
import { fitsTrade, toolById, TOOLS } from "@/lib/domain/catalog";
import { rateTool, usesSoftware, type RatingContext } from "@/lib/domain/rating";
import type {
  ActiveAgent,
  AgentRef,
  BusinessProfile,
  Choice,
  ChoiceMap,
  CoreAgentId,
  NicheAgent,
  PathOptions,
  SkillId,
  StackCost,
  Tool,
  WorkflowId,
} from "@/lib/domain/types";
import { WORKFLOW_IDS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The three paths for each workflow and the owner's picks among them.
// `pathOptions` lists tools the business already owns, catalog tools ranked by
// `rateTool`, and the build path's agent and skills; `defaultChoice` turns the
// plan's recommendation into a pick; `activeAgents` and `stackCost` read the picks.

/** What `pathOptions` reads from a business. The rules engine passes a draft plan before the profile exists. */
export interface PathContext extends RatingContext {
  readonly workflows: Readonly<Partial<Record<WorkflowId, { readonly skills?: readonly SkillId[] }>>>;
  readonly nicheAgents: readonly NicheAgent[];
}

/** A tool the owner picked to turn on or buy, and the workflow it covers. */
export interface ChosenTool {
  readonly workflow: WorkflowId;
  readonly path: "turnon" | "buy";
  readonly tool: Tool;
}

/** Anchored's monthly plan, charged once any build skill is chosen. */
const AGENT_PLAN_MONTHLY = 29;

const SKIP: Choice = { path: "skip" };

// =============================================================================
// Agents
// =============================================================================

/** The business's workflows, in display order. */
export function workflowIdsOf(business: Pick<BusinessProfile, "workflows">): WorkflowId[] {
  return WORKFLOW_IDS.filter((id) => business.workflows[id] !== undefined);
}

/** The agent that runs `skill` here: a niche agent whose skills include it wins, else the skill's core agent. */
export function agentForSkill(business: Pick<BusinessProfile, "nicheAgents">, skill: SkillId): AgentRef {
  const agent = runnerOf(business, skill);
  if (agent === null) {
    throw new RangeError(`No agent runs \`${skill}\` here. It needs a niche agent that onboarding spawns.`);
  }
  return agent;
}

/** Display name for a core or niche agent; an unknown niche id reads as "Anchored", as the prototype showed agentless cards. */
export function agentName(business: Pick<BusinessProfile, "nicheAgents">, ref: AgentRef): string {
  if (!isNicheRef(ref)) return CORE_AGENTS[ref].name;
  return business.nicheAgents.find((agent) => agent.id === ref)?.name ?? "Anchored";
}

/** Like `agentForSkill`, but `null` when nothing here runs the skill. */
function runnerOf(business: Pick<BusinessProfile, "nicheAgents">, skill: SkillId): AgentRef | null {
  const niche = business.nicheAgents.find((agent) => agent.skills.includes(skill));
  return niche?.id ?? SKILLS[skill].agent;
}

function isNicheRef(ref: AgentRef): ref is `niche:${string}` {
  return ref.startsWith("niche:");
}

// =============================================================================
// Paths for one workflow
// =============================================================================

/** The three paths for one workflow: owned tools, rated catalog tools, and the build path or `null`. */
export function pathOptions(business: PathContext, workflow: WorkflowId): PathOptions {
  const covering = TOOLS.filter((tool) => tool.workflows.includes(workflow));
  // An add-on costs extra even for owners of its platform, so it stays a "buy".
  const owned = covering.filter(
    (tool) => tool.platform !== undefined && !tool.addon && usesSoftware(business, tool.platform),
  );
  const buy = covering
    .filter((tool) => !owned.includes(tool) && fitsTrade(tool, business.tradeKey))
    .map((tool) => ({ tool, rating: rateTool(tool, business) }))
    .sort((a, b) => b.rating.total - a.rating.total);
  return { owned, buy, build: buildPath(business, workflow) };
}

/** The build path's skills that some agent here can run, led by the first one's agent. */
function buildPath(business: PathContext, workflow: WorkflowId): PathOptions["build"] {
  const planned = business.workflows[workflow]?.skills;
  // A plan names skills only when they differ from the workflow's defaults.
  const wanted = planned !== undefined && planned.length > 0 ? planned : WORKFLOW_SKILLS[workflow];
  const runnable = wanted.flatMap((skill) => {
    const agent = runnerOf(business, skill);
    return agent === null ? [] : [{ skill, agent }];
  });
  const [lead] = runnable;
  if (lead === undefined) return null;
  // `PathOptions.build` names one agent; when a workflow's skills span two agents, the first skill's agent leads.
  return { agent: lead.agent, agentName: agentName(business, lead.agent), skills: runnable.map(({ skill }) => skill) };
}

/** Turn the plan's recommendation into a pick the business can actually make. */
export function defaultChoice(business: BusinessProfile, workflow: WorkflowId): Choice {
  const plan = business.workflows[workflow];
  if (plan === undefined) return SKIP;
  const options = pathOptions(business, workflow);
  const [firstOwned] = options.owned;
  if (plan.rec === "turnon" && firstOwned !== undefined) {
    const preferred = options.owned.find((tool) => tool.id === plan.tool) ?? firstOwned;
    return { path: "turnon", toolId: preferred.id };
  }
  if (plan.rec === "build" && options.build !== null) return { path: "build", skills: options.build.skills };
  // A turn-on pick with nothing owned falls back to buying the planned or best-rated tool.
  if (plan.rec === "buy" || plan.rec === "turnon") {
    const toolId = plan.tool ?? options.buy[0]?.tool.id;
    if (toolId !== undefined) return { path: "buy", toolId };
  }
  return SKIP;
}

// =============================================================================
// The owner's picks
// =============================================================================

/** Each of the business's workflows with its saved pick, or the default pick when nothing is saved. */
export function resolveChoices(business: BusinessProfile, saved: ChoiceMap): Record<WorkflowId, Choice> {
  const resolved: Partial<Record<WorkflowId, Choice>> = {};
  for (const { workflow, choice } of picks(business, saved)) resolved[workflow] = choice;
  // The contract types this as a full record so callers index it by the business's own workflow ids without a
  // guard; ids outside `workflowIdsOf(business)` are absent.
  return resolved as Record<WorkflowId, Choice>;
}

/** Skills on every build path the owner picked, each listed once, in workflow order. */
export function chosenSkills(business: BusinessProfile, choices: ChoiceMap): SkillId[] {
  const skills = picks(business, choices).flatMap(({ choice }) => (choice.path === "build" ? choice.skills : []));
  // Two workflows can share a skill; it still runs once.
  return [...new Set(skills)];
}

/** Agents at work: core agents with a chosen skill, Internal Communications always, then niche agents with a chosen skill. */
export function activeAgents(business: BusinessProfile, choices: ChoiceMap): ActiveAgent[] {
  const chosen = chosenSkills(business, choices);
  const runsHere = (ref: AgentRef, skill: SkillId): boolean => chosen.includes(skill) && runnerOf(business, skill) === ref;
  const core = Object.values(CORE_AGENTS).flatMap((agent) => {
    const skills = agent.skills.filter(
      (skill) => (agent.alwaysOn && STANDING_SKILLS.includes(skill)) || runsHere(agent.id, skill),
    );
    return agent.alwaysOn || skills.length > 0 ? [activeCore(agent.id, skills)] : [];
  });
  const niche = business.nicheAgents.flatMap((agent) => {
    const skills = agent.skills.filter((skill) => runsHere(agent.id, skill));
    if (skills.length === 0) return [];
    const active: ActiveAgent = {
      id: agent.id,
      name: agent.name,
      job: agent.job,
      skills,
      niche: true,
      approval: agent.approval,
    };
    return [active];
  });
  return [...core, ...niche];
}

/** Tools the owner picked to turn on or buy. Picks naming a tool no longer in the catalog are dropped. */
export function chosenTools(business: BusinessProfile, choices: ChoiceMap): ChosenTool[] {
  return picks(business, choices).flatMap(({ workflow, choice }) => {
    if (choice.path !== "turnon" && choice.path !== "buy") return [];
    const tool = toolById(choice.toolId);
    return tool === undefined ? [] : [{ workflow, path: choice.path, tool }];
  });
}

/** Return what `tool` typically costs this business a month, or `null` when the vendor only quotes. */
export function monthlyCost(tool: Tool, business: Pick<BusinessProfile, "seats">): number | null {
  if (tool.monthly === null) return null;
  // A zero seat count still bills one user.
  return tool.perUser ? tool.monthly * (business.seats || 1) : tool.monthly;
}

/** Monthly cost of the picks: bought tools, plus Anchored's plan once any build skill is chosen. */
export function stackCost(business: BusinessProfile, choices: ChoiceMap): StackCost {
  const counted = new Set<string>();
  const onQuote: Tool[] = [];
  let tools = 0;
  for (const { path, tool } of chosenTools(business, choices)) {
    // One tool can cover several workflows; it is priced once, by the first workflow that picked it.
    if (counted.has(tool.id)) continue;
    counted.add(tool.id);
    if (path === "turnon") continue;
    const cost = monthlyCost(tool, business);
    if (cost === null) onQuote.push(tool);
    else tools += cost;
  }
  const plan = chosenSkills(business, choices).length > 0 ? AGENT_PLAN_MONTHLY : 0;
  return { tools, plan, total: tools + plan, onQuote };
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** The business's workflows paired with the saved pick, or the default pick when nothing is saved. */
function picks(business: BusinessProfile, choices: ChoiceMap): { workflow: WorkflowId; choice: Choice }[] {
  return workflowIdsOf(business).map((workflow) => ({
    workflow,
    choice: choices[workflow] ?? defaultChoice(business, workflow),
  }));
}

function activeCore(id: CoreAgentId, skills: readonly SkillId[]): ActiveAgent {
  const agent = CORE_AGENTS[id];
  return { id, name: agent.name, job: agent.job, skills, niche: false, approval: "every-card" };
}
