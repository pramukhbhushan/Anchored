import "server-only";
import type { AiSetup } from "@/lib/domain/agents";
import { AI_PROVIDER_COPY, isAiProvider, type AiProviderId } from "@/lib/domain/connections";
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
// Calls on the server's key count against a daily cap shared by every visitor
// and server instance, through `Store.useAiCall`, so a public deployment can't
// run up its bill. Calls on an owner's key spend the owner's money and skip the
// cap. An owner's provider error never carries the provider's own text, which
// can quote part of the key; the owner gets plain words instead, and a refused
// key raises `AiKeyError`.

/** Calls allowed per UTC day when `AI_DAILY_CALL_CAP` is unset. */
export const DEFAULT_DAILY_CALL_CAP = 2000;

/** The business a model call works for. */
export interface AiScope {
  readonly session: string;
  readonly businessId: string;
}

/** Raised instead of calling the model once today's cap is spent. */
export class AiBudgetError extends Error {
  override readonly name = "AiBudgetError";
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

/** Read the daily cap from `AI_DAILY_CALL_CAP`, falling back to the default when it is unset or invalid. */
export function dailyCallCap(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.AI_DAILY_CALL_CAP?.trim();
  if (!raw) return DEFAULT_DAILY_CALL_CAP;
  const cap = Number(raw);
  if (Number.isInteger(cap) && cap >= 0) return cap;
  console.error(`[AI budget] \`AI_DAILY_CALL_CAP\` must be a whole number of 0 or more, not "${raw}"; using ${DEFAULT_DAILY_CALL_CAP}.`);
  return DEFAULT_DAILY_CALL_CAP;
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

/** Return `llm` with every call counted by `spend` first; a `false` from `spend` throws `AiBudgetError` and skips the call. */
export function withDailyBudget(llm: LlmProvider, spend: () => Promise<boolean>): LlmProvider {
  return wrap(llm, async (call) => {
    if (!(await spend())) throw new AiBudgetError("Anchored has used today's AI calls. Drafts stay as written until tomorrow.");
    return call();
  });
}

/** Turn a failed call on an owner's key into an error that says, in the owner's words, what to do, with none of the provider's text. */
export function ownerKeyError(provider: AiProviderId, error: unknown): Error {
  // Refusals and unusable answers carry Anchored's own words, and mean the key worked.
  if (error instanceof LlmRefusalError || error instanceof LlmResponseError || error instanceof AiKeyError) return error;
  const name = AI_PROVIDER_COPY[provider].name;
  const status = error instanceof LlmRequestError ? error.status : null;
  if (status === 401 || status === 403) return new AiKeyError(`${name} turned down your AI key. Check it on Connections.`, "key");
  if (status === 402) return new AiKeyError(`${name} says your AI account is out of credit. Add credit with ${name}, then try again.`, "credit");
  if (status === 404) return new LlmRequestError(`${name} doesn't know the model name saved on Connections. Copy the exact name from ${name}.`, status);
  if (status === 429) return new LlmRequestError(`${name} is limiting your AI key right now. Try again in a minute, or check your plan with ${name}.`, status);
  if (status !== null && status < 500) return new LlmRequestError(`${name} turned down the request. Check the model name on Connections.`, status);
  return new LlmRequestError(`${name} didn't answer. Try again in a minute.`, status);
}

/** Return `llm`, built from an owner's key, with its errors rewritten by `ownerKeyError`. */
export function withOwnerErrors(llm: LlmProvider, provider: AiProviderId): LlmProvider {
  return wrap(llm, async (call) => {
    try {
      return await call();
    } catch (error) {
      throw ownerKeyError(provider, error);
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

/** The server's provider from the environment under today's call cap, or `null` when it has none. */
function serverLlm(): LlmProvider | null {
  const llm = getLlm();
  if (!llm) return null;
  // The day is UTC so every server instance counts against the same row.
  return withDailyBudget(llm, () => getStore().useAiCall(new Date().toISOString().slice(0, 10), dailyCallCap()));
}

/** Report whether this server has its own key in the environment, which businesses without a key fall back to. */
export function serverHasAi(): boolean {
  return getLlm() !== null;
}

/** Build the provider for an owner's key, or `null` when its settings are incomplete. */
function fromOwnerKey(owner: OwnerAiSettings): LlmProvider | null {
  try {
    return withOwnerErrors(ownerLlm(owner), owner.provider);
  } catch (error) {
    if (error instanceof LlmConfigError) return null;
    throw error;
  }
}

/**
 * Return the provider for model calls made for `scope`: the business's own key, else the server's key under
 * the daily cap, else `null`, and the rules write instead. Pass `null` before a business exists, such as
 * during onboarding, and only the server's key is used.
 */
export async function getBudgetedLlm(scope: AiScope | null): Promise<LlmProvider | null> {
  if (scope === null) return serverLlm();
  return llmFromConnections(await getStore().listConnections(scope.session, scope.businessId));
}

/** `getBudgetedLlm` for a caller that already read the business's connections. */
export function llmFromConnections(connections: readonly StoredConnection[]): LlmProvider | null {
  const owner = ownerKeyFrom(connections);
  return (owner === null ? null : fromOwnerKey(owner)) ?? serverLlm();
}

/** Report whether model calls for `scope` have a provider, the owner's or the server's. */
export async function isAiConfigured(scope: AiScope | null): Promise<boolean> {
  return (await getBudgetedLlm(scope)) !== null;
}

/** The name owners see for the provider that runs `scope`'s model calls, such as "Claude", or `null` when AI is off. */
export async function aiLabel(scope: AiScope | null): Promise<string | null> {
  return (await getBudgetedLlm(scope))?.label ?? null;
}

/** The provider that runs `scope`'s model calls and its model for each tier, or `null` when AI is off. */
export async function aiSetup(scope: AiScope | null): Promise<AiSetup | null> {
  const llm = await getBudgetedLlm(scope);
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
    if (error instanceof AiKeyError && error.reason === "key") return `${name} turned down this key. Copy the whole key from your ${name} account and paste it again.`;
    if (error instanceof AiKeyError || error instanceof LlmRequestError) return error.message;
    return `${name} didn't answer. Try again in a minute.`;
  }
}
