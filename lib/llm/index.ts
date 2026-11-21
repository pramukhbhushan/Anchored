import "server-only";
import { AnthropicProvider } from "./anthropic";
import { ownerProviderConfig, readProviderConfig, type OwnerAiSettings, type ProviderConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { LlmConfigError, type LlmProvider } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Entry point of the model layer. `getLlm` builds the provider the environment
// names, once per process; `ownerLlm` builds one from a key an owner saved.
// Features never import a vendor SDK themselves. With no provider configured,
// `getLlm` returns `null` and Anchored runs on its rules.

export * from "./types";
export type { OwnerAiSettings } from "./config";

interface Resolved {
  readonly provider: LlmProvider | null;
}

// One provider per server process; settings come from the environment and don't change at runtime.
let resolved: Resolved | undefined;

/** Build the adapter for `config`. */
function providerFor(config: ProviderConfig): LlmProvider {
  return config.name === "anthropic" ? new AnthropicProvider(config) : new OpenAICompatibleProvider(config);
}

/** Build the provider named by the environment. */
function build(env: Readonly<Record<string, string | undefined>>): LlmProvider | null {
  const config = readProviderConfig(env);
  return config ? providerFor(config) : null;
}

/** Build a provider from an owner's own key. Throws `LlmConfigError` when the settings are incomplete. */
export function ownerLlm(owner: OwnerAiSettings): LlmProvider {
  return providerFor(ownerProviderConfig(owner, process.env));
}

/** Return the configured model provider, or `null` when AI is off. */
export function getLlm(): LlmProvider | null {
  if (resolved) return resolved.provider;
  try {
    resolved = { provider: build(process.env) };
  } catch (error) {
    if (!(error instanceof LlmConfigError)) throw error;
    // A broken setting turns AI off instead of failing every page; the log says what to fix.
    console.error(`[LLM] AI is off because the provider settings are invalid: ${error.message}`);
    resolved = { provider: null };
  }
  return resolved.provider;
}
