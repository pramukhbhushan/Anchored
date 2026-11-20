import { cancelFollowupSchema, scheduleFollowupSchema } from "@/lib/api/schemas";
import { findBusiness } from "@/lib/server/data";
import { cancelFollowup, listFollowups, recordFollowup } from "@/lib/server/followups";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// /api/businesses/[id]/followups: GET lists the Customer agent's follow-up
// timers, POST records one, and PUT cancels one. A timer that comes due drafts
// a card for the owner's OK and sends nothing. A cancelled timer keeps its
// record, and its old drafts stop counting. The business and session come from
// the URL and the cookie, never the body.

type Params = { params: Promise<{ id: string }> };

/** Read this business's recorded timers. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found. It may have been deleted. Reload the page to see your businesses.");
    return json({ records: await listFollowups(await getSessionId(), business) });
  } catch (error) { return handleError(error, "GET /api/businesses/[id]/followups"); }
}

/** Record a timer, then draft its card if it is already due. */
export async function POST(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, scheduleFollowupSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found. It may have been deleted. Reload the page to see your businesses.");
    const result = await recordFollowup(await getSessionId(), business, body.data);
    return result.ok ? json({ records: result.records }) : fail(result.status, result.error);
  } catch (error) { return handleError(error, "POST /api/businesses/[id]/followups"); }
}

/** Cancel one of this business's timers. */
export async function PUT(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, cancelFollowupSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found. It may have been deleted. Reload the page to see your businesses.");
    const result = await cancelFollowup(await getSessionId(), business, body.data.id);
    return result.ok ? json({ records: result.records }) : fail(result.status, result.error);
  } catch (error) { return handleError(error, "PUT /api/businesses/[id]/followups"); }
}
