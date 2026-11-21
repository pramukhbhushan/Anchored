import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LlmProvider } from "@/lib/llm";
import { MemoryStore } from "@/lib/store/memory";
import { AiBudgetError, dailyCallCap, DEFAULT_DAILY_CALL_CAP, DEFAULT_SESSION_DAILY_CALL_CAP, sessionDailyCallCap, spendDailyBudget, withDailyBudget } from "./ai-budget";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ store: null as unknown as MemoryStore }));
vi.mock("@/lib/store", () => ({ getStore: () => state.store }));

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the daily AI call caps: calls go through while `spend` allows
// them, stop before reaching the provider once it refuses, one session past
// its own cap leaves the shared cap for everyone else, and the caps read from
// `AI_SESSION_DAILY_CALL_CAP` and `AI_DAILY_CALL_CAP`.

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
    const budgeted = withDailyBudget(provider, async () => null);

    expect(await budgeted.generateText({ tier: "quick", prompt: "hi", maxTokens: 10 })).toBe("drafted");
    expect(await budgeted.generateObject({ tier: "quick", prompt: "hi", maxTokens: 10, schema: z.object({ ok: z.boolean() }), schemaName: "t" })).toEqual({ ok: true });
    expect(provider.calls).toBe(2);
  });

  it("throws AiBudgetError without calling the provider once the budget is spent", async () => {
    const provider = fakeProvider();
    const budgeted = withDailyBudget(provider, async () => "deployment" as const);

    await expect(budgeted.generateText({ tier: "quick", prompt: "hi", maxTokens: 10 })).rejects.toBeInstanceOf(AiBudgetError);
    expect(provider.calls).toBe(0);
  });

  it("tells the owner in plain words when their own day's drafts are spent", async () => {
    const budgeted = withDailyBudget(fakeProvider(), async () => "session" as const);

    await expect(budgeted.generateText({ tier: "quick", prompt: "hi", maxTokens: 10 })).rejects.toMatchObject({
      scope: "session",
      message: "You've used today's AI drafts. Drafts stay as written until tomorrow.",
    });
  });

  it("counts a web search against the budget, and offers no search when the provider has none", async () => {
    const searching = { ...fakeProvider(), searchWeb: async () => ({ text: "found", sources: [] }) };
    const search = { tier: "default" as const, prompt: "find tools", maxTokens: 10, maxSearches: 1 };

    await expect(withDailyBudget(searching, async () => "deployment" as const).searchWeb?.(search)).rejects.toBeInstanceOf(AiBudgetError);
    expect(await withDailyBudget(searching, async () => null).searchWeb?.(search)).toEqual({ text: "found", sources: [] });
    expect(withDailyBudget(fakeProvider(), async () => null).searchWeb).toBeUndefined();
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

describe("spendDailyBudget", () => {
  const day = "2026-11-20";

  it("stops one session at its own cap while other sessions keep the shared budget", async () => {
    state.store = new MemoryStore();
    const env = { AI_SESSION_DAILY_CALL_CAP: "2", AI_DAILY_CALL_CAP: "10" };

    expect(await spendDailyBudget("visitor-a", day, env)).toBeNull();
    expect(await spendDailyBudget("visitor-a", day, env)).toBeNull();
    expect(await spendDailyBudget("visitor-a", day, env)).toBe("session");
    expect(await spendDailyBudget("visitor-b", day, env)).toBeNull();
    // A refused call never reached the shared count: 3 of 10 used, so 7 remain.
    for (let i = 0; i < 7; i++) await state.store.useAiCall(day, 10);
    expect(await state.store.useAiCall(day, 10)).toBe(false);
  });

  it("refuses with the deployment scope once every visitor together has spent the shared cap", async () => {
    state.store = new MemoryStore();
    const env = { AI_SESSION_DAILY_CALL_CAP: "5", AI_DAILY_CALL_CAP: "1" };

    expect(await spendDailyBudget("visitor-a", day, env)).toBeNull();
    expect(await spendDailyBudget("visitor-b", day, env)).toBe("deployment");
  });
});

describe("sessionDailyCallCap", () => {
  it("uses the default when the variable is unset, and reads a whole number otherwise", () => {
    expect(sessionDailyCallCap({})).toBe(DEFAULT_SESSION_DAILY_CALL_CAP);
    expect(sessionDailyCallCap({ AI_SESSION_DAILY_CALL_CAP: "40" })).toBe(40);
    expect(sessionDailyCallCap({ AI_SESSION_DAILY_CALL_CAP: "0" })).toBe(0);
  });

  it("falls back to the default on a value that is not a whole number", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(sessionDailyCallCap({ AI_SESSION_DAILY_CALL_CAP: "1.5" })).toBe(DEFAULT_SESSION_DAILY_CALL_CAP);
    error.mockRestore();
  });
});
