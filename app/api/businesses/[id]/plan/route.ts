import type { ApprovePlanResponse } from "@/lib/api/contract";
import { approvePlanSchema } from "@/lib/api/schemas";
import { isSampleBusinessId } from "@/lib/domain/cases";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { approveBusinessPlan } from "@/lib/server/plan";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// PUT /api/businesses/[id]/plan saves the owner's yes to the plan as a whole:
// the time and each workflow's pick as the owner sees it now, so the Workflows
// page can tell when a step changes afterwards. The example business lives in
// code and keeps the approval its owner gave it.

/** Approve the plan of one of the session's businesses. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, approvePlanSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { id } = await params;
    if (isSampleBusinessId(id)) {
      return fail(409, "This example's plan is already approved. Set up your own business to approve a plan of your own.");
    }
    const planApproval = await approveBusinessPlan(await getSessionId(), id, new Date());
    if (!planApproval) return fail(404, "Business not found. It may have been reset.");
    return json<ApprovePlanResponse>({ planApproval });
  } catch (error) {
    return handleError(error, "PUT /api/businesses/[id]/plan");
  }
}
