import { pathOptions, workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Choice, PathOptions, WorkflowId, WorkflowPlan } from "@/lib/domain/types";
import { WORKFLOW_IDS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Jobs a business could hand off beyond the ones onboarding found. Onboarding
// picks a business's jobs from the owner's answers; `newJobs` lists the rest
// that a catalog tool or an Anchored agent can take on, for the tools page.
// `withJob` adds one to the profile marked as the owner's, so a later rebuild
// from the owner's facts keeps it.

/** A job the business doesn't have yet, with every way it could be handled. */
export interface NewJob extends PathOptions {
  readonly workflow: WorkflowId;
}

/** Return the jobs `business` doesn't have yet that a tool or an agent can do, tools the owner has first and agent-only jobs last. */
export function newJobs(business: BusinessProfile): NewJob[] {
  const mine = workflowIdsOf(business);
  return WORKFLOW_IDS.filter((id) => !mine.includes(id))
    .map((workflow) => ({ workflow, ...pathOptions(business, workflow) }))
    .filter((job) => job.owned.length > 0 || job.buy.length > 0 || job.build !== null)
    .sort((a, z) => rank(z) - rank(a));
}

/** Order a job by its best way in: software the owner pays for, then the best-rated tool, then an agent alone. */
function rank(job: NewJob): number {
  if (job.owned.length > 0) return 101;
  return job.buy[0]?.rating.total ?? -1;
}

/** Return `business` with `workflow` added as a job the owner chose, handled the way `choice` says. */
export function withJob(business: BusinessProfile, workflow: WorkflowId, choice: Choice): BusinessProfile {
  const plan: WorkflowPlan = {
    fit: 2,
    rec: choice.path,
    why: "You added this job from the tools page.",
    stake: "",
    isNew: true,
    addedBy: "owner",
    ...("toolId" in choice ? { tool: choice.toolId } : {}),
  };
  return { ...business, workflows: { ...business.workflows, [workflow]: plan } };
}
