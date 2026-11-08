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

/** What each connection is called, what it does once connected, and what happens until it is, in plain words. */
export const CONNECTION_COPY: Readonly<Record<ConnectionKind, { readonly name: string; readonly does: string; readonly until: string }>> = {
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
  "email-in": {
    name: "Forwarded email",
    does: "Forward an email to your Anchored address and it lands in Approvals as a card for you.",
    until: "Until it is, Anchored reads none of your email.",
  },
  stripe: {
    name: "Stripe invoices",
    does: "When a Stripe invoice goes unpaid, Payment Nudger drafts a reminder.",
    until: "Until it is, Anchored can't see which invoices are unpaid.",
  },
};
