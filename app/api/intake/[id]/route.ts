import type { IntakeResponse } from "@/lib/api/contract";
import { intakeAnswerSchema } from "@/lib/api/schemas";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { answerIntake, readIntake } from "@/lib/server/intake";
import { getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// GET /api/intake/[id] returns an onboarding chat so a reload can pick it up.
// POST answers the current question; once the owner confirms the profile, it
// builds and saves the business the same way `POST /api/businesses` does.

type Context = { params: Promise<{ id: string }> };

// `POST /api/intake` mints ids as `i_` plus a UUID; anything else can't exist.
const INTAKE_ID = /^i_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOT_FOUND = "That onboarding chat wasn't found. Start a new one.";

/** Return an onboarding chat's messages, facts and current question. */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!INTAKE_ID.test(id)) return fail(404, NOT_FOUND);
  try {
    const state = await readIntake(await getSessionId(), id);
    if (!state) return fail(404, NOT_FOUND);
    return json<IntakeResponse>(state);
  } catch (error) {
    return handleError(error, "GET /api/intake/[id]");
  }
}

/** Answer the current question, and build the business once the owner confirms. */
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!INTAKE_ID.test(id)) return fail(404, NOT_FOUND);
  const parsed = await readBody(request, intakeAnswerSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const state = await answerIntake(await getSessionId(), id, parsed.data);
    if (!state) return fail(404, NOT_FOUND);
    return json<IntakeResponse>(state);
  } catch (error) {
    return handleError(error, "POST /api/intake/[id]");
  }
}
