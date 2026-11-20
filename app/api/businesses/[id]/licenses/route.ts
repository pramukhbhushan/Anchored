import { saveLicensesSchema } from "@/lib/api/schemas";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { saveLicenses } from "@/lib/server/licenses";
import { getSessionId } from "@/lib/server/session";

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
    const saved = await saveLicenses(await getSessionId(), business, body.data.licenses);
    return json({ licenses: saved.details?.licenses ?? [] });
  } catch (error) { return handleError(error, "PUT /api/businesses/[id]/licenses"); }
}
