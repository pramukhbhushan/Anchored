import "server-only";
import type { AiSetup } from "@/lib/domain/agents";
import { AnthropicProvider } from "./anthropic";
import { readProviderConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { LlmConfigError, type LlmProvider } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Entry point of the model layer. `getLlm` builds the configured provider once
// per process; features call it and never import a vendor SDK themselves.
// With no provider configured, it returns `null` and Anchored runs on its rules.

export * from "./types";

interface Resolved {
  readonly provider: LlmProvider | null;
}

// One provider per server process; settings come from the environment and don't change at runtime.
let resolved: Resolved | undefined;

/** Build the provider named by the environment. */
function build(env: Readonly<Record<string, string | undefined>>): LlmProvider | null {
  const config = readProviderConfig(env);
  if (!config) return null;
  return config.name === "anthropic" ? new AnthropicProvider(config) : new OpenAICompatibleProvider(config);
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

/** Report whether an AI provider is configured. */
export function isAiConfigured(): boolean {
  return getLlm() !== null;
}

/** Name of the configured provider for owners, such as "Claude", or `null` when AI is off. */
export function aiLabel(): string | null {
  return getLlm()?.label ?? null;
}

/** The configured provider's name and the model it runs for each tier, or `null` when AI is off. */
export function aiSetup(): AiSetup | null {
  const llm = getLlm();
  if (llm === null) return null;
  return { label: llm.label, models: { quick: llm.modelFor("quick"), default: llm.modelFor("default"), complex: llm.modelFor("complex") } };
}
