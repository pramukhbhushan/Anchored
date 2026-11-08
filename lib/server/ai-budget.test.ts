import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LlmProvider } from "@/lib/llm";
import { AiBudgetError, dailyCallCap, DEFAULT_DAILY_CALL_CAP, withDailyBudget } from "./ai-budget";

vi.mock("server-only", () => ({}));

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the daily AI call cap: calls go through while `spend` allows
// them, stop before reaching the provider once it refuses, and the cap reads
// from `AI_DAILY_CALL_CAP`.

function fakeProvider(): LlmProvider & { calls: number } {
  const provider = {
    name: "anthropic" as const,
    label: "Claude",
    calls: 0,
    modelFor: () => "test-model",
    async generateText() {
      provider.calls++;
      return "drafted";
    },
    async generateObject<T>(request: { schema: z.ZodType<T> }) {
      provider.calls++;
      return request.schema.parse({ ok: true });
    },
  };
  return provider;
}

describe("withDailyBudget", () => {
  it("passes calls through while the budget allows them", async () => {
    const provider = fakeProvider();
    const budgeted = withDailyBudget(provider, async () => true);

    expect(await budgeted.generateText({ tier: "quick", prompt: "hi", maxTokens: 10 })).toBe("drafted");
    expect(await budgeted.generateObject({ tier: "quick", prompt: "hi", maxTokens: 10, schema: z.object({ ok: z.boolean() }), schemaName: "t" })).toEqual({ ok: true });
    expect(provider.calls).toBe(2);
  });

  it("throws AiBudgetError without calling the provider once the budget is spent", async () => {
    const provider = fakeProvider();
    const budgeted = withDailyBudget(provider, async () => false);

    await expect(budgeted.generateText({ tier: "quick", prompt: "hi", maxTokens: 10 })).rejects.toBeInstanceOf(AiBudgetError);
    expect(provider.calls).toBe(0);
  });

  it("counts a web search against the budget, and offers no search when the provider has none", async () => {
    const searching = { ...fakeProvider(), searchWeb: async () => ({ text: "found", sources: [] }) };
    const search = { tier: "default" as const, prompt: "find tools", maxTokens: 10, maxSearches: 1 };

    await expect(withDailyBudget(searching, async () => false).searchWeb?.(search)).rejects.toBeInstanceOf(AiBudgetError);
    expect(await withDailyBudget(searching, async () => true).searchWeb?.(search)).toEqual({ text: "found", sources: [] });
    expect(withDailyBudget(fakeProvider(), async () => true).searchWeb).toBeUndefined();
  });
});

describe("dailyCallCap", () => {
  it("uses the default when the variable is unset or blank", () => {
    expect(dailyCallCap({})).toBe(DEFAULT_DAILY_CALL_CAP);
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: " " })).toBe(DEFAULT_DAILY_CALL_CAP);
  });

  it("reads a whole number, including 0 to turn AI calls off", () => {
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "500" })).toBe(500);
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "0" })).toBe(0);
  });

  it("falls back to the default on a value that is not a whole number", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "lots" })).toBe(DEFAULT_DAILY_CALL_CAP);
    expect(dailyCallCap({ AI_DAILY_CALL_CAP: "-5" })).toBe(DEFAULT_DAILY_CALL_CAP);
    error.mockRestore();
  });
});
