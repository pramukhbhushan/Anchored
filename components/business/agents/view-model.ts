import { displayAgentName } from "@/components/agent-labels";
import { SKILLS } from "@/lib/domain/agents";
import type { CardRecord } from "@/lib/api/contract";
import type { ActiveAgent, SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Presentation-only projections for the agent workspaces. Existing Front Desk
// and Follow-up records share the Customer label without changing persisted
// ownership or the domain's routing. Only agents already active in the supplied
// plan appear here, and each card keeps its original decision and send data.

/** An agent's canonical route and display identity, including an active niche agent. */
export type AgentViewId = "customer" | "books" | "content" | "internal" | `niche:${string}`;

/** The metadata an agent workspace can show from its active domain definition. */
export interface AgentView {
  readonly id: AgentViewId;
  readonly name: string;
  readonly job: string;
  readonly skills: readonly SkillId[];
  readonly niche: boolean;
  readonly approval: ActiveAgent["approval"];
  readonly never: readonly string[];
}

/** Normalize legacy Customer owners for display, without accepting an unknown agent. */
export function normalizeAgentId(id: string | null): AgentViewId | null {
  if (id === "frontdesk" || id === "followup" || id === "customer") return "customer";
  if (id === "books" || id === "content" || id === "internal") return id;
  if (id?.startsWith("niche:") && id.slice(6).trim() !== "") return `niche:${id.slice(6)}`;
  return null;
}

/** Group active legacy Customer agents and retain the plan's other active agents. */
export function presentAgents(agents: readonly ActiveAgent[]): AgentView[] {
  const grouped = new Map<AgentViewId, { source: ActiveAgent; skills: SkillId[]; jobs: string[] }>();
  for (const agent of agents) {
    const id = normalizeAgentId(agent.id);
    if (id === null) continue;
    const group = grouped.get(id);
    if (group === undefined) {
      grouped.set(id, { source: agent, skills: [...new Set(agent.skills)], jobs: [agent.job] });
    } else {
      group.skills = [...new Set([...group.skills, ...agent.skills])];
      if (!group.jobs.includes(agent.job)) group.jobs.push(agent.job);
    }
  }
  return [...grouped].map(([id, { source, skills, jobs }]) => ({
    id,
    name: id === "customer" ? "Customer" : displayAgentName(source.name),
    job: jobs.length === 1 ? jobs[0] ?? source.job : jobs.map((job) => job.replace(/[.!?]+$/, "")).join(". "),
    skills,
    niche: source.niche,
    approval: source.approval,
    never: [...new Set(skills.flatMap((skill) => SKILLS[skill].never))],
  }));
}

/** Return an agent's cards once per stable key, preserving their supplied order and state. */
export function cardsForAgent(cards: readonly CardRecord[], id: AgentViewId): CardRecord[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (normalizeAgentId(card.agent) !== id || seen.has(card.key)) return false;
    seen.add(card.key);
    return true;
  });
}
