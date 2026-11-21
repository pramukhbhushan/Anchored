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

/** A request to answer `prompt` from the web, searching at most `maxSearches` times. */
export interface WebSearchRequest extends TextRequest {
  readonly maxSearches: number;
}

/** One page a web search returned. */
export interface WebSource {
  readonly url: string;
  readonly title: string;
}

/** The model's answer from the web, with every page its searches returned. */
export interface WebFindings {
  readonly text: string;
  /** Pages the provider's search returned, in the order it returned them, each URL once. */
  readonly sources: readonly WebSource[];
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
  /** Search the web and answer from it. Only providers with a search tool have it. */
  searchWeb?(request: WebSearchRequest): Promise<WebFindings>;
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

/**
 * Raised when the HTTP call to the provider fails. `status` is `null` for network errors and timeouts.
 * `reason` is "credit" when the provider said the account is out of credit, whatever status it used for it.
 */
export class LlmRequestError extends Error {
  override name = "LlmRequestError";
  readonly reason: "credit" | null;
  constructor(
    message: string,
    readonly status: number | null,
    options?: { cause?: unknown; reason?: "credit" },
  ) {
    super(message, { cause: options?.cause });
    this.reason = options?.reason ?? null;
  }
}
