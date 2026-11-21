import "server-only";
import type { AiSetup } from "@/lib/domain/agents";
import { AI_PROVIDER_COPY, isAiProvider } from "@/lib/domain/connections";
import {
  getLlm,
  LlmConfigError,
  LlmRefusalError,
  LlmRequestError,
  LlmResponseError,
  ownerLlm,
  type LlmProvider,
  type ObjectRequest,
  type OwnerAiSettings,
  type TextRequest,
  type WebSearchRequest,
} from "@/lib/llm";
import { getStore } from "@/lib/store";
import type { StoredConnection } from "@/lib/store/types";
import { decryptSecret } from "./secrets";

// =============================================================================
// Module Overview
// =============================================================================
// The one way to get a model. `getBudgetedLlm` picks whose key pays for a call:
// the business's own key from the Connections page when it has one, else the
// server's key from the environment, else `null`, and the rules write instead.
// Calls on the server's key count against two daily caps, first the session's
// own (`Store.useSessionAiCall`), then the one every visitor shares
// (`Store.useAiCall`), so one visitor can't spend a public deployment's budget
// and the deployment can't run up its bill. Calls on an owner's key spend the
// owner's money and skip both caps. An owner's provider error never carries the provider's own text, which
// can quote part of the key; the owner gets plain words instead, and a refused
// key raises `AiKeyError`.

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

type Env = Readonly<Record<string, string | undefined>>;

/** Raised instead of calling the model once today's cap for the session or the deployment is spent. */
export class AiBudgetError extends Error {
  override readonly name = "AiBudgetError";
  constructor(readonly scope: BudgetScope) {
    super(BUDGET_MESSAGES[scope]);
  }
}

/**
 * Raised when a call on an owner's key fails for any other reason, such as an unknown model or a provider that
 * didn't answer. The message is for the owner and holds none of the provider's text.
 */
export class OwnerKeyRequestError extends LlmRequestError {
  override name = "OwnerKeyRequestError";
}

/** Return the owner-facing words for a failed call on an owner's key, or `null` when the error isn't one. */
export function ownerKeyProblem(error: unknown): string | null {
  return error instanceof AiKeyError || error instanceof OwnerKeyRequestError ? error.message : null;
}

/** Raised when an owner's provider refuses their key, or their account has no credit. The message is for the owner. */
export class AiKeyError extends Error {
  override readonly name = "AiKeyError";
  constructor(
    message: string,
    readonly reason: "key" | "credit",
  ) {
    super(message);
  }
}

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

/** Return `llm` with every call passed through `guard`, keeping `searchWeb` only where `llm` has it. */
function wrap(llm: LlmProvider, guard: <T>(call: () => Promise<T>) => Promise<T>): LlmProvider {
  const search = llm.searchWeb?.bind(llm);
  return {
    name: llm.name,
    label: llm.label,
    modelFor: (tier) => llm.modelFor(tier),
    generateText: (request: TextRequest) => guard(() => llm.generateText(request)),
    generateObject: <T>(request: ObjectRequest<T>) => guard(() => llm.generateObject(request)),
    // Only a provider with a search tool gets the method, so callers can still tell it apart.
    ...(search ? { searchWeb: (request: WebSearchRequest) => guard(() => search(request)) } : {}),
  };
}

/** Return `llm` with every call counted by `spend` first; a scope from `spend` throws `AiBudgetError` and skips the call. */
export function withDailyBudget(llm: LlmProvider, spend: () => Promise<BudgetScope | null>): LlmProvider {
  return wrap(llm, async (call) => {
    const spent = await spend();
    if (spent !== null) throw new AiBudgetError(spent);
    return call();
  });
}

/** Count one call for `session`, then for the deployment, and return the cap it ran into, or `null` when it fits both. */
export async function spendDailyBudget(session: string, day: string, env: Env = process.env): Promise<BudgetScope | null> {
  const store = getStore();
  // The session's cap goes first, so one visitor past their own cap never eats into everyone's.
  if (!(await store.useSessionAiCall(session, day, sessionDailyCallCap(env)))) return "session";
  if (!(await store.useAiCall(day, dailyCallCap(env)))) return "deployment";
  return null;
}

/** Turn a failed call on an owner's key into an error that says, in the owner's words, what to do, with none of the provider's text. */
export function ownerKeyError(owner: Pick<OwnerAiSettings, "provider" | "model">, error: unknown): Error {
  // Refusals and unusable answers carry Anchored's own words, and mean the key worked.
  if (error instanceof LlmRefusalError || error instanceof LlmResponseError || error instanceof AiKeyError || error instanceof OwnerKeyRequestError) return error;
  const name = AI_PROVIDER_COPY[owner.provider].name;
  const request = error instanceof LlmRequestError ? error : null;
  const status = request?.status ?? null;
  // Only an owner who saved a model name can fix it; without one, Anchored picked the model.
  const modelHint = owner.model === null ? `Check your account and plan with ${name}.` : "Check the model name on Connections.";
  if (status === 401 || status === 403) return new AiKeyError(`${name} turned down your AI key. Check it on Connections.`, "key");
  if (status === 402 || request?.reason === "credit") return new AiKeyError(`${name} says your AI account is out of credit. Add credit with ${name}, then try again.`, "credit");
  if (status === 404) {
    const words = owner.model === null ? `${name} doesn't offer the model Anchored picked for your key. Add a model name on Connections.` : `${name} doesn't know the model name saved on Connections. Copy the exact name from ${name}.`;
    return new OwnerKeyRequestError(words, status);
  }
  if (status === 429) return new OwnerKeyRequestError(`${name} is limiting your AI key right now. Try again in a minute, or check your plan with ${name}.`, status);
  if (status !== null && status < 500) return new OwnerKeyRequestError(`${name} turned down the request. ${modelHint}`, status);
  return new OwnerKeyRequestError(`${name} didn't answer. Try again in a minute.`, status);
}

