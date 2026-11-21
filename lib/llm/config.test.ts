import { describe, expect, it } from "vitest";
import { keyProviderConfig, ownerProviderConfig } from "./config";
import { LlmConfigError } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `keyProviderConfig` and `ownerProviderConfig`: which endpoint and
// models a key resolves to, that a provider needing a model without one raises
// `LlmConfigError`, and that nothing in the environment but the deployment's
// public URL changes the result.

const CLAUDE_DEFAULTS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };
const ONE_MODEL = { quick: "test-model", default: "test-model", complex: "test-model" };

describe("keyProviderConfig", () => {
  it("uses Claude's default models and the SDK's own endpoint", () => {
    expect(keyProviderConfig({ provider: "anthropic", apiKey: "test-anthropic-key", models: {} }, null)).toEqual({
      name: "anthropic",
      label: "Claude",
      apiKey: "test-anthropic-key",
      baseUrl: null,
      models: CLAUDE_DEFAULTS,
      appUrl: null,
    });
  });

  it.each([
    { provider: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
    { provider: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
    { provider: "featherless", label: "Featherless", baseUrl: "https://api.featherless.ai/v1" },
  ] as const)("sends $provider's key to its documented base URL", ({ provider, label, baseUrl }) => {
    const config = keyProviderConfig({ provider, apiKey: "test-key", models: ONE_MODEL }, null);
    expect(config).toEqual({ name: provider, label, apiKey: "test-key", baseUrl, models: ONE_MODEL, appUrl: null });
  });

  it("lets one tier's model replace one of Claude's defaults and keeps the others", () => {
    const config = keyProviderConfig({ provider: "anthropic", apiKey: "test-anthropic-key", models: { quick: "claude-haiku-4-5" } }, null);
    expect(config.models).toEqual({ ...CLAUDE_DEFAULTS, quick: "claude-haiku-4-5" });
  });

  it("raises `LlmConfigError` naming the tier when a provider without defaults has no model for it", () => {
    const key = { provider: "openai", apiKey: "test-key", models: { quick: "a", default: "b" } } as const;
    expect(() => keyProviderConfig(key, null)).toThrow(LlmConfigError);
    expect(() => keyProviderConfig(key, null)).toThrow("complex");
  });
});

describe("ownerProviderConfig", () => {
  it("uses the owner's one model for every tier", () => {
    const config = ownerProviderConfig({ provider: "openrouter", apiKey: "test-key", model: "test-model" }, {});
    expect(config.models).toEqual(ONE_MODEL);
  });

  it("uses Claude's defaults when the owner named no model", () => {
    expect(ownerProviderConfig({ provider: "anthropic", apiKey: "test-key", model: null }, {}).models).toEqual(CLAUDE_DEFAULTS);
  });

  it("raises `LlmConfigError` when a provider without defaults has no model", () => {
    expect(() => ownerProviderConfig({ provider: "featherless", apiKey: "test-key", model: null }, {})).toThrow(LlmConfigError);
  });

  it("ignores the old server AI settings, so a team key left in the environment does nothing", () => {
    const env = { AI_PROVIDER: "openai", AI_API_KEY: "team-key", AI_BASE_URL: "https://gateway.example.com", AI_MODEL: "team-model" };
    const config = ownerProviderConfig({ provider: "anthropic", apiKey: "owner-key", model: null }, env);
    expect(config).toMatchObject({ name: "anthropic", apiKey: "owner-key", baseUrl: null, models: CLAUDE_DEFAULTS });
  });

  it("sends the deployment's public URL for attribution headers", () => {
    const config = ownerProviderConfig({ provider: "anthropic", apiKey: "test-key", model: null }, { PUBLIC_APP_URL: "https://anchored.example.com" });
    expect(config.appUrl).toBe("https://anchored.example.com");
  });
});
