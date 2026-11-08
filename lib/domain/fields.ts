import type { BusinessProfile, CoreAgentId, FieldKey, ProfileDetails } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The field registry: every profile detail, which core agents need it, and how
// to ask the owner for it. A `must` field gates an agent and counts toward its
// readiness; a `nice` field only improves it. Adding a field means adding it to
// `ProfileDetails` and to `FIELDS` here, and `tsc` lists anything else to fill.

/** How much an agent depends on a field. */
export type Need = "must" | "nice";

/** One registry entry. */
export interface FieldDef {
  readonly key: FieldKey;
  /** The field's name as the owner reads it. */
  readonly label: string;
  /** The agents that use the field, and how much each depends on it. */
  readonly needs: Readonly<Partial<Record<CoreAgentId, Need>>>;
  /** Whether the field applies to this business at all, such as price drivers only for businesses that quote. */
  readonly appliesTo?: (business: Pick<BusinessProfile, "details">) => boolean;
  /** The gap question, and an example of the answer's format. The example shows a shape, never a suggested value. */
  readonly ask: { readonly prompt: string; readonly example: string };
}

/** Whether the business prices each request separately. */
function quotes(business: Pick<BusinessProfile, "details">): boolean {
  return business.details?.pricingMethod === "quote";
}

/** Every profile detail, keyed by field. */
export const FIELDS: Readonly<Record<FieldKey, FieldDef>> = {
  licenses: {
    key: "licenses",
    label: "License expiry dates",
    needs: { internal: "nice" },
    ask: { prompt: "In Internal Communications, record each license's expiry date and where it came from.", example: "Use the date printed on the license." },
  },
  ownerName: {
    key: "ownerName",
    label: "Your first name",
    needs: { frontdesk: "must", followup: "nice", internal: "nice" },
    ask: { prompt: "What's your first name, so replies can sign off as you?", example: "Dana" },
  },
  vocabulary: {
    key: "vocabulary",
    label: "Your words for customers and work",
    needs: { frontdesk: "must", followup: "must", books: "must", content: "must", internal: "must" },
    ask: { prompt: "What do you call your customers, and one piece of work you do for them?", example: "Homeowners, and a service call" },
  },
  address: {
    key: "address",
    label: "Business address",
    needs: { frontdesk: "nice", internal: "nice" },
    ask: { prompt: "What address should customers use?", example: "10 Main St, Bowie, MD 20715" },
  },
  businessPhone: {
    key: "businessPhone",
    label: "Business phone",
    needs: { frontdesk: "nice", internal: "nice" },
    ask: { prompt: "What phone number should customers call?", example: "(301) 555-0192" },
  },
  hours: {
    key: "hours",
    label: "Hours",
    needs: { frontdesk: "must", internal: "nice" },
    ask: { prompt: "What are your hours?", example: "Mon to Fri 8 a.m. to 6 p.m., Sat 9 a.m. to 1 p.m." },
  },
  pricingMethod: {
    key: "pricingMethod",
    label: "How you charge",
    needs: { frontdesk: "must", followup: "must", books: "must" },
    ask: { prompt: "How do you charge?", example: "A set menu, by the hour, a quote for each request, or packages" },
  },
  prices: {
    key: "prices",
    label: "Prices",
    needs: { followup: "must", frontdesk: "nice", books: "nice" },
    ask: { prompt: "What do you usually charge? Give each item and its price or range.", example: "Basic $40, Full $90 to $120" },
  },
  priceDrivers: {
    key: "priceDrivers",
    label: "What changes a price",
    needs: { followup: "must", frontdesk: "nice" },
    appliesTo: quotes,
    ask: { prompt: "What makes a price go up or down?", example: "Size, distance, how soon they need it" },
  },
  minimumCharge: {
    key: "minimumCharge",
    label: "Minimum charge",
    needs: { followup: "nice", books: "nice" },
    ask: { prompt: "Is there a minimum charge?", example: "$75, or none" },
  },
  urgentCriteria: {
    key: "urgentCriteria",
    label: "What counts as urgent",
    needs: { frontdesk: "must", internal: "must" },
    ask: { prompt: "What counts as urgent, so Anchored tells you right away?", example: "Anything that can't wait until tomorrow, like a leak or a same-day order" },
  },
  faqs: {
    key: "faqs",
    label: "Common questions",
    needs: { frontdesk: "nice" },
    ask: { prompt: "What do customers ask most, and what do you tell them?", example: "Is there parking? Yes, out back." },
  },
  nextStep: {
    key: "nextStep",
    label: "Next step for a new lead",
    needs: { followup: "must", frontdesk: "nice" },
    ask: { prompt: "When someone new asks about your work, what should happen next?", example: "Book a call, send an estimate, or book a visit" },
  },
  reminderFirmness: {
    key: "reminderFirmness",
    label: "Payment reminder tone",
    needs: { books: "must" },
    ask: { prompt: "How firm should payment reminders be?", example: "Gentle, standard or firm" },
  },
  promoteFocus: {
    key: "promoteFocus",
    label: "What to promote",
    needs: { content: "must" },
    ask: { prompt: "What do you want your posts to promote?", example: "Weekend specials, a new service, open spots this month" },
  },
  reviewLink: {
    key: "reviewLink",
    label: "Google review link",
    needs: { followup: "nice", content: "nice" },
    ask: { prompt: "Paste the link customers use to review you on Google.", example: "https://g.page/r/..." },
  },
  examples: {
    key: "examples",
    label: "Messages, quotes and posts you've written",
    needs: { frontdesk: "nice", followup: "nice", content: "nice" },
    ask: { prompt: "Paste a message, quote or post you've sent before, so agents can sound like you.", example: "Any recent one works" },
  },
};

/** Every field key, in registry order. */
export const FIELD_KEYS: readonly FieldKey[] = Object.keys(FIELDS) as FieldKey[];

/** The fields `agent` needs at `need`, leaving out fields that don't apply to this business. */
export function fieldsFor(agent: CoreAgentId, need: Need, business: Pick<BusinessProfile, "details">): FieldKey[] {
  return FIELD_KEYS.filter((key) => {
    const def = FIELDS[key];
    return def.needs[agent] === need && (def.appliesTo?.(business) ?? true);
  });
}

/** Whether `details` holds a usable value for `key`: a non-blank string, a number, or a non-empty list or object. */
export function isFilled(details: ProfileDetails | undefined, key: FieldKey): boolean {
  const value: unknown = details?.[key];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "object";
}
