import { randomUUID } from "node:crypto";
import type { StartIntakeResponse } from "@/lib/api/contract";
import { newDraft, openingMessages } from "@/lib/domain/intake";
import { handleError, json } from "@/lib/server/http";
import { intakeState, intakeThread } from "@/lib/server/intake-ai";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";
import type { IntakeRecord } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/intake starts an onboarding chat for this session: an empty draft,
// Anchored's greeting and its first question. Answers go to `/api/intake/[id]`.

/** Start an onboarding chat. */
export async function POST() {
  try {
    const session = await getSessionId();
    const store = getStore();
    const intake: IntakeRecord = { id: `i_${randomUUID()}`, draft: newDraft(), businessId: null };
    await store.saveIntake(session, intake);
    const messages = await store.addMessages(
      session,
      intakeThread(intake.id),
      openingMessages(intake.draft).map((text) => ({ role: "anchored", text })),
    );
    return json<StartIntakeResponse>({ intakeId: intake.id, ...intakeState(intake, messages) }, 201);
  } catch (error) {
    return handleError(error, "POST /api/intake");
  }
}
