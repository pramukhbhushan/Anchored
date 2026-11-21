import { stakeActedOn } from "@/lib/domain/brief";
import { workflowIdsOf } from "@/lib/domain/paths";
import type { CardStatus } from "@/lib/api/contract";
import type { BusinessProfile, Channel, Rating, WorkflowId, WorkflowPlan } from "@/lib/domain/types";
import { NOT_GIVEN } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Small pure helpers the views share: `topWorkflows` picks the workflows worth
// acting on, `feedStats` counts the approvals feed, `fitLine` explains a tool score,
// `placeOf` reads the town, and `money` formats dollars.

/** One of a business's workflows with Anchored's plan for it. */
interface PlannedWorkflow {
  readonly id: WorkflowId;
  readonly plan: WorkflowPlan;
}

/** What the views read from each card in a feed. */
interface FeedCard {
  readonly example?: true;
  readonly title: string;
  readonly status: CardStatus;
  readonly channel: Channel;
  readonly edited: boolean;
  readonly stake?: number;
}

/** Counts behind the morning brief and the Stack page's approval step. */
interface FeedStats {
  readonly pending: number;
  /** Drafts the owner approved; "I'll handle it" on a locked card is not an approval. */
  readonly approved: number;
  /** Approved drafts the owner edited first. */
  readonly edited: number;
  /** Share of approved cards the owner edited first, 0 to 100. */
  readonly editRate: number;
  /** Dollars on the cards the owner approved, from their own events only; the example's are researched. */
  readonly actedOn: number;
}

/** Return the business's workflows with their plans, in the catalog's workflow order. */
function plannedWorkflows(business: BusinessProfile): PlannedWorkflow[] {
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

/** Count the feed: waiting, approved, edited, the edit rate and the dollars on approved cards. */
export function feedStats(cards: readonly FeedCard[]): FeedStats {
  // A locked card is decided by "I'll handle it", which takes the work back rather than approving a draft.
  // A flag card asked the owner for a fact, so it has no draft to approve either.
  const approved = cards.filter((c) => c.status === "approved" && c.channel !== "locked" && c.channel !== "flag");
  const edited = approved.filter((c) => c.edited).length;
  return {
    pending: cards.filter((c) => c.status === "pending").length,
    approved: approved.length,
    edited,
    editRate: approved.length > 0 ? Math.round((edited / approved.length) * 100) : 0,
    actedOn: stakeActedOn(cards),
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
