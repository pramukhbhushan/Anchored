import type { z } from "zod";
import type { ModelTier } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The provider-agnostic model interface. Features ask an `LlmProvider` for text
// or a typed object by task tier (`ModelTier`); which vendor and model answer is
// configuration, not code. Errors are typed so callers can fall back cleanly.

/** Model providers Anchored can call. `openai-compatible` covers any other endpoint that speaks the OpenAI chat API. */
export type ProviderName = "anthropic" | "openai" | "openrouter" | "featherless" | "openai-compatible";

/** A request for plain text. */
export interface TextRequest {
  readonly tier: ModelTier;
  readonly prompt: string;
  readonly maxTokens: number;
}

/** A request for a typed object, validated against `schema` before it is returned. */
export interface ObjectRequest<T> extends TextRequest {
  readonly schema: z.ZodType<T>;
  /** Short identifier sent to providers that name their output schema, such as `profile_text`. */
  readonly schemaName: string;
}

/** One configured model provider. */
export interface LlmProvider {
  readonly name: ProviderName;
  /** Name shown to owners, such as "Claude" or "OpenRouter". */
  readonly label: string;
  /** Return the model id this provider uses for `tier`. */
  modelFor(tier: ModelTier): string;
  generateText(request: TextRequest): Promise<string>;
  generateObject<T>(request: ObjectRequest<T>): Promise<T>;
}

/** Raised when the provider settings in the environment are missing or invalid. */
export class LlmConfigError extends Error {
  override readonly name = "LlmConfigError";
}

/** Raised when the model declines the request. Callers keep their rules-built result. */
export class LlmRefusalError extends Error {
  override readonly name = "LlmRefusalError";
}

/** Raised when the provider answered but the answer is unusable: empty, not JSON, or the wrong shape. */
export class LlmResponseError extends Error {
  override readonly name = "LlmResponseError";
}

/** Raised when the HTTP call to the provider fails. `status` is `null` for network errors and timeouts. */
export class LlmRequestError extends Error {
  override readonly name = "LlmRequestError";
  constructor(
    message: string,
    readonly status: number | null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
