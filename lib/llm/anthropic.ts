import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
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

/** Return the reply's text, or throw `LlmRefusalError` on a refusal and `LlmResponseError` when it has no text. */
function answerText(response: BetaMessage): string {
  // A refusal can arrive after partial output, so check it before reading any content.
  if (response.stop_reason === "refusal") throw new LlmRefusalError("Claude declined this request.");
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("").trim();
  if (!text) throw new LlmResponseError("Claude returned no text.");
  return text;
}

/** Claude via the Anthropic SDK. */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  readonly label: string;
  private readonly client: Anthropic;
  private readonly models: Readonly<Record<ModelTier, string>>;

  /** Build the client; `fetchImpl` replaces the SDK's `fetch`, and leaving it out keeps the SDK default. */
  constructor(config: ProviderConfig, fetchImpl?: typeof fetch) {
    this.label = config.label;
    this.models = config.models;
    this.client = new Anthropic({ apiKey: config.apiKey, timeout: 60_000, maxRetries: 2, fetch: fetchImpl });
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

  /** Send one Messages request, turning an SDK error into an `LlmRequestError` that keeps the HTTP status. */
  private async send(params: MessageCreateParamsNonStreaming): Promise<BetaMessage> {
    try {
      return await this.client.beta.messages.create(params);
    } catch (error) {
      if (error instanceof Anthropic.APIError) throw new LlmRequestError(`Claude request failed: ${error.message}`, error.status ?? null, { cause: error });
      throw error;
    }
  }

  async generateText(request: TextRequest): Promise<string> {
    const model = this.modelFor(request.tier);
    const response = await this.send({
      model,
      max_tokens: request.maxTokens,
      ...this.modelOptions(model),
      messages: [{ role: "user", content: request.prompt }],
    });
    return answerText(response);
  }

  async generateObject<T>(request: ObjectRequest<T>): Promise<T> {
    const model = this.modelFor(request.tier);
    const options = this.modelOptions(model);
    const format = betaZodOutputFormat(request.schema);
    // `create`, not the SDK's `parse`: `parse` reads the answer before a refusal can be checked,
    // and throws an untyped error on a declined, cut-off or mismatched answer.
    const response = await this.send({
      model,
      max_tokens: request.maxTokens,
      ...options,
      output_config: { ...options.output_config, format },
      messages: [{ role: "user", content: request.prompt }],
    });
    const text = answerText(response);
    try {
      return format.parse(text);
    } catch (error) {
      // Invalid JSON, as from an answer cut off at `max_tokens`, and a schema mismatch both throw here.
      throw new LlmResponseError("Claude's answer did not match the expected shape.", { cause: error });
    }
  }
}
