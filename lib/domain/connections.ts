// =============================================================================
// Module Overview
// =============================================================================
// The outside services a business can connect, named once. Texting and calls
// run on the owner's own Twilio number; email goes out through the owner's own
// Resend account with the owner as reply-to; Stripe tells Anchored when an
// invoice goes unpaid. The `ai` connection is the owner's own
// AI key: it moves no messages, it only decides whose account pays for the
// drafts. Owners pick one of `AI_PROVIDERS` and never type an address, so a key
// can only ever be sent to that provider's own servers.

/** A service that sends or brings in the business's messages. */
export type ServiceKind = "texting" | "email-out" | "stripe";

/** Anything a business can connect: a service, or its own AI key. */
export type ConnectionKind = ServiceKind | "ai";

/** Every service, in the order the Connections page shows them. */
export const SERVICE_KINDS: readonly ServiceKind[] = ["texting", "email-out", "stripe"];

/**
 * Report whether `value` is a kind Anchored still offers. A stored row can name a kind that was removed, such as
 * `email-in` from the old forwarded email service, and readers skip it.
 */
export function isConnectionKind(value: string): value is ConnectionKind {
  return value === "ai" || (SERVICE_KINDS as readonly string[]).includes(value);
}

/** Report whether `kind` is a service that moves messages, as opposed to the AI key. */
export function isService(kind: ConnectionKind): kind is ServiceKind {
  return kind !== "ai";
}

/** The AI providers an owner may bring a key for. */
export const AI_PROVIDERS = ["anthropic", "openai", "openrouter", "featherless"] as const;

/** One AI provider an owner may bring a key for. */
export type AiProviderId = (typeof AI_PROVIDERS)[number];

/** What each provider is called, where its key lives, and whether the owner must name a model. */
export const AI_PROVIDER_COPY: Readonly<Record<AiProviderId, { readonly name: string; readonly keyHint: string; readonly needsModel: boolean }>> = {
  anthropic: { name: "Anthropic", keyHint: "In your Anthropic account, under API keys.", needsModel: false },
  openai: { name: "OpenAI", keyHint: "In your OpenAI account, under API keys.", needsModel: true },
  openrouter: { name: "OpenRouter", keyHint: "In your OpenRouter account, under Keys.", needsModel: true },
  featherless: { name: "Featherless", keyHint: "In your Featherless account, under API keys.", needsModel: true },
};

/** Report whether `value` names a provider an owner may bring a key for. */
export function isAiProvider(value: string | undefined): value is AiProviderId {
  return (AI_PROVIDERS as readonly string[]).includes(value ?? "");
}

/** What each service is called, what it does once connected, and what happens until it is, in plain words. */
export const CONNECTION_COPY: Readonly<Record<ServiceKind, { readonly name: string; readonly does: string; readonly until: string }>> = {
  texting: {
    name: "Texting and missed calls",
    does: "Your Twilio number sends the texts you approve, turns missed calls into callback drafts, and turns customer texts into drafts.",
    until: "Until it is, Anchored sends no texts and hears about no calls. Each text you approve opens your own phone's texting app to send.",
  },
  "email-out": {
    name: "Sending email",
    does: "Anchored sends the emails you approve. Replies come straight to your own address.",
    until: "Until it is, Anchored sends no email. Each email you approve opens your own email app to send.",
  },
  stripe: {
    name: "Stripe invoices",
    does: "When a Stripe invoice goes unpaid, Payment Nudger drafts a reminder.",
    until: "Until it is, Anchored can't see which invoices are unpaid.",
  },
};
