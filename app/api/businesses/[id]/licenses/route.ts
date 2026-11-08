import { saveLicensesSchema } from "@/lib/api/schemas";
import { runBusinessAgentWork } from "@/lib/server/agent-work";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Structured owner-recorded license facts live in the existing profile and
// profile history. Sources and completion state are saved with each date.
// This route creates owner reminders, never renewals or external messages.

type Params = { params: Promise<{ id: string }> };

/** Read the current owner's evidenced license dates. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    return json({ licenses: business.details?.licenses ?? [] });
  } catch (error) { return handleError(error, "GET /api/businesses/[id]/licenses"); }
}

/** Save evidenced dates and completion state, then refresh owner reminders. */
export async function PUT(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, saveLicensesSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    const session = await getSessionId();
    const store = getStore();
    const saved = await store.saveBusiness(session, { ...business, details: { ...business.details, licenses: body.data.licenses } });
    await runBusinessAgentWork(store, session, saved);
    return json({ licenses: saved.details?.licenses ?? [] });
  } catch (error) { return handleError(error, "PUT /api/businesses/[id]/licenses"); }
}
