import "server-only";
import { approvePlan } from "@/lib/domain/plan";
import type { PlanApproval } from "@/lib/domain/types";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Saves the owner's yes to a plan as a whole, for `PUT /api/businesses/[id]/plan`:
// the time and each workflow's pick as the owner sees it now, so the Workflows
// page can tell when a step changes afterwards.

/** Approve the plan of one of the session's businesses, or return `null` when the session has no such business. */
export async function approveBusinessPlan(session: string, id: string, now: Date): Promise<PlanApproval | null> {
  const store = getStore();
  const business = await store.getBusiness(session, id);
  if (!business) return null;
  const planApproval = approvePlan(business, await store.getChoices(session, id), now);
  await store.saveBusiness(session, { ...business, planApproval }, "owner");
  return planApproval;
}
