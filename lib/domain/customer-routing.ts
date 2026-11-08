import type { SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Which Customer skill answers a customer's Telegram message. Code decides,
// from what is already on record for that customer: an open quote goes to
// Closer, a booking to Show-up Keeper, a catering request to Catering
// Responder, and anything else to Inquiry Responder. Only skills the business
// chose can answer. A question about a bill goes to Bookkeeping instead, and a
// message no chosen skill can answer goes to the owner. The model never picks.

/** The skills that answer a customer's message on their thread, in the order they win when several apply. */
export const THREAD_SKILLS = ["closer", "showup", "catering", "inquiry"] as const;

/** One of `THREAD_SKILLS`. */
export type ThreadSkill = (typeof THREAD_SKILLS)[number];

/** A card already on record for this customer, as routing reads it. */
export interface ThreadCard {
  readonly skill: SkillId | null;
  readonly status: "pending" | "approved" | "skipped" | "superseded";
}

/** Where a customer's message goes. */
export type CustomerRoute =
  | { readonly kind: "skill"; readonly skill: ThreadSkill }
  | { readonly kind: "billing" }
  | { readonly kind: "owner" };

// A question about money the customer owes or paid. Bookkeeping answers those with amounts from Stripe, never a guess.
// "What do you charge?" asks for a price, which Inquiry answers, so only the past tense "charged" counts here.
const BILLING = /\b(bill(?:ed|ing)?|invoices?|receipts?|refunds?|charged|payments?|paid|pay(?:ing)?|owe[ds]?|balance)\b/i;
const PRICE_REQUEST = /\b(how much|what (?:does|do|would|will|is|are).{0,30}(?:cost|charge)|price|pricing|rate|rates|estimate|quote)\b/i;
// A request for catering, in the words customers use for it.
const CATERING = /\b(cater(?:ing|er|ed)?|party (?:of|for) \d+|\d+ (?:people|guests|persons))\b/i;

/** Whether the customer's message asks about a bill or a payment. */
export function asksAboutBilling(text: string): boolean {
  return BILLING.test(text);
}

/** Whether a customer is asking what the business charges for new work. */
export function asksForPrice(text: string): boolean {
  return PRICE_REQUEST.test(text);
}

/**
 * Pick where a customer's message goes. `cards` are this customer's cards on record; only ones the owner approved
 * or still has pending count, so a skipped quote doesn't keep pulling the thread back to Closer.
 */
export function routeCustomerMessage(text: string, chosen: ReadonlySet<SkillId>, cards: readonly ThreadCard[]): CustomerRoute {
  if (asksAboutBilling(text)) return { kind: "billing" };
  const live = new Set(cards.filter((card) => card.status === "pending" || card.status === "approved").map((card) => card.skill));
  const applies: Readonly<Record<ThreadSkill, boolean>> = {
    closer: live.has("closer") || asksForPrice(text),
    showup: live.has("showup"),
    catering: live.has("catering") || CATERING.test(text),
    inquiry: true,
  };
  const skill = THREAD_SKILLS.find((candidate) => applies[candidate] && chosen.has(candidate));
  return skill === undefined ? { kind: "owner" } : { kind: "skill", skill };
}
