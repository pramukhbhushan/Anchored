import type { SetChoiceResponse } from "@/lib/api/contract";
import { setChoiceSchema } from "@/lib/api/schemas";
import { workflowIdsOf } from "@/lib/domain/paths";
import { checkChoice, saveChoice } from "@/lib/server/choice";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// PUT /api/businesses/[id]/choices sets the path for one workflow. The route
// checks the choice against the workflow's real options, so a request cannot
// turn on a tool the business doesn't own or build an agent that doesn't exist.

/** Save the owner's path for one workflow. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, setChoiceSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { id } = await params;
    const business = await findBusiness(id);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    const body = parsed.data;
    if (!workflowIdsOf(business).includes(body.workflow)) return fail(400, "That workflow isn't part of this business's plan.");

    const checked = checkChoice(business, body);
    if (!checked.ok) return fail(checked.status, checked.error);

    await saveChoice(await getSessionId(), business.id, body.workflow, checked.choice);
    return json<SetChoiceResponse>({ choice: checked.choice });
  } catch (error) {
    return handleError(error, "PUT /api/businesses/[id]/choices");
  }
}
