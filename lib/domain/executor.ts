import type { CardDraft } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The rules plain code enforces before anything reaches a customer.
// `checkSend` runs after the owner taps Approve and refuses a card that breaks
// a rule, whatever the model drafted: locked threads, texts without consent,
// texts in quiet hours, and allergy answers that must come from the owner.

/** When and for whom a card would be sent. */
export interface SendContext {
  readonly now: Date;
  /** IANA time zone of the business, such as "America/New_York". */
  readonly timeZone: string;
  /** Whether the recipient has a consent record for texts. */
  readonly hasConsent: boolean;
}

/** The executor's answer: send, or the owner-facing reason it won't. */
export type SendCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

// Texts wait from 8 p.m. until 8 a.m. local time.
const QUIET_FROM_HOUR = 20;
const QUIET_UNTIL_HOUR = 8;

// Catches allergy, allergies, allergic, allergen and allergens.
const ALLERGY_WORDS = /allerg/i;

/** Decide whether an approved card may be sent now. Throws `RangeError` for an unknown `timeZone`. */
export function checkSend(card: CardDraft, ctx: SendContext): SendCheck {
  if (card.channel === "locked") return refuse("This thread is locked. Reply to the customer yourself.");
  // A list card only updates the owner's own lists, so no customer rule applies.
  if (card.channel === "list") return { ok: true };
  // Content rules come first: waiting for morning or consent wouldn't make this card safe.
  if (ALLERGY_WORDS.test(card.body)) {
    return refuse("Allergy answers must come from you. Anchored won't send one.");
  }
  if (card.channel === "email") return { ok: true };
  if (!ctx.hasConsent) return refuse("No consent on file: texts need the customer's OK first.");
  const hour = localHour(ctx.now, ctx.timeZone);
  if (hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR) return refuse("Quiet hours: texts wait until 8 a.m.");
  return { ok: true };
}

function refuse(reason: string): SendCheck {
  return { ok: false, reason };
}

/** The hour, 0 to 23, on the wall clock in `timeZone` at `now`. */
function localHour(now: Date, timeZone: string): number {
  // `h23` keeps midnight at 0; some engines print it as 24 under `hour12: false`.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour");
  if (hour === undefined) throw new Error(`\`Intl.DateTimeFormat\` gave no hour for time zone ${timeZone}.`);
  return Number(hour.value);
}
