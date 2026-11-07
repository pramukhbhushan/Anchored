import { workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Tool, WorkflowId, WorkflowPlan } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Small pure helpers the views share: `plannedWorkflows` pairs each of a
// business's workflows with its plan, `topWorkflows` picks the ones worth acting
// on, `monthlyCost` prices one tool for one business, and `money` formats dollars.

/** One of a business's workflows with Anchored's plan for it. */
export interface PlannedWorkflow {
  readonly id: WorkflowId;
  readonly plan: WorkflowPlan;
}

/** Return the business's workflows with their plans, in the catalog's workflow order. */
export function plannedWorkflows(business: BusinessProfile): PlannedWorkflow[] {
  return workflowIdsOf(business).flatMap((id) => {
    const plan = business.workflows[id];
    return plan === undefined ? [] : [{ id, plan }];
  });
}

/** Return up to `count` workflows Anchored doesn't recommend skipping, best fit first. */
export function topWorkflows(business: BusinessProfile, count: number): PlannedWorkflow[] {
  // Array sort is stable, so equal fits keep the catalog order, as in the prototype.
  return plannedWorkflows(business)
    .filter((w) => w.plan.rec !== "skip")
    .sort((a, z) => z.plan.fit - a.plan.fit)
    .slice(0, count);
}

/** Return what `tool` costs this business a month, or `null` when the vendor only quotes. */
export function monthlyCost(tool: Tool, business: BusinessProfile): number | null {
  if (tool.monthly === null) return null;
  return tool.perUser ? tool.monthly * (business.seats || 1) : tool.monthly;
}

/** Format dollars as the prototype did: `$1,248` or `$29.5`, never more than two decimals. */
export function money(amount: number): string {
  return "$" + (Math.round(amount * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
