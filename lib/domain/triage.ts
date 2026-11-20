import type { SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// How Inbox Triage sorts an email the owner forwarded. Code reads the subject,
// sender and text into one of five kinds: a customer writing in, a bill or
// payment, a supplier's invoice or price list, a review notice, or something
// else. Each kind has one agent skill that handles it; when the business
// didn't choose that skill, the email goes to the owner. Triage only routes:
// it never replies to anyone, and the receiving agent's own rules decide the
// rest.

/** What a forwarded email is about. */
export type EmailKind = "customer" | "billing" | "supplier" | "review" | "unknown";

/** The forwarded email as triage reads it. */
export interface ForwardedEmail {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
}

// Each kind's words, tested against the subject, sender and the start of the text. The first kind that matches wins,
// so the narrow ones come first: a review notice mentions a customer, and a supplier invoice mentions a payment.
const RULES: readonly (readonly [EmailKind, RegExp])[] = [
  ["review", /\b(new review|left (?:you )?a review|reviews? (?:on|from) (?:google|yelp)|star rating|\d[- ]star)\b/i],
  ["supplier", /\b(supplier|vendor|wholesale|distributor|price list|price change|purchase order|sysco|us foods|restaurant depot|ferguson|grainger)\b/i],
  ["billing", /\b(invoice|past due|overdue|payment|paid|refund|receipt|billing|balance due|statement|stripe)\b/i],
  ["customer", /\b(quote|estimate|appointment|booking|reservation|available|availability|do you|can you|could you|how much|interested in|question|inquiry|request)\b/i],
];

// The part of a long email the rules read: enough for its topic, not a whole thread of quoted replies.
const READ_CHARS = 1200;

/** Sort a forwarded email into a kind by its words alone. */
export function classifyEmail(email: ForwardedEmail): EmailKind {
  const words = `${email.subject}\n${email.from}\n${email.text.slice(0, READ_CHARS)}`;
  return RULES.find(([, pattern]) => pattern.test(words))?.[0] ?? "unknown";
}

/** The skill that handles each kind of email, or `null` for an email only the owner can sort. */
const EMAIL_SKILL: Readonly<Record<EmailKind, SkillId | null>> = {
  customer: "inquiry",
  billing: "nudger",
  supplier: "pricewatch",
  review: "reviewdrafter",
  unknown: null,
};

/** Where a forwarded email goes: the skill that handles its kind when the business chose it, else the owner. */
export function routeEmail(kind: EmailKind, chosen: ReadonlySet<SkillId>): { readonly kind: EmailKind; readonly skill: SkillId | null } {
  const skill = EMAIL_SKILL[kind];
  return { kind, skill: skill !== null && chosen.has(skill) ? skill : null };
}
