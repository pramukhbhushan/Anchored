import { customerThreads } from "@/lib/server/customer-threads";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// GET /api/businesses/[id]/customers?contact=<id> reads the business's
// Telegram customers and one customer's thread, for the Customer agent's page.

type Params = { params: Promise<{ id: string }> };

/** Return the customers and the selected customer's thread. */
export async function GET(request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null) return fail(404, "Business not found. It may have been reset.");
    const contact = new URL(request.url).searchParams.get("contact");
    return json(await customerThreads(await getSessionId(), business, contact === null || contact === "" ? null : contact.slice(0, 64)));
  } catch (error) {
    return handleError(error, "GET /api/businesses/[id]/customers");
  }
}
