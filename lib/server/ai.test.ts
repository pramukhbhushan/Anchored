import { describe, expect, it, vi } from "vitest";
import { profileFromFacts } from "@/lib/domain/engine";
import type { LlmProvider } from "@/lib/llm";

// =============================================================================
// Module Overview
// =============================================================================
// "Rewrite in my voice" with the model mocked at the `LlmProvider` boundary:
// the model's words come back in plain punctuation, and the prompt carries the
// owner's own sample rather than a summary of it. The fact check also refuses
// prices, numbers, links, emails or phone numbers absent from the source.

const models = vi.hoisted(() => ({ current: null as LlmProvider | null, prompts: [] as string[] }));
vi.mock("@/lib/server/ai-budget", () => ({ getBudgetedLlm: () => models.current }));

const { newFacts, rewriteInVoice } = await import("./ai");

const business = {
  ...profileFromFacts({ id: "b_bw", name: "Brightwater Plumbing", trade: "Plumber", tradeKey: "home", place: "Silver Spring, MD", customers: "Homeowners", reach: ["Phone calls"], tools: [], signals: [], tasks: [], voice: "Friendly and direct." }),
  details: { examples: [{ kind: "message" as const, text: "Hey Mrs. Patel, Mike from Brightwater here." }] },
};

describe("rewriteInVoice", () => {
  it("returns straight quotes and no long dashes, and reads the owner's own sample", async () => {
    models.current = {
      generateText: async ({ prompt }: { prompt: string }) => {
        models.prompts.push(prompt);
        return "Hey Ana — Mike here. “No rush,” we’ll sort it out.";
      },
    } as unknown as LlmProvider;

    const text = await rewriteInVoice(business, "Hi Ana, sorry we missed you. We will sort it out.");

    expect(text).toBe(`Hey Ana, Mike here. "No rush," we'll sort it out.`);
    expect(models.prompts[0]).toContain("Hey Mrs. Patel, Mike from Brightwater here.");
  });
});

describe("newFacts", () => {
  it("finds an amount, number or link the original doesn't hold", () => {
    expect(newFacts("A tune-up is $89.", "A tune-up is $149.")).toEqual(["$149", "149"]);
    expect(newFacts("Call us.", "Call us at (301) 555-0192 or visit https://example.com")).toContain("https://example.com");
  });

  it("reads punctuation after an amount as the end of the sentence, not part of the amount", () => {
    expect(newFacts("Prices: tune-up $89", "Yes, a tune-up is $89, and that's all.")).toEqual([]);
    expect(newFacts("Prices: tune-up $89. Hours 8 to 5", "It's $89. We're open 8 to 5.")).toEqual([]);
  });
});
