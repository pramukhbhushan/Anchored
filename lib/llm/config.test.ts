import { describe, expect, it } from "vitest";
import { readProviderConfig } from "./config";
import { LlmConfigError } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of `readProviderConfig`: which provider, key, endpoint and models an
// environment resolves to, and that each bad setting raises `LlmConfigError`
// naming the variable the operator has to fix.

const CLAUDE_DEFAULTS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };

describe("readProviderConfig", () => {
  it("returns `null` when no provider is set up", () => {
    expect(readProviderConfig({})).toBeNull();
  });

  it("treats blank variables as unset", () => {
    expect(readProviderConfig({ AI_PROVIDER: "  ", ANTHROPIC_API_KEY: "" })).toBeNull();
  });

  it("returns `null` for a non-Anthropic key alone, since only Claude is picked without `AI_PROVIDER`", () => {
    expect(readProviderConfig({ OPENAI_API_KEY: "test-openai-key", AI_MODEL: "gpt-test" })).toBeNull();
  });

  it("turns on Claude with its default models when only `ANTHROPIC_API_KEY` is set", () => {
    expect(readProviderConfig({ ANTHROPIC_API_KEY: "test-anthropic-key" })).toEqual({
      name: "anthropic",
      label: "Claude",
      apiKey: "test-anthropic-key",
      baseUrl: null,
      models: CLAUDE_DEFAULTS,
      appUrl: null,
    });
  });

  it.each([
    { provider: "openai", keyVar: "OPENAI_API_KEY", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
    { provider: "openrouter", keyVar: "OPENROUTER_API_KEY", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
    { provider: "featherless", keyVar: "FEATHERLESS_API_KEY", label: "Featherless", baseUrl: "https://api.featherless.ai/v1" },
  ])("resolves $provider from `$keyVar` and its documented base URL", ({ provider, keyVar, label, baseUrl }) => {
    const config = readProviderConfig({ AI_PROVIDER: provider, [keyVar]: "test-key", AI_MODEL: "test-model" });
    expect(config).toEqual({
      name: provider,
      label,
      apiKey: "test-key",
      baseUrl,
      models: { quick: "test-model", default: "test-model", complex: "test-model" },
      appUrl: null,
    });
  });

  it("resolves a custom endpoint from `AI_API_KEY` and `AI_BASE_URL`, dropping the trailing slash", () => {
    const config = readProviderConfig({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "test-key", AI_BASE_URL: "https://models.example.com/v1/", AI_MODEL: "test-model" });
    expect(config).toMatchObject({ name: "openai-compatible", apiKey: "test-key", baseUrl: "https://models.example.com/v1" });
  });

  it.each(["http://localhost:11434/v1", "http://127.0.0.1:8080/v1"])("accepts plain http for a model on this machine: %s", (baseUrl) => {
    const config = readProviderConfig({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "test-key", AI_BASE_URL: baseUrl, AI_MODEL: "test-model" });
    expect(config?.baseUrl).toBe(baseUrl);
  });

  it("reads `AI_PROVIDER` without regard to case", () => {
    const config = readProviderConfig({ AI_PROVIDER: "OpenRouter", OPENROUTER_API_KEY: "test-key", AI_MODEL: "test-model" });
    expect(config?.name).toBe("openrouter");
  });

  it("uses a tier's own model variable first, then `AI_MODEL` for the rest", () => {
    const config = readProviderConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "test-key", AI_MODEL: "shared-model", AI_MODEL_COMPLEX: "big-model" });
    expect(config?.models).toEqual({ quick: "shared-model", default: "shared-model", complex: "big-model" });
  });

  it("lets a tier variable replace one of Claude's defaults and keeps the others", () => {
    const config = readProviderConfig({ ANTHROPIC_API_KEY: "test-anthropic-key", AI_MODEL_QUICK: "claude-haiku-4-5" });
    expect(config?.models).toEqual({ ...CLAUDE_DEFAULTS, quick: "claude-haiku-4-5" });
  });

  it("keeps `APP_URL` for attribution headers", () => {
    const config = readProviderConfig({ ANTHROPIC_API_KEY: "test-anthropic-key", APP_URL: "https://anchored.example.com" });
    expect(config?.appUrl).toBe("https://anchored.example.com");
  });

  describe("raises `LlmConfigError` naming the variable to fix", () => {
    const customEndpoint = { AI_PROVIDER: "openai-compatible", AI_API_KEY: "test-key", AI_MODEL: "test-model" };

    it.each([
      { problem: "an unknown provider", env: { AI_PROVIDER: "gemini", AI_API_KEY: "test-key" }, variable: "`AI_PROVIDER`" },
      { problem: "a missing provider key", env: { AI_PROVIDER: "openrouter", AI_MODEL: "test-model" }, variable: "`OPENROUTER_API_KEY`" },
      { problem: "a missing Claude key", env: { AI_PROVIDER: "anthropic" }, variable: "`ANTHROPIC_API_KEY`" },
      { problem: "a missing custom endpoint key", env: { AI_PROVIDER: "openai-compatible", AI_BASE_URL: "https://models.example.com/v1", AI_MODEL: "test-model" }, variable: "`AI_API_KEY`" },
      { problem: "a missing model", env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key" }, variable: "`AI_MODEL`" },
      { problem: "a missing model for one tier", env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key", AI_MODEL_QUICK: "a", AI_MODEL_DEFAULT: "b" }, variable: "`AI_MODEL_COMPLEX`" },
      { problem: "a custom endpoint without a base URL", env: customEndpoint, variable: "`AI_BASE_URL`" },
      { problem: "a remote base URL over plain http", env: { ...customEndpoint, AI_BASE_URL: "http://models.example.com/v1" }, variable: "`AI_BASE_URL`" },
      { problem: "a base URL that is not a URL", env: { ...customEndpoint, AI_BASE_URL: "models.example.com" }, variable: "`AI_BASE_URL`" },
    ])("for $problem", ({ env, variable }) => {
      expect(() => readProviderConfig(env)).toThrow(LlmConfigError);
      expect(() => readProviderConfig(env)).toThrow(variable);
    });
  });
});
