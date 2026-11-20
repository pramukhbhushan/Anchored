import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { telegramSetup } from "@/lib/server/telegram-setup";

// =============================================================================
// Module Overview
// =============================================================================
// GET /api/businesses/[id]/telegram reads the business's Telegram test link,
// or the reason it has none. The first read makes the business's hook id.

type Params = { params: Promise<{ id: string }> };

/** Return the business's Telegram link, or why it has none. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const business = await findBusiness(id);
    if (business === null) return fail(404, "Business not found. It may have been deleted. Reload the page to see your businesses.");
    return json(await telegramSetup(await getSessionId(), business));
  } catch (error) {
    return handleError(error, "GET /api/businesses/[id]/telegram");
  }
}
