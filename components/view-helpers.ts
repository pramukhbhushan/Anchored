import { workflowIdsOf } from "@/lib/domain/paths";
import type { BusinessProfile, Rating, WorkflowId, WorkflowPlan } from "@/lib/domain/types";
import { NOT_GIVEN } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Small pure helpers the views share: `plannedWorkflows` pairs each of a
// business's workflows with its plan, `topWorkflows` picks the ones worth acting
// on, `feedStats` counts the approvals feed, `fitLine` explains a tool score,
// `placeOf` reads the town, and `money` formats dollars.

/** One of a business's workflows with Anchored's plan for it. */
export interface PlannedWorkflow {
  readonly id: WorkflowId;
  readonly plan: WorkflowPlan;
}

/** What the views read from each card in a feed. */
export interface FeedCard {
  readonly status: "pending" | "approved" | "skipped";
  readonly edited: boolean;
  readonly stake?: number;
}

/** Counts behind the overview's KPI strip and the approvals summary. */
export interface FeedStats {
  readonly pending: number;
  readonly approved: number;
  /** Share of approved cards the owner edited first, 0 to 100. */
  readonly editRate: number;
  /** Dollars riding on the cards the owner approved. */
  readonly actedOn: number;
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
  // Array sort is stable, so equal fits keep the catalog order.
  return plannedWorkflows(business)
    .filter((w) => w.plan.rec !== "skip")
    .sort((a, z) => z.plan.fit - a.plan.fit)
    .slice(0, count);
}

/** Count the feed: waiting, approved, the edit rate and the dollars on approved cards. */
export function feedStats(cards: readonly FeedCard[]): FeedStats {
  const approved = cards.filter((c) => c.status === "approved");
  return {
    pending: cards.filter((c) => c.status === "pending").length,
    approved: approved.length,
    editRate: approved.length > 0 ? Math.round((approved.filter((c) => c.edited).length / approved.length) * 100) : 0,
    actedOn: approved.reduce((sum, c) => sum + (c.stake ?? 0), 0),
  };
}

/** Explain a tool score in one line, such as "3 of 7 checks verified, 4 not known yet." */
export function fitLine(rating: Rating, checkCount: number): string {
  const verified = checkCount - rating.unknown;
  return rating.unknown === 0
    ? `All ${checkCount} checks verified. Meets ${rating.met}.`
    : `${verified} of ${checkCount} checks verified, ${rating.unknown} not known yet.`;
}

/** Return the business's town, or `null` when onboarding didn't give one. */
export function placeOf(business: Pick<BusinessProfile, "place">): string | null {
  const place = business.place.trim();
  return place === "" || place === NOT_GIVEN ? null : place;
}

/** Format dollars as `$1,248` or `$29.5`, never more than two decimals. */
export function money(amount: number): string {
  return "$" + (Math.round(amount * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
