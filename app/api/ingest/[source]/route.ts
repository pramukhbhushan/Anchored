import type { EventCardResponse } from "@/lib/api/contract";
import { ingestSchema } from "@/lib/api/schemas";
import { findBusiness, getFeed } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { ingestEvent } from "@/lib/server/ingest";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/ingest/[source] turns an event the visitor sends into a card for the
// skill that handles it, through `ingestEvent`. It trusts the visitor's session,
// so it serves the simulator and tests. Real events from Twilio, Stripe and
// forwarded email arrive at the signed webhooks under `app/api/hooks/`.

/** Record an event and draft a card from the skill that handles its source. */
export async function POST(request: Request, { params }: { params: Promise<{ source: string }> }) {
  const parsed = await readBody(request, ingestSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { source } = await params;
    const business = await findBusiness(parsed.data.businessId);
    if (!business) return fail(404, "Business not found. It may have been reset.");
    const result = await ingestEvent(await getSessionId(), business, source, parsed.data.payload, "simulated");
    if (!result.ok) return fail(result.status, result.error);
    const feed = await getFeed(business);
    return json<EventCardResponse>({ ...feed, added: feed.cards.find((card) => card.key === result.key) ?? null }, 201);
  } catch (error) {
    return handleError(error, "POST /api/ingest/[source]");
  }
}
