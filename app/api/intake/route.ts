import type { StartIntakeResponse } from "@/lib/api/contract";
import { handleError, json } from "@/lib/server/http";
import { startIntake } from "@/lib/server/intake";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/intake starts an onboarding chat for this session: an empty draft,
// Anchored's greeting and its first question. Answers go to `/api/intake/[id]`.

/** Start an onboarding chat. */
export async function POST() {
  try {
    return json<StartIntakeResponse>(await startIntake(await getSessionId()), 201);
  } catch (error) {
    return handleError(error, "POST /api/intake");
  }
}
