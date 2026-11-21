import "server-only";
import { AnthropicProvider } from "./anthropic";
import { keyProviderConfig, ownerProviderConfig, type KeySettings, type OwnerAiSettings, type ProviderConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { LlmProvider } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Entry point of the model layer. `ownerLlm` builds a provider from a key an
// owner saved on the Connections page, the only key the web app runs on.
// `keyLlm` builds one from a key with a model per tier, for the discovery
// script on an operator's own machine. Features never import a vendor SDK.

export * from "./types";
export type { KeySettings, OwnerAiSettings } from "./config";

/** Build the adapter for `config`. */
function providerFor(config: ProviderConfig): LlmProvider {
  return config.name === "anthropic" ? new AnthropicProvider(config) : new OpenAICompatibleProvider(config);
}

/** Build a provider from an owner's own key. Throws `LlmConfigError` when the settings are incomplete. */
export function ownerLlm(owner: OwnerAiSettings): LlmProvider {
  return providerFor(ownerProviderConfig(owner, process.env));
}

/** Build a provider from a key with a model per tier. Throws `LlmConfigError` when a tier needs a model and has none. */
export function keyLlm(key: KeySettings): LlmProvider {
  return providerFor(keyProviderConfig(key, null));
}
