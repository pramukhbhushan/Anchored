import type { IntakeResponse } from "@/lib/api/contract";
import { intakeAnswerSchema } from "@/lib/api/schemas";
import { answerText, draftToAnswers, nextQuestion, planReadyText } from "@/lib/domain/intake";
import { buildProfileFromAnswers } from "@/lib/server/create-business";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { intakeState, intakeThread, takeIntakeTurn } from "@/lib/server/intake-ai";
import { getSessionId } from "@/lib/server/session";
import { scheduleStarters } from "@/lib/server/starters";
import { getStore } from "@/lib/store";
import type { IntakeRecord, NewChatMessage } from "@/lib/store/types";

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
const THREAD_LIMIT = 200;

/** Return an onboarding chat's messages, facts and current question. */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!INTAKE_ID.test(id)) return fail(404, NOT_FOUND);
  try {
    const session = await getSessionId();
    const store = getStore();
    const intake = await store.getIntake(session, id);
    if (!intake) return fail(404, NOT_FOUND);
    return json<IntakeResponse>(intakeState(intake, await store.listMessages(session, intakeThread(id), THREAD_LIMIT)));
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
    const session = await getSessionId();
    const store = getStore();
    const intake = await store.getIntake(session, id);
    if (!intake) return fail(404, NOT_FOUND);
    const thread = intakeThread(id);
    const transcript = await store.listMessages(session, thread, THREAD_LIMIT);
    // A finished intake answers with its final state, so a repeated tap can't build a second business.
    if (intake.businessId !== null) return json<IntakeResponse>(intakeState(intake, transcript));

    // No question means the owner confirmed but the build didn't finish last time; build it now.
    const question = nextQuestion(intake.draft);
    const turn = question ? await takeIntakeTurn(intake.draft, question, parsed.data, transcript) : { draft: intake.draft, reply: null };
    let businessId: string | null = null;
    let reply = turn.reply;
    if (reply === null) {
      const business = await buildProfileFromAnswers(draftToAnswers(turn.draft));
      await store.saveBusiness(session, business, "onboarding");
      // The starters are written after this response, so the plan appears without waiting on the model.
      scheduleStarters(session, business);
      businessId = business.id;
      reply = planReadyText(business);
    }

    const saved: IntakeRecord = { id, draft: turn.draft, businessId };
    await store.saveIntake(session, saved);
    const fresh: NewChatMessage[] = [...(question ? [{ role: "owner" as const, text: answerText(question, parsed.data) }] : []), { role: "anchored", text: reply }];
    const added = await store.addMessages(session, thread, fresh);
    return json<IntakeResponse>(intakeState(saved, [...transcript, ...added]));
  } catch (error) {
    return handleError(error, "POST /api/intake/[id]");
  }
}
