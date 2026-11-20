import { CORE_AGENTS, SKILLS } from "@/lib/domain/agents";
import { defaultChoice, pathOptions } from "@/lib/domain/paths";
import type { BusinessProfile, CoreAgentId, CrewDecision, SignalId, WorkflowId } from "@/lib/domain/types";
import { SIGNALS, WORKFLOW_IDS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Builds the five plain-language crew decisions shown after onboarding. Code
// decides whether each agent starts on. The reason comes from the same workflow
// rules that built the plan, and the quote is an answer the owner actually gave.
// It also finds the first workflow an owner can use to turn an off agent on.

/** The first owner-provided line that explains why an agent is useful here. */
function triggerQuote(business: BusinessProfile, agent: CoreAgentId): string {
  const signal = (id: SignalId | undefined) => id === undefined ? undefined : SIGNALS.find((item) => item.id === id)?.label;
  const candidates: Readonly<Record<CoreAgentId, readonly (string | undefined)[]>> = {
    frontdesk: [business.reach[0], business.tasks.find((task) => /call|reply|book|customer/i.test(task)), business.trade],
    followup: [business.tasks.find((task) => /quote|follow|chase|deposit|customer/i.test(task)), signal(business.signals[0]), business.trade],
    books: [business.tasks.find((task) => /invoice|payment|deposit|book/i.test(task)), business.tools.find((tool) => /quickbooks|stripe|square/i.test(tool)), business.trade],
    content: [business.tasks.find((task) => /post|market|social|promot/i.test(task)), business.reach.find((way) => /google|instagram|facebook/i.test(way)), business.trade],
    internal: [business.tasks.find((task) => /staff|inbox|brief|license|shift/i.test(task)), business.size, business.trade],
  };
  return candidates[agent].find((value) => value !== undefined && value.trim() !== "") ?? business.name;
}

/** Workflows whose build path is run by `agent`, in the business's display order. */
function workflowsFor(business: BusinessProfile, agent: CoreAgentId): WorkflowId[] {
  return WORKFLOW_IDS.filter((workflow) => {
    if (business.workflows[workflow] === undefined) return false;
    const build = pathOptions(business, workflow).build;
    return build !== null && build.skills.some((skill) => SKILLS[skill].agent === agent);
  });
}

/** Build one on or off decision for every core agent from the current rules-built plan. */
export function crewDecisions(business: BusinessProfile): CrewDecision[] {
  return Object.values(CORE_AGENTS).map((agent) => {
    const workflows = workflowsFor(business, agent.id);
    const built = workflows.find((workflow) => defaultChoice(business, workflow).path === "build");
    const active = agent.alwaysOn || built !== undefined;
    const reasonWorkflow = built ?? workflows[0];
    const plan = reasonWorkflow === undefined ? undefined : business.workflows[reasonWorkflow];
    const reason = agent.alwaysOn
      ? "Keeps your daily brief and owner-only work in one place."
      : plan?.why ?? `Nothing in your answers calls for ${agent.name} yet.`;
    return { agent: agent.id, on: active, reason, quote: triggerQuote(business, agent.id) };
  });
}

/** Return `business` with fresh crew decisions while preserving every other profile fact. */
export function withCrewDecisions(business: BusinessProfile): BusinessProfile {
  return { ...business, crew: crewDecisions(business) };
}

/** The first workflow that can turn `agent` on. */
export function turnOnChoice(business: BusinessProfile, agent: CoreAgentId): { readonly workflow: WorkflowId } | null {
  const [workflow] = workflowsFor(business, agent);
  return workflow === undefined ? null : { workflow };
}
