import type { AddJobResponse } from "@/lib/api/contract";
import { addJobSchema } from "@/lib/api/schemas";
import { isSampleBusinessId } from "@/lib/domain/cases";
import { withJob } from "@/lib/domain/new-jobs";
import { workflowIdsOf } from "@/lib/domain/paths";
import { checkChoice } from "@/lib/server/choice";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/businesses/[id]/workflows adds a job the business doesn't have
// yet, from the tools page, with who handles it. The choice gets the same
// checks as the choices route. The job is saved on the owner's profile, marked
// as theirs, and the choice beside it, so the Workflows page, the plan and the
// bill all pick it up. The example business lives in code, so its jobs stay
// as they are. A business has fifteen jobs at most and a job it already has
// is refused, so the few profile versions this writes share the general
// mutation limit in `middleware.ts`.

/** Add one job to one of the session's businesses, with the tool or agent that handles it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, addJobSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { id } = await params;
    if (isSampleBusinessId(id)) return fail(409, "This example's jobs are set. Set up your own business to add jobs to it.");
    const business = await findBusiness(id);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    const body = parsed.data;
    if (workflowIdsOf(business).includes(body.workflow)) {
      return fail(409, "That job is already in your workflows. Change who handles it on the Workflows page.");
    }

    const checked = checkChoice(business, body);
    if (!checked.ok) return fail(checked.status, checked.error);

    const session = await getSessionId();
    const store = getStore();
    // The choice goes first: a choice for a job the profile lacks is ignored, so if the profile save then fails, a
    // retry starts clean. In the other order, a choice left from when the business last had this job would win.
    await store.setChoice(session, business.id, body.workflow, checked.choice);
    await store.saveBusiness(session, withJob(business, body.workflow, checked.choice), "owner");
    return json<AddJobResponse>({ workflow: body.workflow, choice: checked.choice });
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/workflows");
  }
}
