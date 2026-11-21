import { SKILLS } from "@/lib/domain/agents";
import type { SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// How the views name agents and skills in prose: `skillList` for "Closer and
// Debrief skills", `displayAgentName` for an agent's current name,
// `cardSource` for "Customer agent", and `asSentence` for agent text written
// elsewhere that may lack a full stop.

/** Join names as English prose: "A", "A and B", "A, B and C". */
function joinAnd(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Name a set of skills, such as "Closer and Debrief skills" or "Callback skill". */
export function skillList(skills: readonly SkillId[]): string {
  const names = skills.map((s) => SKILLS[s].name);
  return `${joinAnd(names)} skill${names.length === 1 ? "" : "s"}`;
}

/** Return the name owners see now for an agent saved under an older name, such as "Customer" for "Front Desk". */
export function displayAgentName(name: string): string {
  if (name === "Front Desk" || name === "Follow-up") return "Customer";
  if (name === "Bookkeeping and Invoicing") return "Bookkeeping";
  if (name === "Content and Social") return "Marketing";
  return name;
}

/** Name who drafted a card for the owner, such as "Customer agent"; `null` means Anchored itself. Skills stay under the hood. */
export function cardSource(agentName: string | null): string {
  return agentName === null ? "Anchored" : `${displayAgentName(agentName)} agent`;
}

/** Return `text` trimmed and ending in sentence punctuation, so it can sit before another sentence. */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
