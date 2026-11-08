// =============================================================================
// Module Overview
// =============================================================================
// The outside services a business can connect, named once. Texting and calls
// run on the owner's own Twilio number; email goes out from Anchored with the
// owner as reply-to and comes in through a forwarding address; Stripe tells
// Anchored when an invoice goes unpaid. Each connection feeds the agents listed
// in `CONNECTION_FEEDS`.

/** A service a business can connect. */
export type ConnectionKind = "texting" | "email-out" | "email-in" | "stripe";

/** Every kind, in the order the Connections page shows them. */
export const CONNECTION_KINDS: readonly ConnectionKind[] = ["texting", "email-out", "email-in", "stripe"];

/** What each connection is called, and what it does for the owner, in plain words. */
export const CONNECTION_COPY: Readonly<Record<ConnectionKind, { readonly name: string; readonly does: string }>> = {
  texting: {
    name: "Texting and missed calls",
    does: "Your Twilio number sends the texts you approve, turns missed calls into callback drafts, and turns customer texts into drafts.",
  },
  "email-out": {
    name: "Sending email",
    does: "Anchored sends the emails you approve. Replies come straight to your own address.",
  },
  "email-in": {
    name: "Forwarded email",
    does: "Forward an email to your Anchored address and the right agent drafts a reply.",
  },
  stripe: {
    name: "Stripe invoices",
    does: "When a Stripe invoice goes unpaid, Payment Nudger drafts a reminder.",
  },
};