/** Return `llm`, built from an owner's key, with its errors rewritten by `ownerKeyError`. */
export function withOwnerErrors(llm: LlmProvider, owner: Pick<OwnerAiSettings, "provider" | "model">): LlmProvider {
  return wrap(llm, async (call) => {
    try {
      return await call();
    } catch (error) {
      throw ownerKeyError(owner, error);
    }
  });
}

/** Read the owner's AI key from a business's connections, or `null` when it has none or it can't be read. */
export function ownerKeyFrom(connections: readonly StoredConnection[]): OwnerAiSettings | null {
  const stored = connections.find((connection) => connection.kind === "ai");
  if (stored === undefined || stored.secret === null) return null;
  const provider = stored.settings.provider;
  if (!isAiProvider(provider)) return null;
  try {
    return { provider, apiKey: decryptSecret(stored.secret), model: stored.settings.model?.trim() || null };
  } catch {
    // The error could name the stored value, so the log says only what to check.
    console.error("[AI] A business's saved AI key can't be read, so it runs on the server's key or the rules. Check that CONNECTOR_SECRET_KEY hasn't changed.");
    return null;
  }
}

/** The server's provider from the environment under today's caps for `session` and the deployment, or `null` when it has none. */
function serverLlm(session: string): LlmProvider | null {
  const llm = getLlm();
  if (!llm) return null;
  // The day is UTC so every server instance counts against the same rows.
  return withDailyBudget(llm, () => spendDailyBudget(session, new Date().toISOString().slice(0, 10)));
}

/** Report whether this server has its own key in the environment, which businesses without a key fall back to. */
export function serverHasAi(): boolean {
  return getLlm() !== null;
}

/** Build the provider for an owner's key, or `null` when its settings are incomplete. */
function fromOwnerKey(owner: OwnerAiSettings): LlmProvider | null {
  try {
    return withOwnerErrors(ownerLlm(owner), owner);
  } catch (error) {
    if (error instanceof LlmConfigError) return null;
    throw error;
  }
}

/**
 * Return the provider for model calls `session` makes for `businessId`: the business's own key, else the
 * server's key under today's caps, else `null`, and the rules write instead. Leave out `businessId` before a
 * business exists, such as during onboarding, and only the server's key is used. Pass the session the work
 * belongs to: a route's from `getSessionId`, a webhook's or scheduler's from its store lookup.
 */
export async function getBudgetedLlm(session: string, businessId?: string): Promise<LlmProvider | null> {
  if (businessId === undefined) return serverLlm(session);
  return llmFromConnections(session, await getStore().listConnections(session, businessId));
}

/** `getBudgetedLlm` for a caller that already read the business's connections. */
export function llmFromConnections(session: string, connections: readonly StoredConnection[]): LlmProvider | null {
  const owner = ownerKeyFrom(connections);
  return (owner === null ? null : fromOwnerKey(owner)) ?? serverLlm(session);
}

/** Report whether model calls for the business, or before one exists, have a provider, the owner's or the server's. */
export async function isAiConfigured(session: string, businessId?: string): Promise<boolean> {
  return (await getBudgetedLlm(session, businessId)) !== null;
}

/** The name owners see for the provider that runs these model calls, such as "Claude", or `null` when AI is off. */
export async function aiLabel(session: string, businessId?: string): Promise<string | null> {
  return (await getBudgetedLlm(session, businessId))?.label ?? null;
}

/** The provider that runs these model calls and its model for each tier, or `null` when AI is off. */
export async function aiSetup(session: string, businessId?: string): Promise<AiSetup | null> {
  const llm = await getBudgetedLlm(session, businessId);
  if (llm === null) return null;
  return { label: llm.label, models: { quick: llm.modelFor("quick"), default: llm.modelFor("default"), complex: llm.modelFor("complex") } };
}

/** Check a key before it is saved with one short call: an owner-facing problem, or `null` when the key works. */
export async function checkOwnerKey(owner: OwnerAiSettings): Promise<string | null> {
  const name = AI_PROVIDER_COPY[owner.provider].name;
  const llm = fromOwnerKey(owner);
  if (llm === null) return `${name} needs a model name. Copy the exact name from ${name}.`;
  try {
    await llm.generateText({ tier: "quick", prompt: "Reply with the word OK.", maxTokens: 64 });
    return null;
  } catch (error) {
    // A refusal or an odd answer still means the provider took the key.
    if (error instanceof LlmRefusalError || error instanceof LlmResponseError) return null;
    // Nothing is saved yet, so these two say what to fix in the form rather than on Connections.
    if (error instanceof AiKeyError && error.reason === "key") return `${name} turned down this key. Copy the whole key from your ${name} account and paste it again.`;
    if (error instanceof LlmRequestError && error.status === 404) return `${name} doesn't know that model name. Copy the exact name from ${name}.`;
    if (error instanceof AiKeyError || error instanceof LlmRequestError) return error.message;
    return `${name} didn't answer. Try again in a minute.`;
  }
}
