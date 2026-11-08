import { FIELD_KEYS, FIELDS, fieldsFor, isFilled } from "@/lib/domain/fields";
import type { CoreAgentId, FieldEvidence, FieldKey, NextStep, PriceItem, ProfileDetails, SourceType, TradeKey, Vocabulary } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Profile details as pure functions. `parseDetail` reads one field from words,
// the owner's or a source's, and `candidatesFrom` reads every field it can.
// `mergeCandidate` folds a candidate in by source precedence (owner, then a
// document, then the listing or website, then reviews, then confidence) and
// keeps a disagreeing source as a conflict instead of dropping it.
// `detailText` prints a value; `looksLikeSessionNotes` keeps coaching notes out.

/** How sure a source is of a value. */
export type Confidence = FieldEvidence["confidence"];

/** One value a source offers for one field, with the words it came from. */
export type DetailCandidate = {
  [K in FieldKey]: { readonly key: K; readonly value: NonNullable<ProfileDetails[K]> };
}[FieldKey] & {
  readonly sourceType: SourceType;
  readonly quote: string;
  readonly confidence: Confidence;
};

/** A business's details with the evidence behind each. */
export interface DetailState {
  readonly details: ProfileDetails;
  readonly evidence: Readonly<Partial<Record<FieldKey, FieldEvidence>>>;
}

/** An empty state, for a draft or a business with no details yet. */
export const NO_DETAILS: DetailState = { details: {}, evidence: {} };

// =============================================================================
// Precedence and merging
// =============================================================================

// Lower is stronger. The listing and the website share a tier: both are what the business says in public.
const SOURCE_RANK: Readonly<Record<SourceType, number>> = { owner: 0, document: 1, listing: 2, website: 2, reviews: 3 };
const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = { high: 0, medium: 1, low: 2 };

/** Where a value came from, as the owner reads it in a sentence: "Your website says ...". */
export const SOURCE_LABEL: Readonly<Record<SourceType, string>> = {
  owner: "You said",
  document: "Your document says",
  listing: "Your Google listing says",
  website: "Your website says",
  reviews: "Your reviews say",
};

/** Where a value came from, as a short line under it: "From your Google listing". */
export const SOURCE_NAME: Readonly<Record<SourceType, string>> = {
  owner: "From you",
  document: "From your document",
  listing: "From your Google listing",
  website: "From your website",
  reviews: "From your reviews",
};

