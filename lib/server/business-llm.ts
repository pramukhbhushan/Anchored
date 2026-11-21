import "server-only";
import type { AiSetup } from "@/lib/domain/agents";
import { AI_PROVIDER_COPY, isAiProvider } from "@/lib/domain/connections";
import {
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
// The one way to get a model. `getBusinessLlm` returns a provider only when the
// business has saved its own AI key on the Connections page; with none, it
// returns `null` and the rules write. The deployment holds no AI key of its own,
// so every call spends the owner's money on the owner's account, and no daily
// cap applies. An owner's provider error never carries the provider's own text,
// which can quote part of the key; the owner gets plain words instead, and a
// refused key raises `AiKeyError`.

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
    console.error("[AI] A business's saved AI key can't be read, so the rules write its drafts. Check that CONNECTOR_SECRET_KEY hasn't changed.");
    return null;
  }
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

/** Return the provider for model calls on `businessId`: the business's own key, or `null` when it has none and the rules write. */
export async function getBusinessLlm(session: string, businessId: string): Promise<LlmProvider | null> {
  return llmFromConnections(await getStore().listConnections(session, businessId));
}

/** `getBusinessLlm` for a caller that already read the business's connections. */
export function llmFromConnections(connections: readonly StoredConnection[]): LlmProvider | null {
  const owner = ownerKeyFrom(connections);
  return owner === null ? null : fromOwnerKey(owner);
}

/** Report whether the business has an AI key of its own for model calls. */
export async function isAiConfigured(session: string, businessId: string): Promise<boolean> {
  return (await getBusinessLlm(session, businessId)) !== null;
}

/** The provider that runs the business's model calls and its model for each tier, or `null` when it has no key. */
export async function aiSetup(session: string, businessId: string): Promise<AiSetup | null> {
  const llm = await getBusinessLlm(session, businessId);
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
