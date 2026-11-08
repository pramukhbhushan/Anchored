import { CORE_AGENTS, SKILLS } from "@/lib/domain/agents";
import { fieldsFor } from "@/lib/domain/fields";
import { activeAgents } from "@/lib/domain/paths";
import type { BusinessProfile, ChoiceMap, CoreAgentId, ModelTier, OwnerExample, ProfileDetails, SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Assembles the runtime configuration for each active core agent from one
// confirmed business profile. Each agent receives only its registry fields,
// its own skills and matching owner examples. The model stays a provider-neutral
// tier so deployments choose their own provider and exact model id.

/** The runtime inputs assembled for one core agent. */
export interface AgentConfig {
  readonly agent: CoreAgentId;
  readonly skillVersion: string;
  readonly skills: readonly SkillId[];
  readonly profile: ProfileDetails;
  readonly limits: { readonly approval: "every-card"; readonly askInsteadOfGuessing: true };
  readonly examples: readonly OwnerExample[];
  readonly model: ModelTier;
  readonly inputSource: readonly string[];
  readonly outputChannel: "approval-card";
}

const SKILL_VERSION = "2026-11-08";
const TIER_ORDER: Readonly<Record<ModelTier, number>> = { quick: 0, default: 1, complex: 2 };

/** The strongest model tier among an agent's active skills. */
function tierFor(skills: readonly SkillId[]): ModelTier {
  return skills.reduce<ModelTier>((tier, skill) => (TIER_ORDER[SKILLS[skill].tier] > TIER_ORDER[tier] ? SKILLS[skill].tier : tier), "quick");
}

/** Examples useful to one agent, capped so prompts stay small. */
function examplesFor(agent: CoreAgentId, examples: readonly OwnerExample[] | undefined): OwnerExample[] {
  const kinds: Readonly<Record<CoreAgentId, readonly OwnerExample["kind"][]>> = {
    frontdesk: ["message"],
    followup: ["quote", "message"],
    books: ["message"],
    content: ["post"],
    internal: ["message"],
  };
  return (examples ?? []).filter((example) => kinds[agent].includes(example.kind)).slice(0, 3);
}

/** Return only the registered profile fields `agent` may read. */
export function agentProfileSlice(business: Pick<BusinessProfile, "details">, agent: CoreAgentId): ProfileDetails {
  const keys = [...fieldsFor(agent, "must", business), ...fieldsFor(agent, "nice", business)];
  return Object.fromEntries(keys.flatMap((key) => business.details?.[key] === undefined ? [] : [[key, business.details[key]]])) as ProfileDetails;
}

/** Build one provider-neutral runtime config per active core agent. */
export function assembleAgentConfigs(business: BusinessProfile, choices: ChoiceMap): AgentConfig[] {
  return activeAgents(business, choices).flatMap((active): AgentConfig[] => {
    if (active.id.startsWith("niche:")) return [];
    const agent = active.id as CoreAgentId;
    const skills = active.skills.length > 0 ? active.skills : CORE_AGENTS[agent].skills.filter((skill) => skill === "brief" || skill === "triage");
    return [{
      agent,
      skillVersion: SKILL_VERSION,
      skills,
      profile: agentProfileSlice(business, agent),
      limits: { approval: "every-card", askInsteadOfGuessing: true },
      examples: examplesFor(agent, business.details?.examples),
      model: tierFor(skills),
      inputSource: [...new Set(skills.flatMap((skill) => SKILLS[skill].reads))],
      outputChannel: "approval-card",
    }];
  });
}
