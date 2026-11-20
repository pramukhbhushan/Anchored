import "server-only";
import { randomUUID } from "node:crypto";
import type { IntakeResponse, StartIntakeResponse } from "@/lib/api/contract";
import { withCrewDecisions } from "@/lib/domain/crew";
import { answerText, draftDetails, draftToAnswers, newDraft, nextQuestion, openingMessages, planReadyText, type IntakeAnswer } from "@/lib/domain/intake";
import { buildProfileFromAnswers } from "@/lib/server/create-business";
import { intakeState, intakeThread, takeIntakeTurn } from "@/lib/server/intake-ai";
import { connectInvoiceSheet } from "@/lib/server/invoice-sheet";
import { scheduleStarters } from "@/lib/server/starters";
import { getStore } from "@/lib/store";
import type { IntakeRecord, NewChatMessage } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// The onboarding chat's store flows, behind `/api/intake` and
// `/api/intake/[id]`. `startIntake` saves an empty draft with Anchored's
// greeting, `readIntake` returns a chat so a reload can pick it up, and
// `answerIntake` takes one answer and, once the owner confirms the profile,
// builds and saves the business the same way `POST /api/businesses` does.

const THREAD_LIMIT = 200;

/** Start an onboarding chat: an empty draft, Anchored's greeting and its first question. */
export async function startIntake(session: string): Promise<StartIntakeResponse> {
  const store = getStore();
  const intake: IntakeRecord = { id: `i_${randomUUID()}`, draft: newDraft(), businessId: null };
  await store.saveIntake(session, intake);
  const messages = await store.addMessages(
    session,
    intakeThread(intake.id),
    openingMessages(intake.draft).map((text) => ({ role: "anchored", text })),
  );
  return { intakeId: intake.id, ...intakeState(intake, messages) };
}

/** Return an onboarding chat's messages, facts and current question, or `null` when the session has no such chat. */
export async function readIntake(session: string, id: string): Promise<IntakeResponse | null> {
  const store = getStore();
  const intake = await store.getIntake(session, id);
  if (!intake) return null;
  return intakeState(intake, await store.listMessages(session, intakeThread(id), THREAD_LIMIT));
}

/** Answer the current question and build the business once the owner confirms, or `null` when the session has no such chat. */
export async function answerIntake(session: string, id: string, answer: IntakeAnswer): Promise<IntakeResponse | null> {
  const store = getStore();
  const intake = await store.getIntake(session, id);
  if (!intake) return null;
  const thread = intakeThread(id);
  const transcript = await store.listMessages(session, thread, THREAD_LIMIT);
  // A finished intake answers with its final state, so a repeated tap can't build a second business.
  if (intake.businessId !== null) return intakeState(intake, transcript);

  // No question means the owner confirmed but the build didn't finish last time; build it now.
  const question = nextQuestion(intake.draft);
  const turn = question ? await takeIntakeTurn(intake.draft, question, answer, transcript) : { draft: intake.draft, reply: null };
  let businessId: string | null = null;
  let reply = turn.reply;
  if (reply === null) {
    // The owner confirmed the details at the review, so they arrive as theirs.
    const business = withCrewDecisions({ ...(await buildProfileFromAnswers(draftToAnswers(turn.draft))), ...draftDetails(turn.draft) });
    await store.saveBusiness(session, business, "onboarding");
    await store.recordEvent(session, business.id, "onboarding_raw", {
      intakeId: id,
      messages: transcript.map(({ role, text, at }) => ({ role, text, at })),
      draft: turn.draft,
    });
    // The starters are written after this response, so the plan appears without waiting on the model.
    scheduleStarters(session, business);
    businessId = business.id;
    reply = planReadyText(business);
    // An invoice sheet pasted during onboarding is read now, so its reminders wait in Approvals with the plan.
    const sheetId = turn.draft.invoiceSheet?.id;
    if (sheetId) reply = `${reply}\n\n${await connectInvoiceSheet(session, business, sheetId)}`;
  }

  const saved: IntakeRecord = { id, draft: turn.draft, businessId };
  await store.saveIntake(session, saved);
  const fresh: NewChatMessage[] = [...(question ? [{ role: "owner" as const, text: answerText(question, answer) }] : []), { role: "anchored", text: reply }];
  const added = await store.addMessages(session, thread, fresh);
  return intakeState(saved, [...transcript, ...added]);
}
