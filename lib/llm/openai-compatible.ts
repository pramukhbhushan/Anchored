import "server-only";
import { z } from "zod";
import type { ModelTier } from "@/lib/domain/types";
import type { ProviderConfig } from "./config";
import { extractJson, strictJsonSchema } from "./json";
import { LlmRefusalError, LlmRequestError, LlmResponseError, type LlmProvider, type ObjectRequest, type ProviderName, type TextRequest } from "./types";

// =============================================================================
// Module Overview
// =============================================================================
// `OpenAICompatibleProvider` calls any endpoint that speaks the OpenAI chat
// completions API: OpenAI, OpenRouter, Featherless or a custom base URL. Each
// provider's quirks live in one `Dialect` row; replies are validated with Zod.

type CompatibleName = Exclude<ProviderName, "anthropic">;

/** How one provider differs on the shared chat completions API. */
interface Dialect {
  /** Name of the output token cap the provider documents. */
  readonly tokenParam: "max_tokens" | "max_completion_tokens";
  /** `json_schema` sends `response_format`; `prompt` asks for JSON in the prompt and validates the reply. */
  readonly structured: "json_schema" | "prompt";
  /** Extra body fields for every request. */
  readonly baseBody: Readonly<Record<string, unknown>>;
  /** Extra body fields for structured requests, replacing `baseBody` keys they share. */
  readonly structuredBody: Readonly<Record<string, unknown>>;
  /** Header that carries the app's name for attribution, if the provider has one. */
  readonly titleHeader: string | null;
}

// Facts from each provider's docs, checked Nov 2026. OpenAI's reference page refused automated
// fetches; its row follows OpenAI's published API, where `max_tokens` gave way to `max_completion_tokens`.
const DIALECTS: Readonly<Record<CompatibleName, Dialect>> = {
  openai: { tokenParam: "max_completion_tokens", structured: "json_schema", baseBody: {}, structuredBody: {}, titleHeader: null },
  // OpenRouter supports json_schema only on some model endpoints; `require_parameters` routes to one that does.
  // `data_collection: "deny"` keeps owners' answers away from endpoints that store prompts for training.
  openrouter: {
    tokenParam: "max_tokens",
    structured: "json_schema",
    baseBody: { provider: { data_collection: "deny" } },
    structuredBody: { provider: { data_collection: "deny", require_parameters: true } },
    titleHeader: "X-OpenRouter-Title",
  },
  // Featherless documents no `response_format`, so its JSON is requested in the prompt.
  // `enable_thinking: false` turns off reasoning on models that think by default, such as Qwen3.6:
  // with it on, Qwen spent its whole 700-token budget thinking and returned no text. Models without
  // the switch, such as Gemma 4, ignore it. Measured on Featherless, Nov 2026.
  featherless: {
    tokenParam: "max_completion_tokens",
    structured: "prompt",
    baseBody: { chat_template_kwargs: { enable_thinking: false } },
    structuredBody: {},
    titleHeader: "X-Title",
  },
  "openai-compatible": { tokenParam: "max_tokens", structured: "prompt", baseBody: {}, structuredBody: {}, titleHeader: null },
};

const APP_TITLE = "Anchored";
const TIMEOUT_MS = 60_000;

/** The part of a chat completions reply this provider reads. Everything else is ignored. */
const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({ content: z.string().nullish(), refusal: z.string().nullish() }),
      }),
    )
    .min(1),
});

/** Any OpenAI-compatible chat completions endpoint. */
export class OpenAICompatibleProvider implements LlmProvider {
  readonly name: CompatibleName;
  readonly label: string;
  private readonly dialect: Dialect;

  constructor(
    private readonly config: ProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (config.name === "anthropic" || !config.baseUrl) throw new Error("`OpenAICompatibleProvider` needs an OpenAI-compatible provider with a base URL.");
    this.name = config.name;
    this.label = config.label;
    this.dialect = DIALECTS[config.name];
  }

  modelFor(tier: ModelTier): string {
    return this.config.models[tier];
  }

  /** POST a chat completion and return the first choice's text. */
  private async complete(request: TextRequest, prompt: string, extraBody: Readonly<Record<string, unknown>>): Promise<string> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" };
    if (this.dialect.titleHeader) headers[this.dialect.titleHeader] = APP_TITLE;
    if (this.config.appUrl) headers["HTTP-Referer"] = this.config.appUrl;
    const body = { model: this.modelFor(request.tier), messages: [{ role: "user", content: prompt }], [this.dialect.tokenParam]: request.maxTokens, ...this.dialect.baseBody, ...extraBody };

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new LlmRequestError(`${this.label} could not be reached.`, null, { cause: error });
    }
    if (!response.ok) {
      // Keep the provider's error text short; it can echo the owner's words into server logs.
      const detail = (await response.text().catch(() => "")).slice(0, 120);
      throw new LlmRequestError(`${this.label} returned HTTP ${response.status}. ${detail}`.trim(), response.status);
    }

    const parsed = completionSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new LlmResponseError(`${this.label} sent a reply in an unexpected format.`);
    const choice = parsed.data.choices[0];
    if (!choice) throw new LlmResponseError(`${this.label} sent no answer.`);
    if (choice.message.refusal || choice.finish_reason === "content_filter") throw new LlmRefusalError(`${this.label} declined this request.`);
    const text = choice.message.content?.trim();
    if (!text) throw new LlmResponseError(`${this.label} returned no text.`);
    return text;
  }

  async generateText(request: TextRequest): Promise<string> {
    return this.complete(request, request.prompt, {});
  }

  async generateObject<T>(request: ObjectRequest<T>): Promise<T> {
    const jsonSchema = strictJsonSchema(z.toJSONSchema(request.schema));
    let text: string;
    if (this.dialect.structured === "json_schema") {
      text = await this.complete(request, request.prompt, {
        response_format: { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: jsonSchema } },
        ...this.dialect.structuredBody,
      });
    } else {
      const prompt = `${request.prompt}\n\nReply with only one JSON object that matches this JSON Schema, and no other text:\n${JSON.stringify(jsonSchema)}`;
      text = await this.complete(request, prompt, {});
    }

    let value: unknown;
    try {
      value = extractJson(text);
    } catch (error) {
      throw new LlmResponseError(`${this.label} did not reply with JSON.`, { cause: error });
    }
    const checked = request.schema.safeParse(value);
    if (!checked.success) throw new LlmResponseError(`${this.label}'s answer did not match the expected shape.`, { cause: checked.error });
    return checked.data;
  }
}
