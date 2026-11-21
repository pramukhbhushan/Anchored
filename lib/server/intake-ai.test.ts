import { beforeEach, describe, expect, it, vi } from "vitest";
import { newDraft, nextQuestion } from "@/lib/domain/intake";
import type { LlmProvider } from "@/lib/llm";

// =============================================================================
// Module Overview
// =============================================================================
// One onboarding turn with a model set up. The model may ask a short follow-up,
// but only where the owner answers in their own words: a follow-up on a question
// with chips would put the model's question above chips that answer another.

const models = vi.hoisted(() => ({ current: null as LlmProvider | null }));
vi.mock("@/lib/server/ai-budget", () => ({ getBudgetedLlm: () => models.current }));

const { takeIntakeTurn } = await import("./intake-ai");

/** A model that reads every answer as naming the business and asking `followUp` next. */
function modelAsking(followUp: { field: string; question: string }): LlmProvider {
  return {
    generateObject: async () => ({ name: "Rivera Plumbing", place: "Hyattsville", kind: "Plumbing", reach: [], tools: [], signals: [], languages: [], ack: "Thanks.", followUp }),
  } as unknown as LlmProvider;
}

beforeEach(() => {
  models.current = null;
});

describe("takeIntakeTurn with a model", () => {
  const draft = newDraft();
  const first = nextQuestion(draft);

  it("asks the model's follow-up where the owner answers in their own words", async () => {
    models.current = modelAsking({ field: "what", question: "What jobs do you take most?" });

    const turn = await takeIntakeTurn("session-1", draft, first!, { text: "Rivera Plumbing in Hyattsville" }, []);

    expect(nextQuestion(turn.draft)?.text).toBe("What jobs do you take most?");
  });

  it("never puts the model's question above chips that answer something else", async () => {
    models.current = modelAsking({ field: "kind", question: "Do you do commercial work too?" });

    const turn = await takeIntakeTurn("session-1", draft, first!, { text: "Rivera Plumbing in Hyattsville" }, []);

    expect(nextQuestion(turn.draft)?.text).not.toBe("Do you do commercial work too?");
  });
});
