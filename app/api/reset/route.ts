import { handleError, json } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/reset clears everything the visitor's session created, so a judge
// can run the demo again from a clean start. Case studies live in code and stay.

/** Delete this session's businesses, choices, cards, outbox and events. */
export async function POST() {
  try {
    await getStore().reset(await getSessionId());
    return json({ ok: true as const });
  } catch (error) {
    return handleError(error, "POST /api/reset");
  }
}
