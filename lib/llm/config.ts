import "server-only";
import type { ModelTier } from "@/lib/domain/types";
import { LlmConfigError, type ProviderName } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Reads which model provider to use from environment variables and checks the
// settings once, at the boundary. `readProviderConfig` returns `null` when no
// provider is configured, so Anchored runs on its rules alone.

/** Validated settings for one provider. */
export interface ProviderConfig {
  readonly name: ProviderName;
  readonly label: string;
  readonly apiKey: string;
  /** OpenAI-compatible endpoint root, ending before `/chat/completions`. Unused for Anthropic. */
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

const KEY_VARS: Readonly<Record<ProviderName, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  featherless: "FEATHERLESS_API_KEY",
  "openai-compatible": "AI_API_KEY",
};

// Base URLs from each provider's docs: OpenRouter and Featherless checked Nov 2026.
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
  const requested = read(env, "AI_PROVIDER")?.toLowerCase();
  // With no `AI_PROVIDER`, an Anthropic key alone turns on Claude, matching earlier setups.
  const name: string | null = requested ?? (read(env, "ANTHROPIC_API_KEY") ? "anthropic" : null);
  if (name === null) return null;
  if (!isProviderName(name)) throw new LlmConfigError(`\`AI_PROVIDER\` "${name}" isn't supported. Use one of: ${PROVIDERS.join(", ")}.`);

  const apiKey = read(env, KEY_VARS[name]);
  if (!apiKey) throw new LlmConfigError(`\`AI_PROVIDER\` is ${name}, but \`${KEY_VARS[name]}\` is unset.`);

  let baseUrl: string | null = BASE_URLS[name] ?? null;
  if (name === "openai-compatible") {
    const raw = read(env, "AI_BASE_URL");
    if (!raw) throw new LlmConfigError("`AI_PROVIDER` is openai-compatible, so set `AI_BASE_URL` to the endpoint root, such as https://example.com/v1.");
    baseUrl = checkBaseUrl(raw);
  }

  return { name, label: LABELS[name], apiKey, baseUrl, models: resolveModels(env, name), appUrl: read(env, "APP_URL") ?? null };
}
