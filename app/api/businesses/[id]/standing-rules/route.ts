import { setStandingRuleSchema } from "@/lib/api/schemas";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { readStandingRules, RuleLockedError, setAcknowledgment } from "@/lib/server/standing-rules";

// =============================================================================
// Module Overview
// =============================================================================
// /api/businesses/[id]/standing-rules: GET reads the acknowledgment rule and
// the exact text it sends; PUT `{ enabled }` turns it on or off and answers
// with the state as saved. Each owner changes only their own business.

type Params = { params: Promise<{ id: string }> };

/** Return the acknowledgment rule's saved state. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null) return fail(404, "Business not found. It may have been reset.");
    return json(await readStandingRules(await getSessionId(), business));
  } catch (error) {
    return handleError(error, "GET /api/businesses/[id]/standing-rules");
  }
}

/** Turn the acknowledgment rule on or off. */
export async function PUT(request: Request, { params }: Params) {
  const parsed = await readBody(request, setStandingRuleSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const business = await findBusiness((await params).id);
    if (business === null) return fail(404, "Business not found. It may have been reset.");
    return json(await setAcknowledgment(await getSessionId(), business, parsed.data.enabled));
  } catch (error) {
    if (error instanceof RuleLockedError) return fail(409, error.message);
    return handleError(error, "PUT /api/businesses/[id]/standing-rules");
  }
}
