import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newDraft, nextQuestion } from "@/lib/domain/intake";
import type { LlmProvider } from "@/lib/llm";
import { json, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// One onboarding turn with a model set up. The model may ask a short follow-up,
// but only where the owner answers in their own words: a follow-up on a question
// with chips would put the model's question above chips that answer another.
// With a Places key, the name and town lead to an "Is this you?" step.

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

    const turn = await takeIntakeTurn(draft, first!, { text: "Rivera Plumbing in Hyattsville" }, []);

    expect(nextQuestion(turn.draft)?.text).toBe("What jobs do you take most?");
  });

  it("never puts the model's question above chips that answer something else", async () => {
    models.current = modelAsking({ field: "kind", question: "Do you do commercial work too?" });

    const turn = await takeIntakeTurn(draft, first!, { text: "Rivera Plumbing in Hyattsville" }, []);

    expect(nextQuestion(turn.draft)?.text).not.toBe("Do you do commercial work too?");
  });
});

describe("takeIntakeTurn with the Google lookup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks 'Is this you?' after the name, then reads the picked listing and its website", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const spy = stubFetch((url) => {
      if (url.includes("searchText")) return json({ places: [{ id: "place-a", displayName: { text: "Rivera Plumbing" }, formattedAddress: "5 Oak St, Hyattsville, MD" }] });
      if (url.includes("/places/place-a")) return json({ id: "place-a", regularOpeningHours: { weekdayDescriptions: ["Monday: 7:00 AM to 4:00 PM"] }, websiteUri: "https://rivera.example" });
      return new Response("<html><body><p>Emergency plumbing. Minimum charge $95.</p></body></html>", { status: 200, headers: { "content-type": "text/html" } });
    });

    const named = await takeIntakeTurn(newDraft(), nextQuestion(newDraft())!, { text: "Rivera Plumbing, Hyattsville, MD" }, []);
    const listing = nextQuestion(named.draft);
    expect(listing?.field).toBe("listing");
    expect(named.reply).toContain("Is this you?");

    const picked = await takeIntakeTurn(named.draft, listing!, { picks: ["place-a"] }, []);

    expect(picked.draft.placeId).toBe("place-a");
    expect(picked.draft.details?.hours).toBe("Monday: 7:00 AM to 4:00 PM");
    expect(picked.reply).toMatch(/^Got it, I'll use your Google listing\./);
    // With no model set up, nothing could read the website, so it isn't fetched.
    expect(spy.mock.calls.map(([url]) => String(url))).toEqual([
      "https://places.googleapis.com/v1/places:searchText",
      "https://places.googleapis.com/v1/places/place-a",
    ]);
  });
});
