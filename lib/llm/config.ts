import "server-only";
import type { AiProviderId } from "@/lib/domain/connections";
import type { ModelTier } from "@/lib/domain/types";
import { LlmConfigError, type ProviderName } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Reads which model provider to use from environment variables and checks the
// settings once, at the boundary. Every provider takes the same three settings:
// `AI_PROVIDER`, one `AI_API_KEY`, and an optional `AI_BASE_URL`. `readProviderConfig`
// returns `null` when no provider is configured, so Anchored runs on its rules alone.
// `ownerProviderConfig` builds the settings for a key an owner saved on the
// Connections page. It always uses the provider's own endpoint: an address from
// a stranger could aim this server's requests at machines inside its network.

/** Validated settings for one provider. */
export interface ProviderConfig {
  readonly name: ProviderName;
  readonly label: string;
  readonly apiKey: string;
  /** Endpoint root: before `/chat/completions` for OpenAI-compatible providers, or the API host for Anthropic; `null` uses the SDK default. */
  readonly baseUrl: string | null;
  readonly models: Readonly<Record<ModelTier, string>>;
  /** Public URL of this deployment, sent as an attribution header where a provider asks for one. */
  readonly appUrl: string | null;
}

const PROVIDERS: readonly ProviderName[] = ["anthropic", "openai", "openrouter", "featherless", "openai-compatible"];

const LABELS: Readonly<Record<ProviderName, string>> = {
  anthropic: "Claude",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  featherless: "Featherless",
  "openai-compatible": "your AI provider",
};

// Default endpoints from each provider's docs, checked Nov 2026. `AI_BASE_URL` overrides them.
// Anthropic has none here because its SDK carries its own; `openai-compatible` must set one.
const BASE_URLS: Readonly<Partial<Record<ProviderName, string>>> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  featherless: "https://api.featherless.ai/v1",
};

// Anthropic has built-in defaults per tier; other providers name their models in the environment.
const ANTHROPIC_MODELS: Readonly<Record<ModelTier, string>> = {
  quick: "claude-haiku-5-5",
  default: "claude-sonnet-5-5",
  complex: "claude-opus-5-5",
};

const TIER_VARS: Readonly<Record<ModelTier, string>> = {
  quick: "AI_MODEL_QUICK",
  default: "AI_MODEL_DEFAULT",
  complex: "AI_MODEL_COMPLEX",
};

type Env = Readonly<Record<string, string | undefined>>;

function isProviderName(value: string): value is ProviderName {
  return (PROVIDERS as readonly string[]).includes(value);
}

/** Read a variable, treating blank as unset. */
function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/** Check an endpoint URL: https, or plain http only for a model running on this machine. */
function checkBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new LlmConfigError("`AI_BASE_URL` is not a valid URL.", { cause: error });
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new LlmConfigError("`AI_BASE_URL` must use https, except for a model on localhost.");
  }
  return url.toString().replace(/\/+$/, "");
}

/** Resolve the model for each tier: the tier's variable, then `AI_MODEL`, then the provider default. */
function resolveModels(env: Env, name: ProviderName): Record<ModelTier, string> {
  const shared = read(env, "AI_MODEL");
  const models = {} as Record<ModelTier, string>;
  for (const tier of Object.keys(TIER_VARS) as ModelTier[]) {
    const model = read(env, TIER_VARS[tier]) ?? shared ?? (name === "anthropic" ? ANTHROPIC_MODELS[tier] : undefined);
    if (!model) throw new LlmConfigError(`${LABELS[name]} needs a model name. Set \`AI_MODEL\`, or \`${TIER_VARS[tier]}\` for the ${tier} tier.`);
    models[tier] = model;
  }
  return models;
}

/** Return the configured provider, or `null` when none is set up. */
export function readProviderConfig(env: Env): ProviderConfig | null {
  const name = read(env, "AI_PROVIDER")?.toLowerCase();
  const apiKey = read(env, "AI_API_KEY");
  if (name === undefined) {
    if (apiKey) throw new LlmConfigError(`\`AI_API_KEY\` is set but \`AI_PROVIDER\` is not. Set it to one of: ${PROVIDERS.join(", ")}.`);
    return null;
  }
  if (!isProviderName(name)) throw new LlmConfigError(`\`AI_PROVIDER\` "${name}" isn't supported. Use one of: ${PROVIDERS.join(", ")}.`);
  if (!apiKey) throw new LlmConfigError(`\`AI_PROVIDER\` is ${name}, but \`AI_API_KEY\` is unset.`);

  const rawBaseUrl = read(env, "AI_BASE_URL");
  if (name === "openai-compatible" && !rawBaseUrl) {
    throw new LlmConfigError("`AI_PROVIDER` is openai-compatible, so set `AI_BASE_URL` to the endpoint root, such as https://example.com/v1.");
  }
  const baseUrl = rawBaseUrl ? checkBaseUrl(rawBaseUrl) : (BASE_URLS[name] ?? null);

  return { name, label: LABELS[name], apiKey, baseUrl, models: resolveModels(env, name), appUrl: read(env, "APP_URL") ?? null };
}

/** A key an owner saved for their business, decrypted. */
export interface OwnerAiSettings {
  readonly provider: AiProviderId;
  readonly apiKey: string;
  /** One model for every tier, or `null` for the provider's own tier defaults. Only Anthropic has defaults. */
  readonly model: string | null;
}

/** Return the settings for an owner's own key, always on the provider's own endpoint. Throws `LlmConfigError` when a model is needed and missing. */
export function ownerProviderConfig(owner: OwnerAiSettings, env: Env): ProviderConfig {
  const name = owner.provider;
  let models: Record<ModelTier, string>;
  if (owner.model) models = { quick: owner.model, default: owner.model, complex: owner.model };
  else if (name === "anthropic") models = { ...ANTHROPIC_MODELS };
  else throw new LlmConfigError(`${LABELS[name]} needs a model name.`);
  return { name, label: LABELS[name], apiKey: owner.apiKey, baseUrl: BASE_URLS[name] ?? null, models, appUrl: read(env, "APP_URL") ?? null };
}
