import "server-only";
import { getLlm, type LlmProvider, type ObjectRequest, type TextRequest, type WebSearchRequest } from "@/lib/llm";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Two daily caps on model calls, so one visitor can't spend a whole public
// deployment's budget and the deployment can't run up the provider bill.
// `getBudgetedLlm` wraps the configured provider with `withDailyBudget`, which
// counts each call first against the session's own cap
// (`Store.useSessionAiCall`), then against the cap shared by every visitor
// (`Store.useAiCall`), and throws `AiBudgetError` once either is spent.

/** Calls allowed per UTC day across every visitor when `AI_DAILY_CALL_CAP` is unset. */
export const DEFAULT_DAILY_CALL_CAP = 2000;

/** Calls allowed per UTC day for one session when `AI_SESSION_DAILY_CALL_CAP` is unset. */
export const DEFAULT_SESSION_DAILY_CALL_CAP = 150;

/** Which cap a refused call ran into: the session's own, or the one every visitor shares. */
export type BudgetScope = "session" | "deployment";

const BUDGET_MESSAGES: Readonly<Record<BudgetScope, string>> = {
  session: "You've used today's AI drafts. Drafts stay as written until tomorrow.",
  deployment: "Anchored has used today's AI calls. Drafts stay as written until tomorrow.",
};

/** Raised instead of calling the model once today's cap for the session or the deployment is spent. */
export class AiBudgetError extends Error {
  override readonly name = "AiBudgetError";
  constructor(readonly scope: BudgetScope) {
    super(BUDGET_MESSAGES[scope]);
  }
}

type Env = Readonly<Record<string, string | undefined>>;

function readCap(env: Env, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const cap = Number(raw);
  if (Number.isInteger(cap) && cap >= 0) return cap;
  console.error(`[AI budget] \`${name}\` must be a whole number of 0 or more, not "${raw}"; using ${fallback}.`);
  return fallback;
}

/** Read the daily cap from `AI_DAILY_CALL_CAP`, falling back to the default when it is unset or invalid. */
export function dailyCallCap(env: Env = process.env): number {
  return readCap(env, "AI_DAILY_CALL_CAP", DEFAULT_DAILY_CALL_CAP);
}

/** Read the per-session daily cap from `AI_SESSION_DAILY_CALL_CAP`, falling back to the default when it is unset or invalid. */
export function sessionDailyCallCap(env: Env = process.env): number {
  return readCap(env, "AI_SESSION_DAILY_CALL_CAP", DEFAULT_SESSION_DAILY_CALL_CAP);
}

/** Return `llm` with every call counted by `spend` first; a scope from `spend` throws `AiBudgetError` and skips the call. */
export function withDailyBudget(llm: LlmProvider, spend: () => Promise<BudgetScope | null>): LlmProvider {
  async function charge(): Promise<void> {
    const spent = await spend();
    if (spent !== null) throw new AiBudgetError(spent);
  }
  const search = llm.searchWeb?.bind(llm);
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
    // Only a provider with a search tool gets the method, so callers can still tell it apart.
    ...(search
      ? {
          searchWeb: async (request: WebSearchRequest) => {
            await charge();
            return search(request);
          },
        }
      : {}),
  };
}

/** Count one call for `session`, then for the deployment, and return the cap it ran into, or `null` when it fits both. */
export async function spendDailyBudget(session: string, day: string, env: Env = process.env): Promise<BudgetScope | null> {
  const store = getStore();
  // The session's cap goes first, so one visitor past their own cap never eats into everyone's.
  if (!(await store.useSessionAiCall(session, day, sessionDailyCallCap(env)))) return "session";
  if (!(await store.useAiCall(day, dailyCallCap(env)))) return "deployment";
  return null;
}

/**
 * Return the configured provider under today's caps for `session` and for the deployment, or `null` when AI is off.
 * Pass the session the work belongs to: a route's from `getSessionId`, a webhook's or scheduler's from its store lookup.
 */
export function getBudgetedLlm(session: string): LlmProvider | null {
  const llm = getLlm();
  if (!llm) return null;
  // The day is UTC so every server instance counts against the same rows.
  return withDailyBudget(llm, () => spendDailyBudget(session, new Date().toISOString().slice(0, 10)));
}
