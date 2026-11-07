import type { BusinessChatResponse } from "@/lib/api/contract";
import { businessChatSchema } from "@/lib/api/schemas";
import { listBusinessChat, sendBusinessChat } from "@/lib/server/business-chat";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// GET /api/businesses/[id]/chat returns a business's chat. POST tells Anchored
// what changed; the reply says what it updated in the profile and workflows.
// Case studies answer but stay read-only.

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "Business not found. It may have been reset.";

/** Return the business's chat. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const business = await findBusiness(id);
    if (!business) return fail(404, NOT_FOUND);
    return json<BusinessChatResponse>(await listBusinessChat(await getSessionId(), business));
  } catch (error) {
    return handleError(error, "GET /api/businesses/[id]/chat");
  }
}

/** Tell Anchored what changed at the business. */
export async function POST(request: Request, { params }: Context) {
  const parsed = await readBody(request, businessChatSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { id } = await params;
    const business = await findBusiness(id);
    if (!business) return fail(404, NOT_FOUND);
    return json<BusinessChatResponse>(await sendBusinessChat(await getSessionId(), business, parsed.data.text));
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/chat");
  }
}