/** Whether evidence `a` outranks `b`. A tie goes to `a`, the newer of the two, so an owner's correction wins. */
function outranks(a: Pick<FieldEvidence, "sourceType" | "confidence">, b: Pick<FieldEvidence, "sourceType" | "confidence">): boolean {
  const bySource = SOURCE_RANK[a.sourceType] - SOURCE_RANK[b.sourceType];
  if (bySource !== 0) return bySource < 0;
  return CONFIDENCE_RANK[a.confidence] <= CONFIDENCE_RANK[b.confidence];
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Fold one candidate into `state`. A disagreeing source is kept as a conflict for the owner to settle, never dropped. */
export function mergeCandidate(state: DetailState, candidate: DetailCandidate): DetailState {
  const { key } = candidate;
  const current: unknown = state.details[key];
  const evidence = state.evidence[key];
  const fresh: FieldEvidence = { sourceType: candidate.sourceType, quote: candidate.quote, confidence: candidate.confidence, ownerConfirmed: false };
  const write = (value: unknown, next: FieldEvidence): DetailState => ({
    details: { ...state.details, [key]: value },
    evidence: { ...state.evidence, [key]: next },
  });

  if (current === undefined || evidence === undefined) return write(candidate.value, fresh);
  if (sameValue(current, candidate.value)) {
    // Agreement: keep whichever evidence is stronger, and the conflicts already found.
    return outranks(fresh, evidence) ? write(current, { ...fresh, ownerConfirmed: evidence.ownerConfirmed, ...withConflicts(evidence.conflicts) }) : state;
  }
  // One source changing its own answer is a correction, not a conflict.
  const sameSource = fresh.sourceType === evidence.sourceType;
  if (outranks(fresh, evidence)) {
    const loser = sameSource ? [] : [{ value: detailText(key, current), sourceType: evidence.sourceType, quote: evidence.quote }];
    return write(candidate.value, { ...fresh, ...withConflicts([...loser, ...(evidence.conflicts ?? [])]) });
  }
  if (sameSource) return state;
  const conflict = { value: detailText(key, candidate.value), sourceType: candidate.sourceType, quote: candidate.quote };
  const known = (evidence.conflicts ?? []).some((c) => c.sourceType === conflict.sourceType && c.value === conflict.value);
  return known ? state : write(current, { ...evidence, conflicts: [...(evidence.conflicts ?? []), conflict] });
}

function withConflicts(conflicts: FieldEvidence["conflicts"]): Pick<FieldEvidence, "conflicts"> {
  return conflicts && conflicts.length > 0 ? { conflicts } : {};
}

/** Fold every candidate into `state`, in order. */
export function mergeCandidates(state: DetailState, candidates: readonly DetailCandidate[]): DetailState {
  return candidates.reduce(mergeCandidate, state);
}

/** Mark every detail the owner has seen and accepted as confirmed, which makes it theirs. */
export function confirmAll(state: DetailState): DetailState {
  const evidence: Partial<Record<FieldKey, FieldEvidence>> = {};
  for (const key of FIELD_KEYS) {
    const found = state.evidence[key];
    if (found) evidence[key] = { ...found, ownerConfirmed: true };
  }
  return { details: state.details, evidence };
}

/** Whether a detail still needs the owner: missing, or only a low-confidence guess they haven't confirmed. */
export function needsOwner(state: Partial<DetailState>, key: FieldKey): boolean {
  if (!isFilled(state.details, key)) return true;
  const found = state.evidence?.[key];
  return found !== undefined && found.confidence === "low" && !found.ownerConfirmed;
}

/** Must fields the given agents still need from the owner, most-needed first, then in registry order. */
export function gapsFor(state: Partial<DetailState>, agents: readonly CoreAgentId[]): FieldKey[] {
  const counts = new Map<FieldKey, number>();
  for (const agent of agents) {
    for (const key of fieldsFor(agent, "must", { details: state.details })) {
      if (needsOwner(state, key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || FIELD_KEYS.indexOf(a) - FIELD_KEYS.indexOf(b));
}

/** How ready one agent is: must fields filled over required, and the first one still missing. */
export interface Readiness {
  readonly filled: number;
  readonly required: number;
  readonly next: FieldKey | null;
}

/** Count one agent's must fields that the owner has filled or confirmed. */
export function readinessFor(state: Partial<DetailState>, agent: CoreAgentId): Readiness {
  const required = fieldsFor(agent, "must", { details: state.details });
  const missing = required.filter((key) => needsOwner(state, key));
  return { filled: required.length - missing.length, required: required.length, next: missing[0] ?? null };
}

/** The sentence that names a field's conflict, such as "Your website says until 6. You said 8. Which is right?" */
export function conflictLine(key: FieldKey, state: Partial<DetailState>): string | null {
  const found = state.evidence?.[key];
  const other = found?.conflicts?.[0];
  const value = state.details?.[key];
  if (!found || !other || value === undefined) return null;
  return `${SOURCE_LABEL[other.sourceType]} ${other.value}. ${SOURCE_LABEL[found.sourceType]} ${detailText(key, value)}. Which is right?`;
}

// =============================================================================
// Printing a value
// =============================================================================

const STEP_TEXT: Readonly<Record<NextStep["step"], string>> = {
  book_call: "book a call",
  send_estimate: "send an estimate",
  book_visit: "book a visit",
  other: "something else",
};

const METHOD_TEXT: Readonly<Record<NonNullable<ProfileDetails["pricingMethod"]>, string>> = {
  menu: "set prices",
  hourly: "by the hour",
  quote: "a quote for each request",
  packages: "packages",
};

/** Dollars as the owner writes them: "$40", "$1,250", "$89.50". */
export function money(amount: number): string {
  const cents = Math.round(amount * 100) % 100 !== 0;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** One price line: "Tune-up $129" or "Install $1,200 to $1,800". */
export function priceText(item: PriceItem): string {
  const amount = item.high === undefined || item.high === item.low ? money(item.low) : `${money(item.low)} to ${money(item.high)}`;
  return item.item === "" ? amount : `${item.item} ${amount}`;
}

/** A detail's value as one line the owner reads. */
export function detailText(key: FieldKey, value: unknown): string {
  switch (key) {
    case "vocabulary": {
      const v = value as Vocabulary;
      return `customers are "${v.customer}", the work is "${v.workUnit}", a price is "${v.priceTerm}", a booking is "${v.bookingTerm}"`;
    }
    case "pricingMethod":
      return METHOD_TEXT[value as keyof typeof METHOD_TEXT] ?? String(value);
    case "prices":
      return (value as readonly PriceItem[]).map(priceText).join(", ");
    case "minimumCharge":
      return (value as number) === 0 ? "No minimum" : money(value as number);
    case "nextStep": {
      const v = value as NextStep;
      return v.lead === "" ? STEP_TEXT[v.step] : `${v.lead}: ${STEP_TEXT[v.step]}`;
    }
    case "faqs":
      return (value as ProfileDetails["faqs"] & object).map((faq) => `${faq.q} ${faq.a}`).join(" ");
    case "examples":
      return (value as ProfileDetails["examples"] & object).map((example) => example.text).join(" / ");
    case "priceDrivers":
    case "urgentCriteria":
    case "promoteFocus":
      return (value as readonly string[]).join(", ");
    default:
      return String(value);
  }
}

// =============================================================================
// Reading a value from words
// =============================================================================

// "$40", "$1,250", "$89.50", "40 dollars".
const AMOUNT = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*dollars?\b/gi;
// An amount or a range of two, as in "$129" or "$1,200 to $1,800".
const PRICE_RANGE = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)(?:\s*(?:to|-|and)\s*\$?\s?(\d[\d,]*(?:\.\d{1,2})?))?/;
const MINIMUM = /\bminimum(?:\s+(?:charge|fee|order|job|is|of|now))*\s*\$\s?(\d[\d,]*(?:\.\d{1,2})?)/i;
const NO_MINIMUM = /\b(?:no minimum|none|nope|no)\b/i;
const URL = /https?:\/\/[^\s<>"]+/i;

function toNumber(text: string): number {
  return Number(text.replace(/,/g, ""));
}

/** Split a list the owner typed: commas, semicolons, "and", "or" and new lines all separate items. */
export function splitList(text: string): string[] {
  return text
    .split(/[,;\n]|\s+(?:and|or)\s+/i)
    .map((part) => part.replace(/^\s*(?:and|or|like|such as|e\.g\.)\s+/i, "").replace(/[.!]+$/, "").trim())
    .filter((part) => part !== "" && part.length <= 80)
    .slice(0, 8);
}

/** Every price line in `text`, one per clause: "Tune-up $129, installs $1,200 to $1,800". A line with no item name keeps an empty one. */
export function parsePrices(text: string): PriceItem[] {
  const items: PriceItem[] = [];
  // A comma inside "$1,200" isn't a clause break, so only a comma before a space splits.
  for (const clause of text.split(/,\s+|[;\n]|\s+and\s+(?=[A-Za-z])/)) {
    const match = PRICE_RANGE.exec(clause);
    if (!match) continue;
    const low = toNumber(match[1] ?? "");
    const high = match[2] === undefined ? undefined : toNumber(match[2]);
    if (!Number.isFinite(low)) continue;
    const item = clause
      .slice(0, match.index)
      .replace(/\b(?:is|are|for|costs?|runs?|run|about|around|usually|from|starts? at|starting at)\b/gi, " ")
      .replace(/^\s*(?:(?:and|a|an|the|our)\s+)+/i, "")
      .replace(/\s+(?:at|of|per|by)\s*$/i, "")
      .replace(/[:=]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    items.push(high !== undefined && Number.isFinite(high) && high > low ? { item, low, high } : { item, low });
  }
  return items.slice(0, 12);
}

/** Every dollar amount `text` names, in order. */
export function amountsIn(text: string): number[] {
  return [...text.matchAll(AMOUNT)].map((match) => toNumber(match[1] ?? match[2] ?? "")).filter(Number.isFinite);
}

function readPricingMethod(text: string): ProfileDetails["pricingMethod"] {
  if (/\b(?:quotes?|estimates?|bids?|depends on the job|varies|it depends)\b/i.test(text)) return "quote";
  if (/\b(?:hourly|per hour|an hour|\/\s?hr|by the hour)\b/i.test(text)) return "hourly";
  if (/\bpackages?\b|\bbundles?\b/i.test(text)) return "packages";
  if (/\b(?:menu|set prices?|fixed prices?|price list)\b/i.test(text)) return "menu";
  return undefined;
}

function readNextStep(text: string): NextStep | undefined {
  const step: NextStep["step"] | undefined = /\bcall\b/i.test(text)
    ? "book_call"
    : /\b(?:estimate|quote)\b/i.test(text)
      ? "send_estimate"
      : /\b(?:visit|come out|stop by|appointment)\b/i.test(text)
        ? "book_visit"
        : undefined;
  return step === undefined ? undefined : { lead: "", step };
}

/** Singular, lower-case, no article: "Homeowners" reads "homeowner", "a service call" reads "service call". */
function term(text: string): string {
  const bare = text.trim().replace(/^(?:a|an|the|our|my)\s+/i, "").replace(/[.!?]+$/, "").toLowerCase();
  return bare.length > 3 && bare.endsWith("s") && !bare.endsWith("ss") ? bare.slice(0, -1) : bare;
}

// Words that make a part a sentence, not a term: "mostly", "but we call", "not a visit".
const NOT_A_TERM = /\b(?:yes|no|not|mostly|but|we|i|our|is|are|it|that|this|right|wrong|actually|instead|really|some|just)\b/i;

/** A clean list of terms, read by position: "homeowners / service call / estimate / visit". Anything sentence-like reads nothing. */
function readVocabulary(text: string): Vocabulary | undefined {
  const raw = text.split(/\s*\/\s*|,\s*(?:and\s+)?|\s+and\s+/i).filter((part) => part.trim() !== "");
  if (raw.some((part) => NOT_A_TERM.test(part) || part.trim().split(/\s+/).length > 3)) return undefined;
  const parts = raw.map(term).filter((part) => part !== "" && part.length <= 40);
  const [customer, workUnit, priceTerm, bookingTerm] = parts;
  if (customer === undefined || workUnit === undefined) return undefined;
  return { customer, workUnit, priceTerm: priceTerm ?? "price", bookingTerm: bookingTerm ?? "booking" };
}

// The words an owner uses to name each term when correcting it.
const ROLE_WORDS: Readonly<Record<keyof Vocabulary, string>> = {
  customer: "customers?|clients?|guests?",
  workUnit: "work|jobs?|orders?",
  priceTerm: "prices?|costs?",
  bookingTerm: "bookings?|appointments?|reservations?",
};

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Apply a correction to the words already held: "we call a booking a service call" changes only the booking term.
 * A clean list replaces them all. Returns `undefined` when no term can be mapped, so the old words stay.
 */
export function correctVocabulary(current: Vocabulary, text: string): Vocabulary | undefined {
  const clean = text.replace(/\s+/g, " ").trim();
  const list = readVocabulary(clean);
  if (list !== undefined) return list;
  const end = "(?=\\s*[,.;!?]|\\s+(?:not|instead|and|but|rather)\\b|$)";
  const next: Record<keyof Vocabulary, string> = { ...current };
  let changed = false;
  for (const role of Object.keys(ROLE_WORDS) as (keyof Vocabulary)[]) {
    const names = `(?:${ROLE_WORDS[role]}|${escaped(current[role])}s?)`;
    const patterns = [
      new RegExp(`\\bcall\\s+(?:(?:a|an|the|our)\\s+)?${names}\\s+(?:(?:a|an)\\s+)?([a-z][a-z' -]{1,30}?)${end}`, "i"),
      new RegExp(`\\b${names}\\s+(?:is|are)\\s+(?:called\\s+)?(?:(?:a|an)\\s+)?([a-z][a-z' -]{1,30}?)${end}`, "i"),
    ];
    const found = patterns.map((pattern) => pattern.exec(clean)?.[1]).find((value) => value !== undefined);
    if (found === undefined) continue;
    const word = term(found);
    if (word === "" || NOT_A_TERM.test(word)) continue;
    next[role] = word;
    changed = true;
  }
  return changed ? next : undefined;
}

/** Read one field's value from words, or `undefined` when the words don't give one. */
export function parseDetail<K extends FieldKey>(key: K, text: string): ProfileDetails[K] | undefined {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean === "") return undefined;
  const read = ((): unknown => {
    switch (key) {
      case "ownerName": {
        const name = /(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-zA-Z'-]{1,29})/i.exec(clean)?.[1] ?? /^([A-Z][a-zA-Z'-]{1,29})$/.exec(clean)?.[1];
        return name === undefined ? undefined : name[0]?.toUpperCase() + name.slice(1);
      }
      case "vocabulary":
        return readVocabulary(clean);
      case "hours":
        return clean.length <= 160 ? clean.replace(/[.]+$/, "") : undefined;
      case "pricingMethod":
        return readPricingMethod(clean);
      case "prices": {
        const prices = parsePrices(clean);
        return prices.length > 0 ? prices : undefined;
      }
      case "minimumCharge": {
        const stated = MINIMUM.exec(clean)?.[1];
        if (stated !== undefined) return toNumber(stated);
        const [only] = amountsIn(clean);
        if (only !== undefined) return only;
        return NO_MINIMUM.test(clean) ? 0 : undefined;
      }
      case "priceDrivers":
      case "urgentCriteria":
      case "promoteFocus": {
        const items = splitList(clean);
        return items.length > 0 ? items : undefined;
      }
      case "faqs": {
        const pairs = [...clean.matchAll(/([^?]{3,140}\?)\s*([^?]{1,240}?)(?=\s+[A-Z][^?]{2,140}\?|$)/g)].map((m) => ({ q: (m[1] ?? "").trim(), a: (m[2] ?? "").trim() }));
        return pairs.filter((pair) => pair.a !== "").slice(0, 8);
      }
      case "nextStep":
        return readNextStep(clean);
      case "reminderFirmness":
        return /\bfirm\b/i.test(clean) ? "firm" : /\bgentle\b|\bsoft\b|\bfriendly\b/i.test(clean) ? "gentle" : /\bstandard\b|\bnormal\b|\bregular\b/i.test(clean) ? "standard" : undefined;
      case "reviewLink":
        return URL.exec(clean)?.[0];
      case "examples":
        return clean.length >= 12 ? [{ kind: "message", text: clean.slice(0, 600) }] : undefined;
    }
  })();
  if (read === undefined || (Array.isArray(read) && read.length === 0)) return undefined;
  return read as ProfileDetails[K];
}

// Words that look like a name in a greeting but aren't the owner's.
const NOT_A_NAME = /^(?:Hi|Hey|Hello|Thanks|Thank|Dear|Mr|Mrs|Ms|Dr|Good|See|We|I|The|Our|Sorry|Sure|Yes|No)$/;

/** The owner's first name from a reply they sent, when they sign it: "Mike from Brightwater here", "Thanks, Dana". */
export function nameFromSample(text: string): string | undefined {
  const clean = text.replace(/\s+/g, " ").trim();
  const found = [
    /\b([A-Z][a-z'-]{1,29}) (?:from|at|with|over at|here at) [A-Z]/.exec(clean)?.[1],
    /\b(?:thanks|thank you|cheers|best|regards|talk soon|see you soon)[,!.]?\s+([A-Z][a-z'-]{1,29})[.!]?$/i.exec(clean)?.[1],
    /(?:^|\s)[-~]\s*([A-Z][a-z'-]{1,29})[.!]?$/.exec(clean)?.[1],
    /(?:my name is|i'm|i am|this is) ([A-Z][a-z'-]{1,29})\b/.exec(clean)?.[1],
  ].find((name) => name !== undefined && !NOT_A_NAME.test(name));
  return found;
}

/** A candidate for `key` read from `text`, or `null`. The quote is the whole text, cut to a readable length. */
export function candidateFor(key: FieldKey, text: string, sourceType: SourceType, confidence: Confidence): DetailCandidate | null {
  const value = parseDetail(key, text);
  if (value === undefined) return null;
  return { key, value, sourceType, quote: text.replace(/\s+/g, " ").trim().slice(0, 240), confidence } as DetailCandidate;
}

/** Candidates the rules find in a free-text answer about what a business sells: how it prices, prices and a minimum. */
export function candidatesFromSales(text: string, sourceType: SourceType): DetailCandidate[] {
  const keys: readonly FieldKey[] = ["pricingMethod", "prices"];
  const found = keys.flatMap((key) => candidateFor(key, text, sourceType, "medium") ?? []);
  const minimum = MINIMUM.exec(text);
  if (minimum?.[1] !== undefined) found.push({ key: "minimumCharge", value: toNumber(minimum[1]), sourceType, quote: minimum[0], confidence: "medium" });
  return found;
}

// =============================================================================
// Suggested words for a kind of business
// =============================================================================

// Usual words for each kind of business. Shown only as a suggestion the owner confirms, quoting what they said.
const TRADE_VOCABULARY: Readonly<Partial<Record<TradeKey, Vocabulary>>> = {
  home: { customer: "customer", workUnit: "job", priceTerm: "estimate", bookingTerm: "visit" },
  restaurant: { customer: "guest", workUnit: "order", priceTerm: "price", bookingTerm: "reservation" },
  store: { customer: "customer", workUnit: "order", priceTerm: "price", bookingTerm: "pickup" },
  coach: { customer: "client", workUnit: "session", priceTerm: "rate", bookingTerm: "session" },
};

// Only a sit-down place has guests and reservations. A bakery, cafe or food truck takes orders.
const SIT_DOWN = /\b(?:restaurants?|diners?|bistros?|dining|steakhouse|trattoria|grill)\b/i;
const TAKEOUT_VOCABULARY: Vocabulary = { customer: "customer", workUnit: "order", priceTerm: "price", bookingTerm: "order" };

/** A low-confidence vocabulary guess from the kind of business the owner named, or `null` for a kind with no usual words. */
export function vocabularyGuess(tradeKey: TradeKey, kindAnswer: string): DetailCandidate | null {
  const value = tradeKey === "restaurant" && !SIT_DOWN.test(kindAnswer) ? TAKEOUT_VOCABULARY : TRADE_VOCABULARY[tradeKey];
  return value ? { key: "vocabulary", value, sourceType: "owner", quote: kindAnswer.slice(0, 120), confidence: "low" } : null;
}

// =============================================================================
// Coaching notes
// =============================================================================

// Signs that text is a record of a session or a call, which Anchored never reads for facts.
const SESSION_NOTE_PATTERNS: readonly RegExp[] = [
  /\b(?:session|progress|case|therapy|counseling|coaching)\s+notes?\b/i,
  /\b(?:presenting (?:issue|problem)|treatment plan|diagnos(?:is|ed)|intake assessment|soap note)\b/i,
  /^\s*(?:speaker\s*\d+|client|coach|therapist)\s*:/im,
  /\b\d{1,2}:\d{2}:\d{2}\b/,
  /\b(?:client|patient) (?:said|reported|shared|disclosed|expressed)\b/i,
];

/** Whether `text` reads like notes from a session or a call transcript, so extraction skips it. */
export function looksLikeSessionNotes(text: string): boolean {
  return SESSION_NOTE_PATTERNS.filter((pattern) => pattern.test(text)).length >= 1;
}

/** Field keys a source may fill, in registry order. Every field is fair game except the owner's own past writing. */
export const EXTRACTABLE: readonly FieldKey[] = FIELD_KEYS.filter((key) => key !== "examples");

/** The registry label for a field, for prompts and summaries. */
export function fieldLabel(key: FieldKey): string {
  return FIELDS[key].label;
}
