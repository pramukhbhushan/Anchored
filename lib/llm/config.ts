import "server-only";
import type { AiProviderId } from "@/lib/domain/connections";
import type { ModelTier } from "@/lib/domain/types";
import { LlmConfigError, type ProviderName } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Builds the settings for one provider key. `ownerProviderConfig` builds them
// for a key an owner saved on the Connections page, the only kind of key the
// web app uses. `keyProviderConfig` takes a model per tier, for the discovery
// script, which reads its key from the operator's own environment. Both always
// use the provider's own endpoint: an address from a stranger could aim this
// server's requests at machines inside its network.

/** Validated settings for one provider. */
export interface ProviderConfig {
  readonly name: ProviderName;
  readonly label: string;
  readonly apiKey: string;
  /** Endpoint root: before `/chat/completions` for OpenAI-compatible providers; `null` uses the SDK default. */
  readonly baseUrl: string | null;
  readonly models: Readonly<Record<ModelTier, string>>;
  /** Public URL of this deployment, sent as an attribution header where a provider asks for one. */
  readonly appUrl: string | null;
}

const LABELS: Readonly<Record<ProviderName, string>> = {
  anthropic: "Claude",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  featherless: "Featherless",
};

// Endpoints from each provider's docs, checked Nov 2026. Anthropic has none here because its SDK carries its own.
const BASE_URLS: Readonly<Partial<Record<ProviderName, string>>> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  featherless: "https://api.featherless.ai/v1",
};

// Anthropic has built-in defaults per tier; every other provider needs its models named.
const ANTHROPIC_MODELS: Readonly<Record<ModelTier, string>> = {
  quick: "claude-haiku-5-5",
  default: "claude-sonnet-5-5",
  complex: "claude-opus-5-5",
};

const TIERS: readonly ModelTier[] = ["quick", "default", "complex"];

type Env = Readonly<Record<string, string | undefined>>;

/** One provider key and the model for each tier; a tier left out uses the provider's default. */
export interface KeySettings {
  readonly provider: AiProviderId;
  readonly apiKey: string;
  readonly models: Readonly<Partial<Record<ModelTier, string>>>;
}

/** Return the settings for a key on its provider's own endpoint. Throws `LlmConfigError` naming the first tier with no model. */
export function keyProviderConfig(key: KeySettings, appUrl: string | null): ProviderConfig {
  const name = key.provider;
  const models = {} as Record<ModelTier, string>;
  for (const tier of TIERS) {
    const model = key.models[tier]?.trim() || (name === "anthropic" ? ANTHROPIC_MODELS[tier] : undefined);
    if (!model) throw new LlmConfigError(`${LABELS[name]} needs a model name for the ${tier} tier.`);
    models[tier] = model;
  }
  return { name, label: LABELS[name], apiKey: key.apiKey, baseUrl: BASE_URLS[name] ?? null, models, appUrl };
}

/** A key an owner saved for their business, decrypted. */
export interface OwnerAiSettings {
  readonly provider: AiProviderId;
  readonly apiKey: string;
  /** One model for every tier, or `null` for the provider's own tier defaults. Only Anthropic has defaults. */
  readonly model: string | null;
}

/** Return the settings for an owner's own key, attributed to `PUBLIC_APP_URL`. Throws `LlmConfigError` when a model is needed and missing. */
export function ownerProviderConfig(owner: OwnerAiSettings, env: Env): ProviderConfig {
  const models = owner.model ? { quick: owner.model, default: owner.model, complex: owner.model } : {};
  return keyProviderConfig({ provider: owner.provider, apiKey: owner.apiKey, models }, env.PUBLIC_APP_URL?.trim() || null);
}
