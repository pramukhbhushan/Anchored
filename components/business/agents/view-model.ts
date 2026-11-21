import { displayAgentName } from "@/components/agent-labels";
import { SKILLS } from "@/lib/domain/agents";
import type { CardRecord } from "@/lib/api/contract";
import type { ActiveAgent, SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// What the agent pages show for each agent. Front Desk and Follow-up show as one
// Customer agent, while stored cards and the domain keep their own agent ids.
// Only agents active in the plan appear, and cards pass through unchanged.

/** The id in an agent page's URL: one of the four page agents or a niche agent. */
export type AgentViewId = "customer" | "books" | "content" | "internal" | `niche:${string}`;

/** What an agent page shows about one agent. */
export interface AgentView {
  readonly id: AgentViewId;
  readonly name: string;
  readonly job: string;
  readonly skills: readonly SkillId[];
  readonly niche: boolean;
  readonly approval: ActiveAgent["approval"];
  readonly never: readonly string[];
}

/** Return the page id for a stored agent id, folding Front Desk and Follow-up into Customer, or `null` for an unknown one. */
export function normalizeAgentId(id: string | null): AgentViewId | null {
  if (id === "frontdesk" || id === "followup" || id === "customer") return "customer";
  if (id === "books" || id === "content" || id === "internal") return id;
  if (id?.startsWith("niche:") && id.slice(6).trim() !== "") return `niche:${id.slice(6)}`;
  return null;
}

/** Return one view per agent page, merging Front Desk and Follow-up into Customer. */
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

/** Return the cards for agent page `id`, one per card key, in the order given. */
export function cardsForAgent(cards: readonly CardRecord[], id: AgentViewId): CardRecord[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (normalizeAgentId(card.agent) !== id || seen.has(card.key)) return false;
    seen.add(card.key);
    return true;
  });
}
