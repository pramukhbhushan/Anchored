import { deleteTelegramSchema } from "@/lib/api/schemas";
import { findBusiness } from "@/lib/server/data";
import { deleteDispatchedTelegram } from "@/lib/server/dispatch";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Owner-authorized removal of a stored Telegram message. Request input never
// supplies chat or provider identity, and deletion preserves the outbox audit.

/** Remove a Telegram message owned by this session and business. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; entry: string }> }) {
  try {
    const body = await readBody(request, deleteTelegramSchema);
    if (!body.ok) return body.response;
    const { id, entry } = await params;
    const business = await findBusiness(id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    const result = await deleteDispatchedTelegram(getStore(), await getSessionId(), business.id, entry);
    return result.deleted ? json({ deleted: true, message: result.message }) : fail(result.status, result.message);
  } catch (error) {
    return handleError(error, "POST /api/businesses/[id]/outbox/[entry]/delete");
  }
}
