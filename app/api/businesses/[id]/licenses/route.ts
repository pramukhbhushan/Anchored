import { saveLicensesSchema } from "@/lib/api/schemas";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { saveLicenses } from "@/lib/server/licenses";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// /api/businesses/[id]/licenses: GET reads the license dates the owner
// recorded, and PUT saves them on the business profile with each date's source
// and whether it is renewed. Saving refreshes the owner's own reminders; it
// never renews a license or messages anyone.

type Params = { params: Promise<{ id: string }> };

/** Return the business's recorded license dates. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found. It may have been deleted. Reload the page to see your businesses.");
    return json({ licenses: business.details?.licenses ?? [] });
  } catch (error) { return handleError(error, "GET /api/businesses/[id]/licenses"); }
}

/** Save the license dates, then refresh the owner's reminders. */
export async function PUT(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, saveLicensesSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found. It may have been deleted. Reload the page to see your businesses.");
    const saved = await saveLicenses(await getSessionId(), business, body.data.licenses);
    return json({ licenses: saved.details?.licenses ?? [] });
  } catch (error) { return handleError(error, "PUT /api/businesses/[id]/licenses"); }
}
