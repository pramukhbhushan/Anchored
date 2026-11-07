import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { ModelTier } from "@/lib/domain/types";
import type { ProviderConfig } from "./config";
import { LlmRefusalError, LlmRequestError, LlmResponseError, type LlmProvider, type ObjectRequest, type TextRequest } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `AnthropicProvider` calls Claude through the official SDK. Structured output
// uses the SDK's Zod helper, and the models that support it get server-side
// refusal fallbacks, so a declined request can still be answered.

// Models that accept server-side refusal fallbacks in their "default" form. Haiku 5.5 has none.
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
// Current models that take `output_config.effort`; a custom model id might not, so it gets none.
const EFFORT_MODELS = new Set(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);

/** Turn an SDK error into an `LlmRequestError` that keeps the HTTP status. */
function toRequestError(error: unknown): unknown {
  if (error instanceof Anthropic.APIError) return new LlmRequestError(`Claude request failed: ${error.message}`, error.status ?? null, { cause: error });
  return error;
}

/** Claude via the Anthropic SDK. */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  readonly label: string;
  private readonly client: Anthropic;
  private readonly models: Readonly<Record<ModelTier, string>>;

  constructor(config: ProviderConfig) {
    this.label = config.label;
    this.models = config.models;
    this.client = new Anthropic({ apiKey: config.apiKey, timeout: 60_000, maxRetries: 2 });
  }

  modelFor(tier: ModelTier): string {
    return this.models[tier];
  }

  /** Extra request fields that depend on the model: fallbacks and a low effort for these short tasks. */
  private modelOptions(model: string) {
    return {
      ...(FALLBACK_MODELS.has(model) ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
      ...(EFFORT_MODELS.has(model) ? { output_config: { effort: "low" as const } } : {}),
    };
  }

  async generateText(request: TextRequest): Promise<string> {
    const model = this.modelFor(request.tier);
    try {
      const response = await this.client.beta.messages.create({
        model,
        max_tokens: request.maxTokens,
        ...this.modelOptions(model),
        messages: [{ role: "user", content: request.prompt }],
      });
      if (response.stop_reason === "refusal") throw new LlmRefusalError("Claude declined this request.");
      const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("").trim();
      if (!text) throw new LlmResponseError("Claude returned no text.");
      return text;
    } catch (error) {
      throw toRequestError(error);
    }
  }

  async generateObject<T>(request: ObjectRequest<T>): Promise<T> {
    const model = this.modelFor(request.tier);
    const options = this.modelOptions(model);
    try {
      const response = await this.client.beta.messages.parse({
        model,
        max_tokens: request.maxTokens,
        ...options,
        output_config: { ...options.output_config, format: betaZodOutputFormat(request.schema) },
        messages: [{ role: "user", content: request.prompt }],
      });
      if (response.stop_reason === "refusal") throw new LlmRefusalError("Claude declined this request.");
      if (response.parsed_output === null) throw new LlmResponseError("Claude's answer did not match the expected shape.");
      return response.parsed_output;
    } catch (error) {
      throw toRequestError(error);
    }
  }
}
