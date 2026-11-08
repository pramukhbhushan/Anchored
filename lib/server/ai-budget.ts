import "server-only";
import { getLlm, type LlmProvider, type ObjectRequest, type TextRequest } from "@/lib/llm";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// A daily cap on model calls across every visitor and server instance, so a
// public deployment can't run up the provider bill. `getBudgetedLlm` wraps the
// configured provider with `withDailyBudget`, which counts each call through
// `Store.useAiCall` and throws `AiBudgetError` once the day's cap is spent.

/** Calls allowed per UTC day when `AI_DAILY_CALL_CAP` is unset. */
export const DEFAULT_DAILY_CALL_CAP = 2000;

/** Raised instead of calling the model once today's cap is spent. */
export class AiBudgetError extends Error {
  override readonly name = "AiBudgetError";
}

/** Read the daily cap from `AI_DAILY_CALL_CAP`, falling back to the default when it is unset or invalid. */
export function dailyCallCap(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.AI_DAILY_CALL_CAP?.trim();
  if (!raw) return DEFAULT_DAILY_CALL_CAP;
  const cap = Number(raw);
  if (Number.isInteger(cap) && cap >= 0) return cap;
  console.error(`[AI budget] \`AI_DAILY_CALL_CAP\` must be a whole number of 0 or more, not "${raw}"; using ${DEFAULT_DAILY_CALL_CAP}.`);
  return DEFAULT_DAILY_CALL_CAP;
}

/** Return `llm` with every call counted by `spend` first; a `false` from `spend` throws `AiBudgetError` and skips the call. */
export function withDailyBudget(llm: LlmProvider, spend: () => Promise<boolean>): LlmProvider {
  async function charge(): Promise<void> {
    if (!(await spend())) throw new AiBudgetError("Anchored has used today's AI calls. Drafts stay as written until tomorrow.");
  }
  return {
    name: llm.name,
    label: llm.label,
    modelFor: (tier) => llm.modelFor(tier),
    async generateText(request: TextRequest): Promise<string> {
      await charge();
      return llm.generateText(request);
    },
    async generateObject<T>(request: ObjectRequest<T>): Promise<T> {
      await charge();
      return llm.generateObject(request);
    },
  };
}

/** Return the configured provider under today's call cap, or `null` when AI is off. */
export function getBudgetedLlm(): LlmProvider | null {
  const llm = getLlm();
  if (!llm) return null;
  // The day is UTC so every server instance counts against the same row.
  return withDailyBudget(llm, () => getStore().useAiCall(new Date().toISOString().slice(0, 10), dailyCallCap()));
}
