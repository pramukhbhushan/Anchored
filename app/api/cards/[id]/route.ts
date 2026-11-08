import { decideCardSchema } from "@/lib/api/schemas";
import { isCardId, isCardLive, materializeCard } from "@/lib/server/data";
import { decideCard } from "@/lib/server/decide";
import { dispatchEntry } from "@/lib/server/dispatch";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/cards/[id] records the owner's decision on a card: approve, approve
// an edited body, or skip. A draft that was never stored is stored first.
// Sending runs through the executor's rules, and a message Anchored can send
// itself through a connected service goes out before the response returns.

/** Approve or skip a card. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, decideCardSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { id } = await params;
    if (!isCardId(id)) return fail(404, "Card not found. It may have been reset.");
    const card = await materializeCard(id);
    if (!card) return fail(404, "Card not found. It may have been reset.");
    // A stale tab can hold a card whose workflow the owner has since moved off Build; its agent isn't working.
    if (card.status === "pending" && !(await isCardLive(card))) return fail(409, "This workflow no longer uses that agent, so its card can't be sent. Reload to see your current cards.");
    const store = getStore();
    const session = await getSessionId();
    const now = new Date();
    const result = await decideCard(store, session, card, parsed.data, now);
    if (!result.ok) return fail(result.status, result.error);
    const queued = result.response.outbox;
    // A message due now goes out at once; one held for quiet hours waits for the scheduled sender.
    if (queued?.delivery !== "queued" || queued.sentAt > now.toISOString()) return json(result.response);
    await dispatchEntry(store, session, queued.id, now);
    const outbox = (await store.listOutbox(session, card.businessId)).find((entry) => entry.id === queued.id) ?? queued;
    return json({ ...result.response, outbox });
  } catch (error) {
    return handleError(error, "POST /api/cards/[id]");
  }
}
