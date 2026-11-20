import { cancelFollowupSchema, scheduleFollowupSchema } from "@/lib/api/schemas";
import { findBusiness } from "@/lib/server/data";
import { cancelFollowup, listFollowups, recordFollowup } from "@/lib/server/followups";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// Session-scoped owner records for Customer timers. A due timer creates a card
// for approval only. Cancellation keeps its facts and invalidates old drafts.
// Incoming requests never supply business or session ownership.

type Params = { params: Promise<{ id: string }> };

/** Read this business's recorded timers. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    return json({ records: await listFollowups(await getSessionId(), business) });
  } catch (error) { return handleError(error, "GET /api/businesses/[id]/followups"); }
}

/** Record explicit facts and a due time, then check whether an approval draft is due. */
export async function POST(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, scheduleFollowupSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    const result = await recordFollowup(await getSessionId(), business, body.data);
    return result.ok ? json({ records: result.records }) : fail(result.status, result.error);
  } catch (error) { return handleError(error, "POST /api/businesses/[id]/followups"); }
}

/** Cancel only an existing timer owned by this business. */
export async function PUT(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, cancelFollowupSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    const result = await cancelFollowup(await getSessionId(), business, body.data.id);
    return result.ok ? json({ records: result.records }) : fail(result.status, result.error);
  } catch (error) { return handleError(error, "PUT /api/businesses/[id]/followups"); }
}
