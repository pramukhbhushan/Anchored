import type { SetAutomationResponse } from "@/lib/api/contract";
import { setAutomationSchema } from "@/lib/api/schemas";
import { workflowIdsOf } from "@/lib/domain/paths";
import { NothingToTurnOnError, setAutomation } from "@/lib/server/automations";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// PUT /api/businesses/[id]/automations turns one job on or off from the
// Automations page. Code picks who does the job; turning on a job Anchored
// drafts also asks its first question in the business chat.

/** Turn one job on or off. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, setAutomationSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { id } = await params;
    const business = await findBusiness(id);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    if (business.kind === "case") return fail(409, "This is an example, so its automations can't change. Set up your business to turn yours on.");
    if (!workflowIdsOf(business).includes(parsed.data.workflow)) return fail(400, "That job isn't part of this business's plan.");
    return json<SetAutomationResponse>(await setAutomation(await getSessionId(), business, parsed.data.workflow, parsed.data.on));
  } catch (error) {
    if (error instanceof NothingToTurnOnError) return fail(409, error.message);
    return handleError(error, "PUT /api/businesses/[id]/automations");
  }
}
