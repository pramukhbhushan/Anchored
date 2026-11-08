import { resolveChoices, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, ChoiceMap, PlanApproval, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's yes to the plan as a whole. Anchored picks who handles each
// workflow; `approvePlan` records the picks the owner said yes to, and
// `planStatus` compares today's picks with them: still waiting, live, or
// changed since, naming each workflow whose step is different.

/** Where the plan stands with the owner. */
export type PlanStatus =
  | { readonly kind: "draft" }
  | { readonly kind: "live"; readonly approvedAt: string }
  | { readonly kind: "changed"; readonly approvedAt: string; readonly changed: readonly WorkflowId[] };

/** Record the owner's yes to the plan they see now: each workflow's saved pick, or Anchored's pick. */
export function approvePlan(business: BusinessProfile, saved: ChoiceMap, now: Date): PlanApproval {
  return { approvedAt: now.toISOString(), choices: resolveChoices(business, saved) };
}

/** Compare today's picks with the ones the owner approved. */
export function planStatus(business: BusinessProfile, saved: ChoiceMap): PlanStatus {
  const approval = business.planApproval;
  if (approval === undefined) return { kind: "draft" };
  const current = resolveChoices(business, saved);
  // A workflow added after the approval has no approved pick, so it counts as a change too.
  const changed = workflowIdsOf(business).filter((id) => !sameChoice(approval.choices[id], current[id]));
  return changed.length === 0
    ? { kind: "live", approvedAt: approval.approvedAt }
    : { kind: "changed", approvedAt: approval.approvedAt, changed };
}

/** Whether two picks hand the work to the same tool, or the same skills, or both leave it. */
function sameChoice(approved: Choice | undefined, now: Choice): boolean {
  if (approved === undefined || approved.path !== now.path) return false;
  if (approved.path === "build" && now.path === "build") return approved.skills.join() === now.skills.join();
  if (approved.path === "skip") return true;
  return "toolId" in approved && "toolId" in now && approved.toolId === now.toolId;
}
