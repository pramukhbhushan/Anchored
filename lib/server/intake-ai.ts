import "server-only";
import type { ChatMessage, IntakeResponse } from "@/lib/api/contract";
import {
  applyReading,
  clip,
  composeReply,
  nextQuestion,
  readAnswer,
  summarize,
  type IntakeAnswer,
  type IntakeDraft,
  type IntakeQuestion,
} from "@/lib/domain/intake";
import type { ChatThread, IntakeRecord } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// The server side of one onboarding turn. `takeIntakeTurn` reads the answer with
// the rules: onboarding runs before the business exists, so there is no owner
// AI key to read it with. `quoted` and `shortPhrase` are the prompt helpers the
// business chat and customer replies share.

/** The result of one turn: the updated draft, and Anchored's reply, or `null` once the owner has confirmed. */
interface IntakeTurn {
  readonly draft: IntakeDraft;
  readonly reply: string | null;
}

/** The thread an intake's messages live in. */
export function intakeThread(id: string): ChatThread {
  return { kind: "intake", id };
}

/** The state every intake route returns. */
export function intakeState(intake: IntakeRecord, messages: readonly ChatMessage[]): IntakeResponse {
  const done = intake.businessId !== null;
  return {
    messages,
    known: summarize(intake.draft),
    question: done ? null : nextQuestion(intake.draft),
    done,
    ...(intake.businessId !== null ? { businessId: intake.businessId } : {}),
  };
}

// =============================================================================
// One turn
// =============================================================================

/** Apply one answer to the current question and write the reply. */
export function takeIntakeTurn(draft: IntakeDraft, question: IntakeQuestion, answer: IntakeAnswer): IntakeTurn {
  const step = question.field;
  const reading = readAnswer(answer.text ?? "", step);
  const after = applyReading(draft, step, answer.picks, reading);
  return { draft: after, reply: composeReply(draft, after, step, reading) };
}

// =============================================================================
// Prompt helpers
// =============================================================================

/** Owner text made safe to place inside a prompt tag: angle brackets go, so it can't close the tag it sits in. */
export function quoted(text: string, max: number): string {
  return clip(text.replace(/[<>]/g, " "), max);
}

/** Return a short phrase from the model, or `undefined` when it is blank or longer than `maxWords`. */
export function shortPhrase(value: string | null, maxWords: number, maxChars: number): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim() ?? "";
  if (trimmed === "" || trimmed.split(" ").length > maxWords) return undefined;
  return clip(trimmed, maxChars);
}
