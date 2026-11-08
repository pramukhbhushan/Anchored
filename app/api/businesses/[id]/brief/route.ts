import { readBrief, runBrief } from "@/lib/server/brief";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// /api/businesses/[id]/brief: GET reads the last finished daily brief; POST
// writes a new one now, the owner's Run now. Neither sends anything to anyone.

type Params = { params: Promise<{ id: string }> };

/** Return the last finished brief. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null) return fail(404, "Business not found. It may have been reset.");
    return json(await readBrief(await getSessionId(), business));
  } catch (error) {
    return handleError(error, "GET /api/businesses/[id]/brief");
  }
}

/** Write a brief now and return it, or the last one when a brief is already being written. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null) return fail(404, "Business not found. It may have been reset.");
    return json(await runBrief(await getSessionId(), business));
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/brief");
  }
}
