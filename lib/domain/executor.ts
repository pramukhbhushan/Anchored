import type { CardDraft } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The rules plain code enforces before anything reaches a customer.
// `checkSend` runs after the owner taps Approve and refuses a card that breaks
// a rule, whatever the model drafted: locked threads, allergy talk, unfilled
// `[placeholders]`, texts without `OPT_OUT_LINE`, consent, or in quiet hours.

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

/** The line every text must end with, so the customer can always opt out. */
export const OPT_OUT_LINE = "Reply STOP to opt out.";

// Texts wait from 8 p.m. until 8 a.m. local time.
const QUIET_FROM_HOUR = 20;
const QUIET_UNTIL_HOUR = 8;

// The opt-out line in any case, with or without its period, so `ensureOptOut` can move it instead of adding a second.
const OPT_OUT_PHRASE = /\s*reply\s+stop\s+to\s+opt\s+out\.?/gi;

// A square-bracketed blank such as "[your review link]" that a draft left for the owner to fill.
const PLACEHOLDER = /\[[^[\]\r\n]*\]/;

// =============================================================================
// The send check
// =============================================================================

/** Decide whether an approved card may be sent now. Throws `RangeError` for an unknown `timeZone`. */
export function checkSend(card: CardDraft, ctx: SendContext): SendCheck {
  if (card.channel === "locked") return refuse("This thread is locked. Reply to the customer yourself.");
  // A list card only updates the owner's own lists, so no customer rule applies.
  if (card.channel === "list") return { ok: true };
  // Content rules come first: waiting for morning or consent wouldn't make this card safe.
  if (mentionsAllergen(card.body)) {
    return refuse("This mentions an allergen. Allergy answers must come from you, so Anchored won't send it.");
  }
  const placeholder = findPlaceholder(card.body);
  if (placeholder !== null) return refuse(`Fill in ${placeholder} before sending.`);
  if (card.channel === "email") return { ok: true };
  if (!card.body.trimEnd().endsWith(OPT_OUT_LINE)) {
    return refuse(`Texts must end with "${OPT_OUT_LINE}" Add it, then approve again.`);
  }
  if (!ctx.hasConsent) return refuse("No consent on file: texts need the customer's OK first.");
  const hour = localHour(ctx.now, ctx.timeZone);
  if (hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR) return refuse("Quiet hours: texts wait until 8 a.m.");
  return { ok: true };
}

/** `body` ending in exactly one `OPT_OUT_LINE`: added when missing, moved to the end when it sits elsewhere. */
export function ensureOptOut(body: string): string {
  if (body.trimEnd().endsWith(OPT_OUT_LINE)) return body;
  const rest = body.replace(OPT_OUT_PHRASE, "").trim();
  return rest === "" ? OPT_OUT_LINE : `${rest} ${OPT_OUT_LINE}`;
}

/** The first square-bracketed blank in `body`, such as "[your review link]", or `null` when there is none. */
export function findPlaceholder(body: string): string | null {
  return body.match(PLACEHOLDER)?.[0] ?? null;
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

// =============================================================================
// Allergy lock
// =============================================================================

// Terms run against folded text: lower case, no accents, so "Alérgico" reads "alergico".
// The list errs toward blocking, since a false alarm only costs the owner one reply typed by hand.
// Soy appears only as a food phrase: a bare "soy" is Spanish for "I am" and would block "Hola, soy Dana".
const ALLERGEN_PATTERNS: readonly RegExp[] = [
  // English
  /allerg|anaphyla|epi[\s\p{Pd}]*pen|peanut|tree[\s\p{Pd}]*nut|nut[\s\p{Pd}]*free|sesame|gluten|co?eliac/u,
  /dairy[\s\p{Pd}]*free|lactos|shellfish|soy[\s\p{Pd}]*free|\bsoya\b|soybean|contains?\s+soy|\bsoy\s+(sauce|milk|lecithin)|egg[\s\p{Pd}]*free|wheat/u,
  // Spanish
  /alerg|anafila|cacahu[ae]te|\bmani(e?s)?\b|marisco|\bsoja\b|sesamo|ajonjoli|frutos\s+secos|\bnue(z|ces)\b/u,
  /sin\s+lacteos|sin\s+huevos?|\btrigo\b/u,
  // Korean: allergy (formal and spoken), peanut, tree nut. Chinese: allergy, peanut, tree nut, simplified and traditional.
  /알레르기|알러지|땅콩|견과|过敏|過敏|花生|坚果|堅果/u,
];

// Cyrillic and Greek letters drawn like Latin ones. Keys are escapes because the literal letters look
// identical to their values. Capitals are listed apart from small letters because some differ once
// lower-cased: Greek capital nu reads as "N", but its small form looks like "v".
const LOOKALIKES: Readonly<Record<string, string>> = {
  // Cyrillic capitals
  "Ѕ": "S", "І": "I", "Ј": "J", "А": "A", "В": "B", "Е": "E", "К": "K",
  "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "У": "Y",
  "Х": "X", "Ү": "Y", "Һ": "H", "Ӏ": "l", "Ԁ": "D", "Ԛ": "Q", "Ԝ": "W",
  // Cyrillic small letters
  "а": "a", "в": "b", "е": "e", "к": "k", "м": "m", "н": "h", "о": "o",
  "р": "p", "с": "c", "т": "t", "у": "y", "х": "x", "ѕ": "s", "і": "i",
  "ј": "j", "ү": "y", "һ": "h", "ӏ": "l", "ԁ": "d", "ԛ": "q", "ԝ": "w",
  // Greek capitals
  "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K",
  "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X",
  // Greek small letters
  "α": "a", "γ": "y", "ε": "e", "η": "n", "ι": "i", "κ": "k", "μ": "u",
  "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x", "ω": "w",
};

/** Whether `text` mentions an allergy or a common allergen in English, Spanish, Korean or Chinese. Errs toward yes. */
export function mentionsAllergen(text: string): boolean {
  const folded = foldForMatching(text);
  return ALLERGEN_PATTERNS.some((pattern) => pattern.test(folded));
}

/** `text` with fullwidth forms, accents, zero-width characters and look-alike letters folded to plain lower case. */
function foldForMatching(text: string): string {
  // NFKD then NFC is NFKC with the accent marks dropped in between. NFC also rebuilds the Hangul
  // syllables NFKD splits into jamo, so the Korean terms still match. `Cf` covers zero-width characters.
  const unmarked = text.normalize("NFKD").replace(/[\p{M}\p{Cf}]/gu, "");
  // Fold before lower-casing, so each capital maps by its own shape.
  const latin = Array.from(unmarked, (char) => LOOKALIKES[char] ?? char).join("");
  return latin.toLowerCase().normalize("NFC");
}
