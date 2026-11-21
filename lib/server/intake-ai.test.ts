import { describe, expect, it } from "vitest";
import { newDraft, nextQuestion, summarize } from "@/lib/domain/intake";
import { takeIntakeTurn } from "./intake-ai";

// =============================================================================
// Module Overview
// =============================================================================
// One onboarding turn. The rules read every answer, since no business and so no
// owner AI key exists yet, and the turn moves on to the next question.

describe("takeIntakeTurn", () => {
  it("reads the first answer with the rules and asks the next question", () => {
    const draft = newDraft();
    const first = nextQuestion(draft);

    const turn = takeIntakeTurn(draft, first!, { text: "Rivera Plumbing in Hyattsville" });

    expect(turn.reply).not.toBeNull();
    expect(nextQuestion(turn.draft)?.field).not.toBe(first!.field);
    expect(summarize(turn.draft).some((fact) => fact.value?.includes("Rivera Plumbing"))).toBe(true);
  });
});
