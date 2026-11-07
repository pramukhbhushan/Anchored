import { decideCardSchema } from "@/lib/api/schemas";
import { decideCard } from "@/lib/server/decide";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/cards/[id] records the owner's decision on a card: approve, approve
// an edited body, or skip. Sending runs through the executor's rules first.

/** Approve or skip a card. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, decideCardSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const session = await getSessionId();
    const store = getStore();
    const card = await store.getCard(session, (await params).id);
    if (!card) return fail(404, "Card not found. It may have been reset.");
    const result = await decideCard(store, session, card, parsed.data);
    return result.ok ? json(result.response) : fail(result.status, result.error);
  } catch (error) {
    return handleError(error, "POST /api/cards/[id]");
  }
}
