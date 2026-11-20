import {
  candidateFor,
  candidatesFromSales,
  correctVocabulary,
  nameFromSample,
  confirmAll,
  conflictLine,
  detailText,
  gapsFor,
  introducedName,
  mergeCandidate,
  mergeCandidates,
  NO_DETAILS,
  SOURCE_NAME,
  vocabularyGuess,
  type DetailCandidate,
  type DetailState,
} from "@/lib/domain/details";
import { detectTradeKey, hintFor, planWorkflows, profileFromAnswers, profileFromFacts, TRADE_HINTS } from "@/lib/domain/engine";
import { FIELD_KEYS, FIELDS, isFilled } from "@/lib/domain/fields";
import { sheetIdFromText } from "@/lib/domain/invoice-sheet";
import { activeAgents } from "@/lib/domain/paths";
import type {
  BusinessFacts,
  BusinessProfile,
  CoreAgentId,
  FieldEvidence,
  FieldKey,
  OnboardingAnswers,
  ProfileDetails,
  SignalId,
  TradeKey,
  WorkflowId,
  WorkflowPlan,
} from "@/lib/domain/types";
import { LANGUAGE_OPTIONS, NOT_GIVEN, PATH_OUTCOME, REACH_OPTIONS, SIGNALS, TOOL_OPTIONS, WORKFLOW_IDS, WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Chat onboarding and chat updates as pure functions. An `IntakeDraft` holds the
// facts gathered so far; `nextQuestion` picks what to ask, `applyAnswer` reads an
// answer with keyword rules, and `draftToAnswers` hands the result to the engine.
// `readChanges` and `applyChanges` do the same for a running business's chat.
// After the planned questions, the owner may pick their Google listing and
// answer up to `MAX_GAPS` gap questions: the must fields their agents still
// lack, asked plainly, with a suggestion only when a source gave one.

// =============================================================================
// Types
// =============================================================================

/** A planned onboarding question, in asking order. */
export type IntakeField = "name" | "kind" | "what" | "reach" | "tools" | "signals" | "languages" | "week" | "voice";

/** A gap question for one profile detail, such as `gap:prices`. */
export type GapStep = `gap:${FieldKey}`;

/**
 * Where an intake stands: a planned question, picking a Google listing, a gap question, the closing confirm step,
 * or choosing what to change.
 */
/** `sheet` asks for the invoice spreadsheet, only when the owner uses Google Sheets and Bookkeeping is in the plan. */
export type IntakeStep = IntakeField | "listing" | GapStep | "sheet" | "confirm" | "change";

/** One "Is this you?" match from Google Places. */
export interface ListingChoice {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly rating?: number;
}

/** A multiple-choice fact. Values come from the option lists in `workflows.ts`. */
export type ListKey = "reach" | "tools" | "signals" | "languages";

/** A free-text fact. `place` has no question of its own; it rides on the name answer. */
export type TextKey = "name" | "place" | "kind" | "what" | "week" | "voice";

/** The four multiple-choice facts. */
export interface FactLists {
  readonly reach: readonly string[];
  readonly tools: readonly string[];
  readonly signals: readonly SignalId[];
  readonly languages: readonly string[];
}

/** What Anchored knows about a business. A missing text key means the owner hasn't said it. */
export interface IntakeFacts extends FactLists {
  readonly name?: string;
  readonly place?: string;
  readonly kind?: string;
  readonly what?: string;
  readonly week?: string;
  readonly voice?: string;
}

/** The closing review: still asking, picking a part to change, re-asking one part, or confirmed. */
export type IntakeReview =
  | { readonly stage: "asking" }
  | { readonly stage: "choosing" }
  | { readonly stage: "revisiting"; readonly field: IntakeField | GapStep }
  | { readonly stage: "confirmed" };

/** A follow-up question waiting for its answer. It comes before the next planned question. */
export interface FollowUp {
  readonly field: IntakeField;
  readonly text: string;
}

/** An onboarding conversation's state: the facts so far and where the questions stand. */
export interface IntakeDraft {
  readonly facts: IntakeFacts;
  /** Planned questions the owner has answered or skipped. */
  readonly settled: readonly IntakeField[];
  readonly followUp: FollowUp | null;
  /** Follow-ups asked so far, by the rules or the model. Capped at `MAX_FOLLOW_UPS`. */
  readonly followUps: number;
  readonly review: IntakeReview;
  /** Lists the owner answered with none, so the summary says "None" rather than "Skipped". Absent in older drafts. */
  readonly answeredNone?: readonly ListKey[];
  /** Profile details found so far, from the owner's answers and any listing or website. */
  readonly details?: ProfileDetails;
  readonly evidence?: Readonly<Partial<Record<FieldKey, FieldEvidence>>>;
  /** The Google Places id the owner picked. */
  readonly placeId?: string;
  /** Google's matches for the name and town, once looked up. `settled` once the owner picked one or said none. */
  readonly listing?: { readonly choices: readonly ListingChoice[]; readonly settled: boolean };
  /** Gap questions asked so far, answered or skipped. */
  readonly gaps?: readonly FieldKey[];
  /** Gap questions asked a second time because the first typed answer couldn't be read. Each gets one retry. */
  readonly gapRetries?: readonly FieldKey[];
  /** The invoice sheet question, once asked: the sheet's ID from the link the owner pasted, or `null` when they skipped it. */
  readonly invoiceSheet?: { readonly id: string | null };
}

/** One quick-reply chip. `suggested` marks options common for this kind of business; it never selects one. */
export interface IntakeOption {
  readonly value: string;
  readonly label: string;
  readonly selected: boolean;
  readonly suggested: boolean;
}

/** The question Anchored asks next, with chips when it has a fixed set of answers. */
export interface IntakeQuestion {
  readonly field: IntakeStep;
  readonly text: string;
  readonly options?: readonly IntakeOption[];
  readonly multi: boolean;
}

/** An owner's answer: typed text, tapped chips, or both. For a multi-select question, `picks` is the full selection. */
export interface IntakeAnswer {
  readonly text?: string;
  readonly picks?: readonly string[];
}

/** What one typed answer says. `dropped` holds values the owner ruled out, as in "we don't take EBT". */
export interface AnswerReading {
  readonly intent: "answer" | "skip" | "none";
  /** The answer with whitespace and smart quotes normalized. */
  readonly text: string;
  readonly facts: IntakeFacts;
  readonly dropped: FactLists;
}

/** One line of the "What Anchored knows" card: a planned question's answer, or a profile detail. */
export interface KnownFact {
  readonly field: IntakeField | FieldKey;
  readonly label: string;
  readonly value: string | null;
  readonly state: "known" | "skipped" | "open";
  /** Where a detail came from, such as "From your Google listing". */
  readonly source?: string;
  /** A source that disagrees, as a question for the owner. */
  readonly conflict?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Every planned question in asking order. */
export const INTAKE_FIELDS: readonly IntakeField[] = ["name", "kind", "what", "reach", "tools", "signals", "languages", "week", "voice"];

/** Most follow-ups one intake asks beyond its plan. */
export const MAX_FOLLOW_UPS = 2;

/** Most gap questions one intake asks. Anything still missing shows on the profile instead. */
export const MAX_GAPS = 3;

const LIST_KEYS: readonly ListKey[] = ["reach", "tools", "signals", "languages"];
const TEXT_KEYS: readonly TextKey[] = ["name", "place", "kind", "what", "week", "voice"];
const NO_LISTS: FactLists = { reach: [], tools: [], signals: [], languages: [] };

// Caps match `onboardingAnswersSchema`: name, comma and town fit its 120 characters.
const TEXT_LIMITS: Readonly<Record<TextKey, number>> = { name: 78, place: 40, kind: 80, what: 1500, week: 1500, voice: 600 };

/** Trade labels offered as chips for "What kind of business is it?". `any` is the fallback, not a choice. */
const KIND_CHOICES: readonly TradeKey[] = ["restaurant", "home", "store", "coach"];

// =============================================================================
// Text helpers
// =============================================================================

/** Cut `text` to at most `max` characters at a word boundary, marking the cut with "...". */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const room = flat.slice(0, Math.max(1, max - 3));
  const lastSpace = room.lastIndexOf(" ");
  // A single word longer than `max` has no boundary to cut at, so it is the one case cut mid-word.
  const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.!?-]+$/, "")}...`;
}

/** Collapse whitespace and turn phone keyboards' curly quotes into straight ones, so the patterns below match. */
function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Join items as "a, b and c". */
function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** Report whether `list` holds `value`. Takes `string`s so a `SignalId[]` can be searched with any string. */
function has(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

function signalShort(id: SignalId): string {
  return SIGNALS.find((signal) => signal.id === id)?.short ?? id;
}

// =============================================================================
// Keyword rules: owner text to option values
// =============================================================================

/** One keyword rule. Patterns carry the `gi` flags because every occurrence is checked for negation. */
interface KeywordRule<T extends string> {
  readonly pattern: RegExp;
  readonly value: T;
  /** Common English words, such as "square" or "paper", that count only with a usage cue or on the tools question. */
  readonly ambiguous?: boolean;
}

const REACH_RULES: readonly KeywordRule<string>[] = [
  { pattern: /\b(?:phones?|calls?|calling|texts?|texting|texted|sms)\b/gi, value: "Phone calls" },
  { pattern: /\b(?:walk[- ]?(?:ins?|ups?)|foot traffic|storefront|counter)\b/gi, value: "Walk-ins" },
  { pattern: /\b(?:website|web form|contact form|online form|book online|order online)\b/gi, value: "Website form" },
  // "Google Sheets" and friends are tools, not a way customers find you.
  { pattern: /\bgoogle\b(?!\s+(?:sheets?|docs?|drive|calendar|workspace|business profile))|\b(?:google maps|yelp)\b/gi, value: "Google" },
  { pattern: /\b(?:instagram|insta|facebook|tiktok|social media|dms?)\b/gi, value: "Instagram or Facebook" },
  { pattern: /\b(?:referrals?|referred|word of mouth|recommendations?)\b/gi, value: "Referrals" },
  { pattern: /\b(?:doordash|door dash|uber ?eats|grubhub|postmates|delivery apps?)\b/gi, value: "Delivery apps" },
  { pattern: /\be-?mails?\b/gi, value: "Email" },
];

const TOOL_RULES: readonly KeywordRule<string>[] = [
  { pattern: /\b(?:paper|notebook|pen and paper|by hand)\b/gi, value: "Paper and phone", ambiguous: true },
  { pattern: /\bcash register\b/gi, value: "Cash register" },
  { pattern: /\bquick ?books\b|\bqbo\b/gi, value: "QuickBooks Online" },
  { pattern: /\bsquare\b/gi, value: "Square", ambiguous: true },
  { pattern: /\bclover\b/gi, value: "Clover", ambiguous: true },
  { pattern: /\btoast\b/gi, value: "Toast", ambiguous: true },
  { pattern: /\bopen ?table\b/gi, value: "OpenTable" },
  { pattern: /\b(?:doordash|door dash)\b/gi, value: "DoorDash" },
  { pattern: /\bjobber\b/gi, value: "Jobber" },
  { pattern: /\bhouse ?call(?: ?pro)?\b/gi, value: "Housecall Pro" },
  { pattern: /\bcalendly\b/gi, value: "Calendly" },
  { pattern: /\bstripe\b/gi, value: "Stripe", ambiguous: true },
  { pattern: /\bgoogle (?:business(?: profile)?|my business|listing)\b|\bgbp\b/gi, value: "Google Business Profile" },
  { pattern: /\bgoogle sheets?\b/gi, value: "Google Sheets" },
  { pattern: /\bgmail\b/gi, value: "Gmail" },
];

const SIGNAL_RULES: readonly KeywordRule<SignalId>[] = [
  { pattern: /\b(?:quotes?|quoting|estimates?|bids?|proposals?)\b/gi, value: "quotes" },
  { pattern: /\b(?:appointments?|bookings?|book|booked|reservations?|reserve|sessions?|lessons?|classes)\b/gi, value: "appointments" },
  { pattern: /\b(?:suppliers?|wholesalers?|wholesale|vendors?|distributors?|restock\w*|inventory|ingredients)\b/gi, value: "suppliers" },
  { pattern: /\b(?:staff|employees?|shifts?|crew|cooks|cashiers|\d+ (?:people|workers|employees))\b/gi, value: "shifts" },
  { pattern: /\b(?:cater\w*|weddings?|party orders?|private events?|corporate events?|event orders?)\b/gi, value: "catering" },
  { pattern: /\b(?:snap|ebt|food stamps)\b/gi, value: "snap" },
  { pattern: /\b(?:licen[cs]es?|licensed|permits?|liquor|alcohol|tobacco|lottery|health inspections?)\b/gi, value: "licenses" },
  { pattern: /\b(?:memberships?|subscriptions?|subscribers|maintenance plans?|service plans?|monthly plans?)\b/gi, value: "memberships" },
  { pattern: /\b(?:post|posts|posting|advertis\w*|ads|marketing|promotions?|newsletters?)\b/gi, value: "marketing" },
];

const LANGUAGE_RULES: readonly KeywordRule<string>[] = [
  { pattern: /\benglish\b/gi, value: "English" },
  { pattern: /\b(?:spanish|espanol)\b|espa\u00f1ol/gi, value: "Spanish" },
  { pattern: /\bkorean\b/gi, value: "Korean" },
  { pattern: /\b(?:chinese|mandarin|cantonese)\b/gi, value: "Chinese" },
  { pattern: /\barabic\b/gi, value: "Arabic" },
  { pattern: /\bhindi\b/gi, value: "Hindi" },
];

// Switching to one of these replaces the others in its group.
const TOOL_GROUPS: readonly (readonly string[])[] = [
  ["Square", "Clover", "Toast", "Cash register"],
  ["Jobber", "Housecall Pro"],
];

const NEGATORS: ReadonlySet<string> = new Set([
  "no", "not", "never", "without", "stopped", "quit", "dropped", "nobody", "none", "neither", "nor",
  "cannot", "dont", "doesnt", "didnt", "wont", "cant", "isnt", "arent", "ended", "cancelled", "canceled",
]);

const USAGE_CUES: ReadonlySet<string> = new Set(["use", "uses", "using", "used", "on", "with", "via", "through", "to", "run", "runs", "into", "accept", "take", "pay", "have", "got"]);

/** Report whether the keyword at `index` is ruled out, as in "we don't do catering" or "catering is no longer". */
function isNegated(text: string, index: number, length: number): boolean {
  // Only the current clause counts, so "we don't deliver, but we cater" keeps catering.
  const clause = text.slice(Math.max(0, index - 48), index).toLowerCase().split(/[,.;:!?]|\bbut\b/).pop() ?? "";
  const words = clause.trim().split(/\s+/).filter(Boolean).slice(-3);
  if (words.some((word) => NEGATORS.has(word.replace(/'/g, "")) || word.endsWith("n't"))) return true;
  const after = text.slice(index + length, index + length + 32).toLowerCase();
  return /^\s*(?:[a-z']+\s+){0,2}?(?:anymore|any more|no longer)\b/.test(after);
}

/** Report whether an ambiguous tool word reads as the product: a usage cue nearby, or a capital mid-sentence. */
function hasUsageCue(text: string, index: number, match: string): boolean {
  const before = text.slice(Math.max(0, index - 24), index).toLowerCase().trim().split(/\s+/).slice(-2);
  if (before.some((word) => USAGE_CUES.has(word))) return true;
  if (/^\s*(?:pos|register|reader|terminal|payments?|app|for (?:payments|orders))\b/i.test(text.slice(index + match.length))) return true;
  const sentenceStart = /(?:^|[.!?]\s*)$/.test(text.slice(0, index));
  return !sentenceStart && /^[A-Z]/.test(match);
}

/** Character ranges naming tools the owner moved away from: "from X to", "replaced X with", "instead of X". */
function leftBehindSpans(text: string): (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [];
  const patterns = [/\bfrom\s+(.+?)\s+(?:to|over to)\b/gi, /\breplaced\s+(.+?)\s+with\b/gi, /\binstead of\s+((?:\S+\s?){1,3})/gi];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const named = match[1] ?? "";
      const start = match.index + match[0].indexOf(named);
      spans.push([start, start + named.length]);
    }
  }
  return spans;
}

/** Tools named right after "switched to" or "moved to", which replace the rest of their group. */
function switchedTo(text: string): string[] {
  const targets: string[] = [];
  for (const match of text.matchAll(/\b(?:switch(?:ed|ing)?|mov(?:ed|ing)|went|migrat(?:ed|ing)|chang(?:ed|ing))\s+(?:over\s+)?to\s+(\S+(?:\s\S+)?)/gi)) {
    const target = match[1] ?? "";
    targets.push(...TOOL_RULES.filter((rule) => new RegExp(rule.pattern.source, "i").test(target)).map((rule) => rule.value));
  }
  return targets;
}

/** Collect the values `rules` find in `text`, split into stated and ruled out. A value stated anywhere wins. */
function scan<T extends string>(text: string, rules: readonly KeywordRule<T>[], options: { readonly toolsAsked: boolean; readonly spans: readonly (readonly [number, number])[] }): { found: T[]; dropped: T[] } {
  const found = new Set<T>();
  const dropped = new Set<T>();
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      if (rule.ambiguous && !options.toolsAsked && !hasUsageCue(text, match.index, match[0])) continue;
      const leftBehind = options.spans.some(([start, end]) => match.index >= start && match.index < end);
      (leftBehind || isNegated(text, match.index, match[0].length) ? dropped : found).add(rule.value);
    }
  }
  return { found: [...found], dropped: [...dropped].filter((value) => !found.has(value)) };
}

/** Read every multiple-choice fact `text` states or rules out. `toolsAsked` lifts the usage-cue rule for tool names. */
function scanLists(text: string, toolsAsked: boolean): { found: FactLists; dropped: FactLists } {
  const options = { toolsAsked, spans: leftBehindSpans(text) };
  const reach = scan(text, REACH_RULES, options);
  const tools = scan(text, TOOL_RULES, options);
  const signals = scan(text, SIGNAL_RULES, options);
  const languages = scan(text, LANGUAGE_RULES, options);
  const replaced = switchedTo(text).flatMap((tool) => TOOL_GROUPS.find((group) => group.includes(tool)) ?? []);
  return {
    found: { reach: reach.found, tools: tools.found, signals: signals.found, languages: languages.found },
    dropped: {
      reach: reach.dropped,
      tools: unique([...tools.dropped, ...replaced]).filter((tool) => !tools.found.includes(tool)),
      signals: signals.dropped,
      languages: languages.dropped,
    },
  };
}

// =============================================================================
// Reading names, places and kinds of business
// =============================================================================

// "I run a ...", "we're a ...", ", a ..." or "is a ..." introduce the kind of business.
const KIND_LEAD = /(?:\b(?:i|we)\s+(?:run|own|have|operate|manage|started)\s+(?:a|an|the|my|our)\s+|(?:^|,\s*|\b(?:we're|we are|i'm|i am|it's|it is|its|is)\s+)(?:a|an)\s+)/i;
// Words that end a short phrase such as a kind of business or a town.
const PHRASE_END = /\s+(?:in|at|near|out of|based|located|called|named|that|which|who|with|where|for|serving|selling|since|but|and (?:we|i|it|they|our))\b|[,.;:!?()]/i;
const NAME_LEAD = /^(?:(?:hi|hello|hey)[,!.\s]+)?(?:we're|we are|this is|it's|it is|its|i'm with|i am with|(?:my|our|the) (?:business|company|shop|store) is|(?:the )?name is)\s+(?:called\s+)?/i;
const CALLED = /\b(?:called|named)\s+["']?(.+?)["']?(?=\s+(?:in|at|out of|based in|near|that|which|who|and (?:we|i|it|they|our))\b|[,.;!?]|$)/i;
const PLACE_LEAD = /\b(?:based in|located in|out of|in)\s+/gi;
// A town with a state after a comma, as in "Bowie, MD". The state is upper-case, or ends the answer.
const TOWN_WITH_STATE = /^([A-Za-z][A-Za-z.'-]*(?: [A-Za-z][A-Za-z.'-]*){0,2},\s*(?:[A-Z]{2}\b|[A-Za-z]{2}(?=\s*(?:[.!?]|$))))/;

// First words that follow "in" or a comma without naming a place.
const NOT_PLACE: ReadonlySet<string> = new Set([
  "the", "a", "an", "my", "our", "your", "their", "his", "her", "its", "this", "that", "these", "those", "each", "every",
  "we", "i", "you", "they", "he", "she", "it", "and", "but", "also", "mostly", "just", "plus", "selling", "serving", "doing",
  "business", "town", "person", "house", "home", "bulk", "total", "general", "advance", "cash", "stock", "store", "shop",
  "season", "summer", "winter", "spring", "fall", "school", "college", "charge", "case", "fact", "addition", "order",
  "time", "front", "between", "about", "around", "here", "there", "english", "spanish", "korean", "chinese", "arabic", "hindi",
]);

/** Return a short phrase from the start of `rest`, ending at the first boundary word or punctuation. */
function leadingPhrase(rest: string, maxWords: number): string {
  const end = PHRASE_END.exec(rest);
  const phrase = (end ? rest.slice(0, end.index) : rest).trim();
  return phrase.split(/\s+/).slice(0, maxWords).join(" ");
}

/** Report whether `phrase` reads like a town: one to four words, no digits, not a common non-place word. */
function looksLikePlace(phrase: string): boolean {
  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (NOT_PLACE.has((words[0] ?? "").toLowerCase().replace(/,$/, ""))) return false;
  return words.every((word) => /^[A-Za-z][A-Za-z.'-]*,?$/.test(word));
}

/** Title-case a town, keeping a trailing two-letter state upper-case: "bowie, md" becomes "Bowie, MD". */
function placeCase(phrase: string): string {
  const words = phrase.replace(/,\s*/g, ", ").trim().split(/\s+/);
  return words
    .map((word, i) => (i > 0 && i === words.length - 1 && /^[a-z]{2}$/i.test(word) && words[i - 1]?.endsWith(",") ? word.toUpperCase() : capitalize(word)))
    .join(" ");
}

/** Return the town after "in", "based in" or "out of", allowing a state after a comma. */
function readPlace(text: string): string | undefined {
  for (const match of text.matchAll(PLACE_LEAD)) {
    const rest = text.slice(match.index + match[0].length);
    const withState = TOWN_WITH_STATE.exec(rest)?.[1];
    const phrase = withState !== undefined && looksLikePlace(withState) ? withState : leadingPhrase(rest, 4);
    if (looksLikePlace(phrase)) return placeCase(phrase);
  }
  return undefined;
}

/** Find where a description of the kind of business starts. "A Cut Above Salon" is a name, not "a cut". */
function kindLead(text: string): RegExpExecArray | null {
  const lead = KIND_LEAD.exec(text);
  if (lead === null) return null;
  const bareArticle = lead.index === 0 && /^an?\s+$/i.test(lead[0]);
  return bareArticle && /^[A-Z]/.test(text.slice(lead[0].length)) ? null : lead;
}

/** Return the kind of business in a description, such as "Food truck" from "I run a food truck in Baltimore". */
function readKind(text: string): string | undefined {
  const lead = kindLead(text);
  if (!lead) return undefined;
  const phrase = leadingPhrase(text.slice(lead.index + lead[0].length), 6);
  return phrase ? capitalize(phrase) : undefined;
}

/** Read the answer to "What kind of business is it?", which may be bare ("food truck") or a sentence. */
function readKindAnswer(text: string): string | undefined {
  const described = readKind(text);
  if (described) return described;
  const rest = text.replace(/^(?:we're|we are|it's|it is|its|i'm|i am|we do|i do|we run|i run|we sell|i sell|we have|i have|mostly|basically|just)\s+/i, "");
  const phrase = leadingPhrase(rest, 8);
  return phrase ? capitalize(phrase) : undefined;
}

/** Split the answer to the name question into the business name, its town, and a kind when the owner described it. */
function readNameAnswer(text: string): Partial<Record<"name" | "place" | "kind", string>> {
  const place = readPlace(text);
  const kind = readKind(text);
  const called = CALLED.exec(text)?.[1]?.trim();
  if (called) return withoutBlanks({ name: clip(called, TEXT_LIMITS.name), place, kind });

  // Text before a description is the name, as in "Rosa's Tacos, a food truck".
  const lead = kindLead(text);
  const head = (lead ? text.slice(0, lead.index) : text).replace(NAME_LEAD, "").trim();
  const [beforeComma = "", ...afterComma] = head.split(",");
  let name = beforeComma.trim();
  const inTown = [...name.matchAll(PLACE_LEAD)].find((match) => looksLikePlace(leadingPhrase(name.slice(match.index + match[0].length), 4)));
  if (inTown) name = name.slice(0, inTown.index).trim();
  name = name.replace(/^["']+|["'.!]+$/g, "").trim();
  // A sentence that starts with "I" or "we" and names no business is a description, not a name.
  const isName = name !== "" && name.split(/\s+/).length <= 8 && !/^(?:i|we|my|our|it|its|it's)\b/i.test(name);
  const commaPlace = afterComma.join(",").trim();
  const placeAfterComma = isName && !lead && looksLikePlace(commaPlace) ? placeCase(commaPlace) : undefined;
  return withoutBlanks({ name: isName ? name : undefined, place: place ?? placeAfterComma, kind });
}

/** Drop keys whose value is missing or blank, so spreading the result never erases a known fact. */
function withoutBlanks<K extends string>(texts: Partial<Record<K, string | undefined>>): Partial<Record<K, string>> {
  const kept: Partial<Record<K, string>> = {};
  for (const key in texts) {
    const value = texts[key];
    if (typeof value === "string" && value.trim() !== "") kept[key] = value.trim();
  }
  return kept;
}

// =============================================================================
// Reading one answer
// =============================================================================

const SKIP = /^(?:skip|pass|next|later|not sure|unsure|no idea|(?:i )?don't know|dont know|dunno|idk|n\/?a|prefer not to say|rather not say|skip (?:this|it|that))[\s.!]*$/i;
const NONE = /^(?:none|nothing|no|nope|nah|neither|none of (?:these|them|those|the above))[\s.!]*$/i;

const NO_FACTS: IntakeFacts = { ...NO_LISTS };

/** Read a typed answer to `step` with keyword rules. Voice samples are kept whole and never mined for facts. */
export function readAnswer(text: string, step: IntakeStep): AnswerReading {
  const clean = normalize(text);
  if (SKIP.test(clean)) return { intent: "skip", text: clean, facts: NO_FACTS, dropped: NO_LISTS };
  if (NONE.test(clean)) return { intent: "none", text: clean, facts: NO_FACTS, dropped: NO_LISTS };
  if (clean === "") return { intent: "answer", text: clean, facts: NO_FACTS, dropped: NO_LISTS };
  if (step === "voice") return { intent: "answer", text: clean, facts: { ...NO_LISTS, voice: clean }, dropped: NO_LISTS };

  const { found, dropped } = scanLists(clean, step === "tools");
  let texts: Partial<Record<TextKey, string>> = {};
  if (step === "name") texts = readNameAnswer(clean);
  else if (step === "kind") texts = withoutBlanks({ kind: readKindAnswer(clean), place: readPlace(clean) });
  else if (step === "what") texts = { what: clean };
  else if (step === "week") texts = { week: clean };
  return { intent: "answer", text: clean, facts: { ...found, ...texts }, dropped };
}

/** Union two sets of lists. */
function joinLists(a: FactLists, b: FactLists): FactLists {
  return {
    reach: unique([...a.reach, ...b.reach]),
    tools: unique([...a.tools, ...b.tools]),
    signals: unique([...a.signals, ...b.signals]),
    languages: unique([...a.languages, ...b.languages]),
  };
}

/** Combine the rules' reading with the model's: lists are unioned, and the model's name, town and kind win. */
export function mergeReadings(rules: AnswerReading, model: { readonly facts: IntakeFacts; readonly dropped: FactLists }): AnswerReading {
  // What they sell, their week and their voice stay in the owner's own words, so only these come from the model.
  const parsed = withoutBlanks({ name: model.facts.name, place: model.facts.place, kind: model.facts.kind });
  return { ...rules, facts: { ...rules.facts, ...joinLists(rules.facts, model.facts), ...parsed }, dropped: joinLists(rules.dropped, model.dropped) };
}

// =============================================================================
// Option lists
// =============================================================================

const KIND_LABELS: readonly string[] = KIND_CHOICES.map((key) => TRADE_HINTS[key].label);

/** What each question covers, as the "Change something" chips and the summary card name it. */
const FIELD_LABELS: Readonly<Record<IntakeField, { readonly change: string; readonly summary: string }>> = {
  name: { change: "Name and town", summary: "Business" },
  kind: { change: "Kind of business", summary: "Kind" },
  what: { change: "What you sell", summary: "Sells" },
  reach: { change: "How customers reach you", summary: "Customers reach you by" },
  tools: { change: "Tools", summary: "Runs on" },
  signals: { change: "What's true for you", summary: "True for you" },
  languages: { change: "Languages", summary: "Languages" },
  week: { change: "Your week", summary: "Eats your week" },
  voice: { change: "Your voice", summary: "Your voice" },
};

/** Keep only values that name a real option for `key`, spelled as the option list spells it. Signals match by id, label or short label. */
function allowedValues(key: Exclude<ListKey, "signals">, values: readonly string[]): string[] {
  const wanted = values.map((value) => value.trim().toLowerCase());
  const options = key === "reach" ? REACH_OPTIONS : key === "tools" ? TOOL_OPTIONS : LANGUAGE_OPTIONS;
  return options.filter((option) => wanted.includes(option.toLowerCase()));
}

/** Keep only values that name a signal, by id, label or short label. */
function allowedSignals(values: readonly string[]): SignalId[] {
  const wanted = values.map((value) => value.trim().toLowerCase());
  return SIGNALS.filter((signal) => [signal.id, signal.label.toLowerCase(), signal.short.toLowerCase()].some((name) => wanted.includes(name))).map((signal) => signal.id);
}

/** Keep only allowed values in every list. */
export function allowedLists(raw: Readonly<Record<ListKey, readonly string[]>>): FactLists {
  return {
    reach: allowedValues("reach", raw.reach),
    tools: allowedValues("tools", raw.tools),
    signals: allowedSignals(raw.signals),
    languages: allowedValues("languages", raw.languages),
  };
}

/** Order chips: already selected first, then the ones common for this trade, then the rest in list order. */
function rankOptions(options: readonly IntakeOption[]): IntakeOption[] {
  const rank = (option: IntakeOption) => (option.selected ? 0 : option.suggested ? 1 : 2);
  return options.map((option, i) => ({ option, i })).sort((a, b) => rank(a.option) - rank(b.option) || a.i - b.i).map(({ option }) => option);
}

/** Chips for a list question, marking what the draft holds and what the trade hint suggests. */
function listOptions(values: readonly string[], selected: readonly string[], suggested: readonly string[], labelOf: (value: string) => string = (value) => value): IntakeOption[] {
  return rankOptions(values.map((value) => ({ value, label: labelOf(value), selected: selected.includes(value), suggested: suggested.includes(value) })));
}

/** A chip that only answers, such as "Looks right". */
function plainOption(value: string, label: string): IntakeOption {
  return { value, label, selected: false, suggested: false };
}

// Chips that don't fit a trade: a plumber has no walk-ins, delivery apps, tables or SNAP. An unknown trade sees them all.
const OFF_TRADE: Readonly<Record<TradeKey, { readonly reach: readonly string[]; readonly tools: readonly string[]; readonly signals: readonly string[] }>> = {
  home: { reach: ["Walk-ins", "Delivery apps"], tools: ["Cash register", "Toast", "OpenTable", "DoorDash", "Clover"], signals: ["catering", "snap"] },
  restaurant: { reach: [], tools: ["Jobber", "Housecall Pro", "Calendly"], signals: ["quotes", "memberships"] },
  store: { reach: [], tools: ["Jobber", "Housecall Pro", "OpenTable", "Calendly", "Toast"], signals: ["quotes", "appointments", "memberships"] },
  coach: { reach: ["Walk-ins", "Delivery apps"], tools: ["Cash register", "Toast", "OpenTable", "DoorDash", "Clover", "Jobber", "Housecall Pro"], signals: ["catering", "snap", "suppliers", "shifts"] },
  any: { reach: [], tools: [], signals: [] },
};

/** `values` without the ones that don't fit the trade, keeping any the owner already chose. */
function fitting<T extends string>(values: readonly T[], chosen: readonly string[], off: readonly string[]): T[] {
  return values.filter((value) => !off.includes(value) || chosen.includes(value));
}

/** A signal's chip label in the trade's words: only a restaurant books tables. */
function signalLabel(id: string, tradeKey: TradeKey): string {
  if (id === "appointments" && tradeKey !== "restaurant" && tradeKey !== "any") return "Customers book appointments";
  return SIGNALS.find((signal) => signal.id === id)?.label ?? id;
}

/** The chips for one step, or `undefined` for a question answered in words. */
function optionsFor(step: IntakeStep, draft: IntakeDraft): IntakeOption[] | undefined {
  const { facts } = draft;
  const hint = hintFor(`${facts.kind ?? ""} ${facts.what ?? ""} ${facts.name ?? ""}`);
  if (step === "listing") return listingOptions(draft);
  if (step === "sheet") return [plainOption("skip", "Skip for now")];
  if (isGapStep(step)) return gapOptions(gapKeyOf(step), draft);
  switch (step) {
    case "kind": {
      const guess = TRADE_HINTS[detectTradeKey(`${facts.name ?? ""} ${facts.what ?? ""}`)].label;
      return rankOptions(KIND_LABELS.map((label) => ({ ...plainOption(label, label), suggested: label === guess })));
    }
    case "reach":
      return listOptions(fitting(REACH_OPTIONS, facts.reach, OFF_TRADE[hint.tradeKey].reach), facts.reach, hint.reach);
    case "tools":
      return listOptions(fitting(TOOL_OPTIONS, facts.tools, OFF_TRADE[hint.tradeKey].tools), facts.tools, hint.tools);
    case "signals":
      return listOptions(
        fitting(
          SIGNALS.map((signal) => signal.id),
          facts.signals,
          OFF_TRADE[hint.tradeKey].signals,
        ),
        facts.signals,
        hint.signals,
        (id) => signalLabel(id, hint.tradeKey),
      );
    case "languages":
      return listOptions(LANGUAGE_OPTIONS, facts.languages, []);
    case "confirm":
      return [plainOption("yes", "Looks right"), plainOption("change", "Change something")];
    case "change":
      return [
        ...INTAKE_FIELDS.map((field) => plainOption(field, FIELD_LABELS[field].change)),
        ...detailFacts(draft).map((fact) => plainOption(gapStep(fact.field as FieldKey), fact.label)),
      ];
    default:
      return undefined;
  }
}

function isListStep(step: IntakeStep): step is ListKey {
  return step === "reach" || step === "tools" || step === "signals" || step === "languages";
}

// =============================================================================
// Details, the listing and gap questions
// =============================================================================

/** The gap step for a profile detail. */
export function gapStep(key: FieldKey): GapStep {
  return `gap:${key}`;
}

/** Whether `step` is a gap question. */
export function isGapStep(step: string): step is GapStep {
  return step.startsWith("gap:") && FIELD_KEYS.some((key) => `gap:${key}` === step);
}

/** The detail a gap step asks about. */
export function gapKeyOf(step: GapStep): FieldKey {
  return step.slice("gap:".length) as FieldKey;
}

function detailState(draft: IntakeDraft): DetailState {
  return { details: draft.details ?? NO_DETAILS.details, evidence: draft.evidence ?? NO_DETAILS.evidence };
}

function withDetails(draft: IntakeDraft, state: DetailState): IntakeDraft {
  return { ...draft, details: state.details, evidence: state.evidence };
}

/** Return `draft` with Google's matches for its name and town; with none, the listing step is skipped. */
export function withListingChoices(draft: IntakeDraft, choices: readonly ListingChoice[]): IntakeDraft {
  return { ...draft, listing: { choices: choices.slice(0, 3), settled: choices.length === 0 } };
}

/** Settle the listing step: the owner's pick, with the facts its listing gave, or "not listed" when `placeId` is `null`. */
export function applyListing(draft: IntakeDraft, placeId: string | null, candidates: readonly DetailCandidate[]): IntakeDraft {
  const known = placeId !== null && (draft.listing?.choices ?? []).some((choice) => choice.id === placeId);
  const merged = withDetails(draft, mergeCandidates(detailState(draft), known ? candidates : []));
  return { ...merged, ...(known ? { placeId } : {}), listing: { choices: draft.listing?.choices ?? [], settled: true } };
}

/** Return `draft` with candidates from a source such as the owner's website. */
export function withCandidates(draft: IntakeDraft, candidates: readonly DetailCandidate[]): IntakeDraft {
  return withDetails(draft, mergeCandidates(detailState(draft), candidates));
}

/** The listing match the owner tapped, or `null` for "Not listed" or anything else. */
export function pickedListing(draft: IntakeDraft, picks: readonly string[] | undefined): string | null {
  const pick = picks?.[0];
  return (draft.listing?.choices ?? []).some((choice) => choice.id === pick) ? (pick ?? null) : null;
}

function listingOpen(draft: IntakeDraft): boolean {
  return draft.listing !== undefined && !draft.listing.settled && draft.settled.includes("name");
}

/** The core agents this draft's plan would put to work, as the engine would build it now. */
function plannedAgents(draft: IntakeDraft): CoreAgentId[] {
  const profile = profileFromAnswers(draftToAnswers(draft));
  return activeAgents(profile, {}).flatMap((agent) => (agent.id.startsWith("niche:") ? [] : [agent.id as CoreAgentId]));
}

/** The gap questions still to ask: must fields of the agents the plan turns on, once every planned question is done. */
export function pendingGaps(draft: IntakeDraft): FieldKey[] {
  if (INTAKE_FIELDS.some((field) => needsAsking(draft, field)) || listingOpen(draft)) return [];
  const asked = draft.gaps ?? [];
  if (asked.length >= MAX_GAPS) return [];
  return gapsFor(detailState(draft), plannedAgents(draft))
    .filter((key) => !asked.includes(key))
    .slice(0, MAX_GAPS - asked.length);
}

// Tap answers for the details with a fixed set of values.
const GAP_CHOICES: Readonly<Partial<Record<FieldKey, readonly (readonly [string, string])[]>>> = {
  pricingMethod: [
    ["menu", "Set prices"],
    ["hourly", "By the hour"],
    ["quote", "A quote for each request"],
    ["packages", "Packages"],
  ],
  reminderFirmness: [
    ["gentle", "Gentle"],
    ["standard", "Standard"],
    ["firm", "Firm"],
  ],
  nextStep: [
    ["book_call", "Book a call"],
    ["send_estimate", "Send an estimate"],
    ["book_visit", "Book a visit"],
  ],
};

/** A detail that only a guess fills, which the gap question offers for the owner to confirm. */
function suggestionFor(draft: IntakeDraft, key: FieldKey): { readonly value: unknown; readonly evidence: FieldEvidence } | null {
  const state = detailState(draft);
  const value = state.details[key];
  const evidence = state.evidence[key];
  if (value === undefined || evidence === undefined || evidence.ownerConfirmed || !isFilled(state.details, key)) return null;
  return { value, evidence };
}

/** Whether a gap question is being asked again after an answer that couldn't be read. */
function retrying(draft: IntakeDraft, key: FieldKey): boolean {
  return (draft.gapRetries ?? []).includes(key) && !(draft.gaps ?? []).includes(key);
}

function gapText(key: FieldKey, draft: IntakeDraft): string {
  const def = FIELDS[key];
  const suggestion = suggestionFor(draft, key);
  if (suggestion !== null) {
    const { evidence } = suggestion;
    const from = evidence.sourceType === "owner" ? `From what you told me ("${clip(evidence.quote, 60)}")` : SOURCE_NAME[evidence.sourceType];
    if (retrying(draft, key)) return `I couldn't tell which word to change, so I kept ${detailText(key, suggestion.value)}. Tell me the one to change, like "we call a booking a service call", or tap That's right.`;
    return `${from}: ${detailText(key, suggestion.value)}. Is that right? If not, tell me the right words.`;
  }
  if (retrying(draft, key)) return `I didn't catch that. ${def.ask.prompt} For example: ${def.ask.example}.`;
  return `${def.ask.prompt} For example: ${def.ask.example}.`;
}

function gapOptions(key: FieldKey, draft: IntakeDraft): IntakeOption[] | undefined {
  if (suggestionFor(draft, key) !== null) return [plainOption("yes", "That's right")];
  const choices = GAP_CHOICES[key];
  return choices ? choices.map(([value, label]) => plainOption(value, label)) : undefined;
}

function listingOptions(draft: IntakeDraft): IntakeOption[] {
  const choices = (draft.listing?.choices ?? []).map((choice) => plainOption(choice.id, `${choice.name}, ${choice.address}`));
  return [...choices, plainOption("none", "Not listed")];
}

/** A tapped choice as the value it stands for. */
function choiceValue(key: FieldKey, pick: string): DetailCandidate | null {
  const label = GAP_CHOICES[key]?.find(([value]) => value === pick)?.[1];
  if (label === undefined) return null;
  const value = key === "nextStep" ? { lead: "", step: pick } : pick;
  return { key, value, sourceType: "owner", quote: label, confidence: "high" } as DetailCandidate;
}

/** Details an answer to another question can give: more of what the business sells usually names its prices. */
const ALSO_READ: Readonly<Partial<Record<FieldKey, readonly FieldKey[]>>> = {
  prices: ["minimumCharge", "pricingMethod"],
  pricingMethod: ["prices", "minimumCharge"],
};

/** Apply the owner's answer to a gap question. `extra` holds candidates the model read from the same words. */
export function applyGapAnswer(draft: IntakeDraft, key: FieldKey, picks: readonly string[] | undefined, reading: AnswerReading, extra: readonly DetailCandidate[] = []): IntakeDraft {
  const state = detailState(draft);
  const pick = picks?.[0];
  const suggestion = suggestionFor(draft, key);
  let next = state;
  if (suggestion !== null && (pick === "yes" || (pick === undefined && AFFIRM.test(reading.text)))) {
    // The owner said the guess is right, which makes it theirs.
    next = { ...state, evidence: { ...state.evidence, [key]: { ...suggestion.evidence, sourceType: "owner", confidence: "high", ownerConfirmed: true } } };
  } else if (suggestion !== null && pick === undefined && (reading.intent === "none" || WANTS_CHANGE.test(reading.text))) {
    // The owner said the guess is wrong without giving the right words, so it goes. Confirming the profile would otherwise make it theirs.
    next = withoutDetail(state, key);
  } else if (pick !== undefined && choiceValue(key, pick) !== null) {
    next = mergeCandidate(state, choiceValue(key, pick) as DetailCandidate);
  } else if (reading.intent === "answer" && reading.text !== "") {
    const keys = [key, ...(ALSO_READ[key] ?? [])];
    const found = keys.flatMap((candidate) => typedCandidate(state, candidate, reading.text) ?? []);
    next = mergeCandidates(state, [...found, ...extra]);
  }
  const revisiting = draft.review.stage === "revisiting" && draft.review.field === gapStep(key);
  const retries = draft.gapRetries ?? [];
  // Words that changed nothing get one more ask, so a correction the rules couldn't place never stores fragments or vanishes.
  const unread = reading.intent === "answer" && reading.text !== "" && pick === undefined && sameValue(next.details[key], state.details[key]) && !AFFIRM.test(reading.text);
  if (unread && !retries.includes(key)) return { ...withDetails(draft, next), gapRetries: [...retries, key] };
  return { ...withDetails(draft, next), gaps: unique([...(draft.gaps ?? []), key]), review: revisiting ? { stage: "asking" } : draft.review };
}

/** A candidate for `key` from typed words. Vocabulary is a correction of the words already held when there are some. */
function typedCandidate(state: DetailState, key: FieldKey, text: string): DetailCandidate | null {
  const current = state.details.vocabulary;
  if (key !== "vocabulary" || current === undefined) return candidateFor(key, text, "owner", "high");
  const value = correctVocabulary(current, text);
  return value === undefined ? null : { key, value, sourceType: "owner", quote: clip(text.replace(/\s+/g, " ").trim(), 240), confidence: "high" };
}

function withoutDetail(state: DetailState, key: FieldKey): DetailState {
  const { [key]: _value, ...details } = state.details;
  const { [key]: _evidence, ...evidence } = state.evidence;
  return { details, evidence };
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Details the rules read from an answer to a planned question, folded into the draft. */
function withAnswerDetails(before: IntakeDraft, after: IntakeDraft, field: IntakeField, reading: AnswerReading): IntakeDraft {
  const found: DetailCandidate[] = [];
  if (reading.intent === "answer" && field === "what") found.push(...candidatesFromSales(reading.text, "owner"));
  if (reading.intent === "answer" && field === "voice" && reading.text !== "") {
    const example = candidateFor("examples", reading.text, "owner", "high");
    if (example) found.push(example);
    // A sample signed "Mike from Brightwater" already names the owner, so the name is never asked again.
    const name = nameFromSample(reading.text);
    if (name !== undefined && after.details?.ownerName === undefined) found.push({ key: "ownerName", value: name, sourceType: "owner", quote: clip(reading.text, 240), confidence: "high" });
  }
  const kind = after.facts.kind;
  if (kind && kind !== before.facts.kind && after.details?.vocabulary === undefined) {
    const guess = vocabularyGuess(detectTradeKey(kind), kind);
    if (guess) found.push(guess);
  }
  const quotes = SIGNALS.find((signal) => signal.id === "quotes");
  if (after.facts.signals.includes("quotes") && !before.facts.signals.includes("quotes") && quotes && after.details?.pricingMethod === undefined) {
    found.push({ key: "pricingMethod", value: "quote", sourceType: "owner", quote: quotes.label, confidence: "medium" });
  }
  return found.length === 0 ? after : withDetails(after, mergeCandidates(detailState(after), found));
}

/** One line per known detail for the summary, with its source and any conflict. */
function detailFacts(draft: IntakeDraft): KnownFact[] {
  const state = detailState(draft);
  return FIELD_KEYS.flatMap((key) => {
    const value = state.details[key];
    if (key === "examples" || value === undefined || !isFilled(state.details, key)) return [];
    const evidence = state.evidence[key];
    const conflict = conflictLine(key, state);
    return [
      {
        field: key,
        label: FIELDS[key].label,
        value: clip(detailText(key, value), 100),
        state: "known" as const,
        ...(evidence ? { source: SOURCE_NAME[evidence.sourceType] } : {}),
        ...(conflict ? { conflict } : {}),
      },
    ];
  });
}

/** The details, evidence and listing a confirmed draft gives its business. The owner confirmed them all. */
export function draftDetails(draft: IntakeDraft): Pick<BusinessProfile, "details" | "evidence" | "placeId"> {
  const state = confirmAll(detailState(draft));
  const hasDetails = FIELD_KEYS.some((key) => state.details[key] !== undefined);
  return {
    ...(hasDetails ? { details: state.details, evidence: state.evidence } : {}),
    ...(draft.placeId ? { placeId: draft.placeId } : {}),
  };
}

// =============================================================================
// Questions
// =============================================================================

/** Return an empty draft for a new intake. Nothing is pre-filled. */
export function newDraft(): IntakeDraft {
  return { facts: { ...NO_LISTS }, settled: [], followUp: null, followUps: 0, review: { stage: "asking" } };
}

/** Report whether a planned question still needs asking. A free-text fact learned elsewhere answers its question. */
function needsAsking(draft: IntakeDraft, field: IntakeField): boolean {
  if (draft.settled.includes(field)) return false;
  return isListStep(field) || !draft.facts[field];
}

// Lead-ins for confirming a list the owner already named in an earlier answer.
const HEARD_LEAD: Readonly<Record<ListKey, (name: string) => string>> = {
  reach: () => "Customers reach you by",
  tools: () => "You run things on",
  signals: (name) => `True for ${name}`,
  languages: () => "Languages",
};

/** Confirm a list the owner already named, or `null` when the list is still empty. */
function heardText(step: ListKey, draft: IntakeDraft): string | null {
  const values = draft.facts[step];
  if (values.length === 0) return null;
  const labels = step === "signals" ? values.map((id) => SIGNALS.find((signal) => signal.id === id)?.label ?? id) : values;
  return `${HEARD_LEAD[step](draft.facts.name ?? "you")}: ${listText(labels)}. Tap to add or remove any, or say that's right.`;
}

/** The wording of one step's question, using what the draft already knows. */
function questionText(step: IntakeStep, draft: IntakeDraft): string {
  const name = draft.facts.name;
  const heard = isListStep(step) ? heardText(step, draft) : null;
  if (heard) return heard;
  if (step === "listing") return "Is this you? I found these on Google.";
  if (isGapStep(step)) return gapText(gapKeyOf(step), draft);
  switch (step) {
    case "name":
      return "What's your business called, and what town is it in?";
    case "kind":
      return name ? `What kind of business is ${name}?` : "What kind of business is it?";
    case "what":
      return "What do you sell, who buys it, and roughly what does it cost?";
    case "reach":
      return "How do customers usually reach you? Pick all that apply.";
    case "tools":
      return "What do you use to run things today?";
    case "signals":
      return `Which of these are true for ${name ?? "you"}?`;
    case "languages":
      return "Which languages do you and your customers use?";
    case "week":
      return "What eats your week? Name the jobs you wish someone else did.";
    case "voice":
      return "Paste or type a reply you've sent a customer, so drafts sound like you.";
    case "sheet":
      return "You use Google Sheets. If you track invoices in a sheet, paste its link here. Bookkeeping will draft a reminder for each overdue invoice and stop it once you mark the invoice paid. I'll tell you how to share it with Anchored next. Or tap Skip for now.";
    case "confirm":
      return confirmText(draft);
    case "change":
      return "What should I change?";
  }
}

/** The closing summary the owner confirms before Anchored builds the plan. */
function confirmText(draft: IntakeDraft): string {
  const known = summarize(draft);
  const lines = known.flatMap((fact) => (fact.value === null ? [] : [`${fact.label}: ${clip(fact.value, 70)}`]));
  const conflicts = known.flatMap((fact) => (fact.conflict ? [fact.conflict] : []));
  return ["Here's the profile I'll build your plan from.", ...lines, ...conflicts, "Does this look right?"].join("\n");
}

function ask(step: IntakeStep, draft: IntakeDraft, text?: string): IntakeQuestion {
  const options = optionsFor(step, draft);
  return { field: step, text: text ?? questionText(step, draft), ...(options ? { options } : {}), multi: isListStep(step) };
}

/** Return the question Anchored asks next, or `null` once the owner has confirmed the profile. */
export function nextQuestion(draft: IntakeDraft): IntakeQuestion | null {
  const { review } = draft;
  if (review.stage === "confirmed") return null;
  if (draft.followUp) return ask(draft.followUp.field, draft, draft.followUp.text);
  if (review.stage === "revisiting") return ask(review.field, draft);
  if (review.stage === "choosing") return ask("change", draft);
  if (listingOpen(draft)) return ask("listing", draft);
  const open = INTAKE_FIELDS.find((field) => needsAsking(draft, field));
  if (open) return ask(open, draft);
  const gap = pendingGaps(draft)[0];
  if (gap) return ask(gapStep(gap), draft);
  if (wantsInvoiceSheet(draft)) return ask("sheet", draft);
  return ask("confirm", draft);
}

/** Whether to ask for the invoice sheet: the owner runs on Google Sheets, Bookkeeping is in the plan, and it hasn't been asked. */
export function wantsInvoiceSheet(draft: IntakeDraft): boolean {
  if (draft.invoiceSheet !== undefined || !draft.facts.tools.includes("Google Sheets")) return false;
  return plannedAgents(draft).includes("books");
}

/** Report whether the owner has answered everything and confirmed the profile. */
export function isComplete(draft: IntakeDraft): boolean {
  return nextQuestion(draft) === null;
}

// =============================================================================
// Applying an answer
// =============================================================================

/** Apply the owner's answer to `step` with the keyword rules, and return the updated draft. */
export function applyAnswer(draft: IntakeDraft, step: IntakeStep, answer: IntakeAnswer): IntakeDraft {
  return applyReading(draft, step, answer.picks, readAnswer(answer.text ?? "", step));
}

/** Fold a read answer into `draft` and move the conversation on. The model path calls this with its own reading. */
export function applyReading(draft: IntakeDraft, step: IntakeStep, picks: readonly string[] | undefined, reading: AnswerReading): IntakeDraft {
  if (step === "confirm") return applyConfirm(draft, picks, reading);
  if (step === "change") return applyChange(draft, picks, reading);
  if (step === "listing") return applyListing(draft, pickedListing(draft, picks), []);
  if (step === "sheet") return { ...draft, invoiceSheet: { id: picks?.includes("skip") ? null : sheetIdFromText(reading.text) } };
  if (isGapStep(step)) return applyGapAnswer(draft, gapKeyOf(step), picks, reading);
  return withAnswerDetails(draft, applyFieldAnswer(draft, step, picks, reading), step, reading);
}

/** Return `draft` with a follow-up for `field`, or `null` when the follow-up budget is spent. */
export function withFollowUp(draft: IntakeDraft, field: IntakeField, text: string): IntakeDraft | null {
  if (draft.followUps >= MAX_FOLLOW_UPS) return null;
  return { ...draft, followUp: { field, text }, followUps: draft.followUps + 1 };
}

// Answers that name nothing a business sells: "oh, you know, the usual stuff".
const VAGUE = /\b(?:the usual|you know|stuff|things|whatever|all sorts|a bit of everything|everything|not sure|idk|dunno|the normal)\b/i;
const VAGUE_WHAT_TEXT = "Name two or three things you sell most, like drain cleaning or water heater installs, and roughly what they cost.";

/** Whether an answer about what the business sells names nothing: vague words and nothing else of substance. */
export function isVagueWhat(text: string): boolean {
  if (!VAGUE.test(text)) return false;
  const rest = text.replace(new RegExp(VAGUE.source, "gi"), " ").replace(/\b(?:oh|um|uh|well|just|really|like|we|do|sell|offer|i|the|a|and|of|all|kinds?|sorts?)\b/gi, " ").replace(/[^a-z]/gi, "");
  return rest.length < 4;
}

// "to correct my earlier answer: we do drain cleaning ..." inside an answer to another question.
const WHAT_CORRECTION = /\b(?:correct(?:ion)?|i meant|actually|to clarify|fix)\b[^:.!?]*?[:,]?\s*(?:we|i)\s+(?:do|sell|offer|make|provide)\s+([^.!?]{3,200})/i;

/** What the business sells, from a correction the owner made inside another answer, or `null`. */
function whatCorrection(text: string): string | null {
  const found = WHAT_CORRECTION.exec(text)?.[1]?.trim();
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : null;
}

function applyFieldAnswer(draft: IntakeDraft, field: IntakeField, picks: readonly string[] | undefined, reading: AnswerReading): IntakeDraft {
  const corrected = field !== "what" && reading.intent === "answer" ? whatCorrection(reading.text) : null;
  const applied = applyOwnFieldAnswer(draft, field, picks, reading);
  return corrected === null ? applied : { ...applied, facts: { ...applied.facts, what: corrected } };
}

function applyOwnFieldAnswer(draft: IntakeDraft, field: IntakeField, picks: readonly string[] | undefined, reading: AnswerReading): IntakeDraft {
  const answeringFollowUp = draft.followUp?.field === field;
  if (field === "what" && reading.intent === "answer" && isVagueWhat(reading.text)) {
    // A vague answer is never stored. It gets one follow-up of its own, then the question settles with what was known.
    if (draft.followUp?.text !== VAGUE_WHAT_TEXT) return { ...draft, followUp: { field, text: VAGUE_WHAT_TEXT }, followUps: draft.followUps + 1 };
    return { ...draft, followUp: null, settled: unique([...draft.settled, field]) };
  }
  const revisiting = draft.review.stage === "revisiting" && draft.review.field === field;
  // A list question that opened by repeating what the owner said reads "yes" and "no, that's all" as keep it.
  const confirmingHeard = isListStep(field) && picks === undefined && draft.facts[field].length > 0 && (reading.intent === "none" || AFFIRM.test(reading.text));
  if (confirmingHeard) return { ...draft, followUp: null, settled: unique([...draft.settled, field]), review: revisiting ? { stage: "asking" } : draft.review };
  let facts = draft.facts;
  if (picks !== undefined) facts = withPicks(facts, field, picks);
  if (reading.intent === "none" && isListStep(field)) facts = withList(facts, field, []);
  if (reading.intent === "answer") facts = mergeAnswer(facts, field, reading, { settled: draft.settled, replace: revisiting });
  const answered: IntakeDraft = { ...draft, facts, followUp: null, answeredNone: noneLists(draft, field, facts, picks, reading) };

  // The rules ask again at most once per question, and only while the follow-up budget lasts.
  const again = answeringFollowUp || reading.intent !== "answer" ? null : reaskText(field, answered, picks, reading);
  const reasked = again === null ? null : withFollowUp(answered, field, again);
  if (reasked) return reasked;

  return { ...answered, settled: unique([...answered.settled, field]), review: revisiting ? { stage: "asking" } : answered.review };
}

/** The lists answered with none after this answer: an empty Done or a typed "none" adds the list, any value removes it. */
function noneLists(draft: IntakeDraft, field: IntakeField, facts: IntakeFacts, picks: readonly string[] | undefined, reading: AnswerReading): ListKey[] {
  const before = (draft.answeredNone ?? []).filter((key) => facts[key].length === 0);
  const saidNone = isListStep(field) && facts[field].length === 0 && (picks !== undefined || reading.intent === "none");
  return saidNone ? unique([...before, field]) : before;
}

/** Text to ask again when an answer missed its question, or `null` when it landed. */
function reaskText(field: IntakeField, after: IntakeDraft, picks: readonly string[] | undefined, reading: AnswerReading): string | null {
  if (field === "name") return after.facts.name ? null : "And what's the business called?";
  if (!isListStep(field) || picks !== undefined || reading.facts[field].length > 0) return null;
  return "I couldn't match that to the options. Tap any that fit, or say skip.";
}

/** Return `facts` with one list replaced. */
function withList(facts: IntakeFacts, key: ListKey, values: readonly string[]): IntakeFacts {
  return key === "signals" ? { ...facts, signals: allowedSignals(values) } : { ...facts, [key]: allowedValues(key, values) };
}

/** Apply tapped chips. Multi-select picks replace the list; the kind chip sets the kind of business. */
function withPicks(facts: IntakeFacts, field: IntakeField, picks: readonly string[]): IntakeFacts {
  if (isListStep(field)) return withList(facts, field, picks);
  if (field !== "kind") return facts;
  const label = KIND_LABELS.find((candidate) => picks.includes(candidate));
  return label ? { ...facts, kind: label } : facts;
}

/**
 * Merge a reading into the facts. A list the owner already answered stays as answered unless this step asks
 * about it or is the closing review; free text fills empty facts, and the step's own text is set, extended
 * on a follow-up, or replaced when the owner revisits it.
 */
function mergeAnswer(facts: IntakeFacts, step: IntakeStep, reading: AnswerReading, options: { readonly settled: readonly IntakeField[]; readonly replace: boolean }): IntakeFacts {
  let next = facts;
  for (const key of LIST_KEYS) {
    if (key !== step && options.settled.includes(key)) continue;
    const dropped: readonly string[] = reading.dropped[key];
    const kept = facts[key].filter((value) => !dropped.includes(value));
    next = withList(next, key, unique([...kept, ...reading.facts[key]]));
  }

  const ownTexts: readonly TextKey[] = step === "name" ? ["name", "place"] : step === "kind" ? ["kind", "place"] : step === "what" || step === "week" || step === "voice" ? [step] : [];
  for (const key of TEXT_KEYS) {
    const value = reading.facts[key];
    const current = next[key];
    const isOwn = ownTexts.includes(key);
    if (!value || (current && !isOwn)) continue;
    // A follow-up adds to what the owner already said about what they sell or their week; revisiting replaces it.
    const extend = current && !options.replace && (key === "what" || key === "week") && !current.includes(value);
    next = { ...next, [key]: clip(extend ? `${current} ${value}` : value, TEXT_LIMITS[key]) };
  }
  return next;
}

const AFFIRM = /^(?:(?:yes|yep|yeah|yup|correct|right|perfect|great|good|ok|okay|sure|confirm(?:ed)?|all good|looks (?:right|good|great|fine)|that'?s (?:right|correct|it)|build it|go ahead|let'?s go)[\s,.!]*)+$/i;
const WANTS_CHANGE = /^(?:no|nope|not quite|not really|change(?: something)?|wrong|fix (?:it|something)|edit)[\s,.!]*$/i;

// Words that point at one part of the profile, for "change the tools" and the like.
const FIELD_WORDS: readonly (readonly [RegExp, IntakeField])[] = [
  [/\b(?:name|called|town|city|location)\b/i, "name"],
  [/\b(?:kind|type) of business\b|\bbusiness type\b|\btrade\b/i, "kind"],
  [/\b(?:sell|price|prices|products?|services|menu)\b/i, "what"],
  [/\b(?:reach|find (?:us|me)|channels?)\b/i, "reach"],
  [/\b(?:tools?|software|apps?)\b/i, "tools"],
  [/\b(?:true|facts?|signals?)\b/i, "signals"],
  [/\blanguages?\b/i, "languages"],
  [/\b(?:week|tasks?|chores|jobs)\b/i, "week"],
  [/\b(?:voice|reply|tone|sample)\b/i, "voice"],
];

function fieldNamed(text: string): IntakeField | undefined {
  return FIELD_WORDS.find(([pattern]) => pattern.test(text))?.[1];
}

function hasListFacts(reading: AnswerReading): boolean {
  return LIST_KEYS.some((key) => reading.facts[key].length > 0 || reading.dropped[key].length > 0);
}

/** Merge a correction typed at the review into every list, since the owner is fixing the whole profile. */
function correct(draft: IntakeDraft, step: "confirm" | "change", reading: AnswerReading): IntakeDraft {
  return { ...draft, facts: mergeAnswer(draft.facts, step, reading, { settled: [], replace: false }), review: { stage: "asking" } };
}

function applyConfirm(draft: IntakeDraft, picks: readonly string[] | undefined, reading: AnswerReading): IntakeDraft {
  const pick = picks?.[0];
  if (pick === "yes" || (pick === undefined && AFFIRM.test(reading.text))) return { ...draft, review: { stage: "confirmed" } };
  if (pick === "change" || WANTS_CHANGE.test(reading.text) || reading.intent !== "answer") return { ...draft, review: { stage: "choosing" } };
  if (hasListFacts(reading)) return correct(draft, "confirm", reading);
  const field = fieldNamed(reading.text);
  return { ...draft, review: field ? { stage: "revisiting", field } : { stage: "choosing" } };
}

function applyChange(draft: IntakeDraft, picks: readonly string[] | undefined, reading: AnswerReading): IntakeDraft {
  const pick = picks?.[0];
  if (pick !== undefined && isGapStep(pick)) return { ...draft, review: { stage: "revisiting", field: pick } };
  const field = INTAKE_FIELDS.find((candidate) => candidate === pick) ?? fieldNamed(reading.text);
  if (field) return { ...draft, review: { stage: "revisiting", field } };
  if (hasListFacts(reading)) return correct(draft, "change", reading);
  return draft;
}

// =============================================================================
// Replies
// =============================================================================

const PLAIN_ACKS: readonly string[] = ["Got it.", "Thanks.", "Great.", "Noted."];

/** Labels for facts the answer added outside its own question, for "I also noted ...". */
function newlyNoted(before: IntakeFacts, after: IntakeFacts, step: IntakeStep): string[] {
  const ownTexts: readonly TextKey[] = step === "name" ? ["name", "place"] : step === "kind" ? ["kind", "place"] : [];
  const notes: string[] = [];
  for (const key of ["kind", "place", "name"] as const) {
    const value = after[key];
    if (value && !ownTexts.includes(key) && value !== before[key]) notes.push(value);
  }
  const added = (key: ListKey): string[] => (key === step ? [] : after[key].filter((value) => !has(before[key], value)));
  notes.push(...added("reach"), ...added("tools"), ...after.signals.filter((id) => step !== "signals" && !before.signals.includes(id)).map(signalShort), ...added("languages"));
  return notes.slice(0, 4);
}

/** A short rules-written acknowledgement of an answer. */
function rulesAck(before: IntakeDraft, after: IntakeDraft, step: IntakeField, reading: AnswerReading): string {
  if (reading.intent === "skip") return "No problem, we'll leave that out.";
  const noted = newlyNoted(before.facts, after.facts, step);
  const ownAnswered = step !== "name" || Boolean(after.facts.name);
  if (noted.length > 0) return ownAnswered ? `Got it. I also noted: ${noted.join(", ")}.` : `Got it: ${noted.join(", ")}.`;
  // A re-ask explains itself, so it needs no acknowledgement in front.
  if (after.followUp && !before.followUp) return "";
  return PLAIN_ACKS[INTAKE_FIELDS.indexOf(step) % PLAIN_ACKS.length] ?? "Got it.";
}

/** Write Anchored's next message after an answer: an acknowledgement and the next question, or `null` once confirmed. */
export function composeReply(before: IntakeDraft, after: IntakeDraft, step: IntakeStep, reading: AnswerReading, modelAck?: string): string | null {
  const next = nextQuestion(after);
  if (next === null) return null;
  if (step === "confirm" || step === "change") {
    if (next.field === "change") return next.text;
    return next.field === "confirm" ? `Updated. ${next.text}` : `Sure. ${next.text}`;
  }
  if (step === "sheet") {
    const ack = after.invoiceSheet?.id ? "Got it. I'll read that sheet as soon as your plan is built." : "No problem. You can paste the link in your business chat any time.";
    return [ack, next.field === "confirm" ? "That's everything I need." : "", next.text].filter(Boolean).join(" ");
  }
  if (next.field === "confirm") return `${before.review.stage === "revisiting" ? "Updated." : "That's everything I need."} ${next.text}`;
  // The first gap question gets a line saying why a few more come.
  const lead = isGapStep(next.field) && !isGapStep(step) ? "A few more so your agents get the details right." : "";
  if (step === "listing" || isGapStep(step)) {
    const skipped = reading.intent === "skip" || reading.intent === "none" || (step === "listing" && after.placeId === undefined);
    const ack = skipped ? "No problem, we'll leave that out." : step === "listing" ? "Got it, I'll use your Google listing." : "Got it.";
    return [ack, lead, next.text].filter(Boolean).join(" ");
  }
  const ack = trustedAck(before, after, step, modelAck) ?? rulesAck(before, after, step, reading);
  return [ack, lead, next.text].filter(Boolean).join(" ");
}

/**
 * The model's acknowledgement, when it claims only what happened: none for a vague answer being asked again,
 * and none that thanks the owner for a correction the draft didn't take.
 */
function trustedAck(before: IntakeDraft, after: IntakeDraft, step: IntakeStep, modelAck: string | undefined): string | undefined {
  if (modelAck === undefined || after.followUp?.text === VAGUE_WHAT_TEXT) return undefined;
  const corrected = step !== "what" && before.facts.what !== after.facts.what;
  return /\bcorrect/i.test(modelAck) && !corrected ? undefined : modelAck;
}

/** The first two messages of a new intake. */
export function openingMessages(draft: IntakeDraft): readonly string[] {
  return [
    "Hi, I'm Anchored. I'll ask a few quick questions about your business, one at a time, then show you where AI can take work off your plate. Skip anything you'd rather not answer.",
    nextQuestion(draft)?.text ?? "",
  ];
}

/** How an answer reads in the owner's chat bubble: their words, or the labels of the chips they tapped. */
export function answerText(question: IntakeQuestion, answer: IntakeAnswer): string {
  const labels = (answer.picks ?? []).flatMap((pick) => question.options?.find((option) => option.value === pick)?.label ?? []);
  const typed = normalize(answer.text ?? "");
  if (labels.length === 0 && typed === "") return question.multi ? "None of these" : "Skip";
  return [labels.join(", "), typed].filter(Boolean).join(". ");
}

/** Anchored's closing line once the plan is built. */
export function planReadyText(business: BusinessProfile): string {
  const active = WORKFLOW_IDS.filter((id) => {
    const plan = business.workflows[id];
    return plan !== undefined && plan.rec !== "skip";
  });
  const first = active[0];
  if (first === undefined) return `Your plan for ${business.name} is ready.`;
  const count = active.length === 1 ? "one workflow" : `${active.length} workflows`;
  return `Your plan for ${business.name} is ready. I found ${count} where AI can take work off your plate, starting with ${WORKFLOWS[first].name}.`;
}

// =============================================================================
// Summary and hand-off to the engine
// =============================================================================

/** The value one summary line shows, or `null` when Anchored doesn't know it yet. */
function summaryValue(field: IntakeField, draft: IntakeDraft): string | null {
  const { facts } = draft;
  if (isListStep(field) && facts[field].length === 0 && draft.answeredNone?.includes(field)) return "None";
  switch (field) {
    case "name":
      return [facts.name, facts.place].filter(Boolean).join(", ") || null;
    case "kind":
    case "what":
    case "week":
    case "voice": {
      const value = facts[field];
      return value ? clip(value, 100) : null;
    }
    case "signals":
      return facts.signals.length ? facts.signals.map(signalShort).join(", ") : null;
    default:
      return facts[field].length ? facts[field].join(", ") : null;
  }
}

/** One line per planned question for the "What Anchored knows" card: known, skipped, or still open. */
export function summarize(draft: IntakeDraft): KnownFact[] {
  const planned = INTAKE_FIELDS.map((field): KnownFact => {
    const value = summaryValue(field, draft);
    const state = value !== null ? "known" : draft.settled.includes(field) ? "skipped" : "open";
    return { field, label: FIELD_LABELS[field].summary, value, state };
  });
  return [...planned, ...detailFacts(draft)];
}

/** Turn a finished draft into the onboarding answers the engine reads. Unknown facts stay blank, never guessed. */
export function draftToAnswers(draft: IntakeDraft): OnboardingAnswers {
  const { facts } = draft;
  // `profileFromAnswers` splits the business from its town at the first comma, so a comma inside the name would move words into the town.
  const name = (facts.name ?? "").replace(/,/g, "").trim();
  return {
    name: facts.place ? `${name}, ${facts.place}` : name,
    kind: facts.kind ?? "",
    what: facts.what ?? "",
    week: facts.week ?? "",
    voice: facts.voice ?? "",
    reach: facts.reach,
    tools: facts.tools,
    signals: facts.signals,
    languages: facts.languages,
  };
}

// =============================================================================
// Business chat: changes to a running business
// =============================================================================

/** Changes the owner described in chat: values to add or drop, and text facts to replace. */
export interface FactChanges {
  readonly add: FactLists;
  readonly remove: FactLists;
  readonly texts: Partial<Record<"name" | "place" | "kind" | "voice", string>>;
  /** Profile details the owner stated, such as a new minimum charge. */
  readonly details?: readonly DetailCandidate[];
}

/** What part of a profile one change touched. */
export type ChangeArea = "workflow" | "path" | "reach" | "tool" | "signal" | "language" | "name" | "place" | "kind" | "voice" | "detail";

/** The word each `ChangeArea` shows under a chat reply and in the profile's recent changes. */
export const CHANGE_AREA_LABEL: Readonly<Record<ChangeArea, string>> = {
  workflow: "Workflow",
  path: "Path",
  reach: "Reach",
  tool: "Tool",
  signal: "Fact",
  language: "Language",
  name: "Name",
  place: "Town",
  kind: "Kind",
  voice: "Voice",
  detail: "Profile",
};

/** One visible change to a business profile, as the chat reports it. */
export interface ProfileChange {
  readonly op: "added" | "removed" | "changed";
  readonly area: ChangeArea;
  readonly label: string;
  /** The new value of a changed path or detail, such as "Build" or "$89". */
  readonly to?: string;
}

/** A change set that changes nothing. */
const NO_CHANGES: FactChanges = { add: NO_LISTS, remove: NO_LISTS, texts: {} };

const RENAME =
  /\b(?:renamed|rename)\s+(?:it|us|the (?:business|shop|store|company|restaurant|truck)|our (?:business|shop|store|company|restaurant|truck))\s+(?:to\s+)?["']?(.+?)["']?(?=[.!?]|$)|\b(?:new name is|now called|changed (?:our|the) name to|we're (?:now )?called|we are (?:now )?called)\s+["']?(.+?)["']?(?=[.!?,]|$)/i;
const MOVED = /\b(?:moved|relocated|moving)\s+(?:(?:the|our) (?:shop|store|business|truck|office|restaurant)\s+)?to\s+(.+?)(?=[.!?;]|\s+(?:and|but|so)\b|$)|\b(?:we're|we are)\s+now\s+in\s+(.+?)(?=[.!?;]|\s+(?:and|but|so)\b|$)/i;
const NOW_A = /\b(?:we're|we are|now we're|we became)\s+(?:now\s+)?(?:a|an)\s+/i;
// Words that end a rename sentence without being part of the name: "we're called Brightpath now".
const RENAME_FILLER = /(?:\s+(?:now|these days|instead|going forward|from now on|anymore|officially))+["']?$/i;

/** Read the changes an owner describes, such as "we started doing catering" or "we switched from Clover to Square". */
// Detail statements a chat message can make. Each captures the words that hold the value.
const HOURS_SAID = /\b(?:our )?(?:hours are|hours now|we're open|we are open|open)\s+(.{3,120}?)(?=[.!?]|$)/i;
const PRICE_SAID = /\b(?:charge|charges|price|prices|costs?|is now|are now|now)\b/i;
const MINIMUM_SAID = /\bminimum\b[^.!?,;]*/i;

/** Profile details a chat message states, read by the rules as the owner's own words. */
export function readDetailChanges(text: string): DetailCandidate[] {
  const clean = normalize(text);
  const found: DetailCandidate[] = [];
  const minimum = MINIMUM_SAID.exec(clean)?.[0];
  if (minimum) {
    const candidate = candidateFor("minimumCharge", minimum, "owner", "high");
    if (candidate) found.push(candidate);
  }
  // A minimum's amount isn't a price list line, so read prices from the rest.
  const rest = minimum ? clean.replace(minimum, " ") : clean;
  if (/\$\s?\d/.test(rest) && PRICE_SAID.test(rest)) {
    const candidate = candidateFor("prices", rest, "owner", "high");
    if (candidate) found.push(candidate);
  }
  const hours = HOURS_SAID.exec(clean)?.[1];
  if (hours && /\d/.test(hours)) {
    const candidate = candidateFor("hours", hours, "owner", "high");
    if (candidate) found.push(candidate);
  }
  if (/https?:\/\/\S*(?:g\.page|google)/i.test(clean)) {
    const candidate = candidateFor("reviewLink", clean, "owner", "high");
    if (candidate) found.push(candidate);
  }
  const name = introducedName(clean);
  if (name) found.push({ key: "ownerName", value: name, sourceType: "owner", quote: clip(clean, 240), confidence: "high" });
  return found;
}

export function readChanges(text: string): FactChanges {
  const clean = normalize(text);
  if (clean === "") return NO_CHANGES;
  const { found, dropped } = scanLists(clean, false);
  const rename = RENAME.exec(clean);
  const name = (rename?.[1] ?? rename?.[2])?.replace(RENAME_FILLER, "").replace(/^["']+|["']+$/g, "");
  const moved = MOVED.exec(clean);
  const movedTo = (moved?.[1] ?? moved?.[2] ?? "").trim();
  // "Moved to Square" is a tool change, read above, not a new town.
  const place = movedTo && looksLikePlace(movedTo) && scanLists(movedTo, true).found.tools.length === 0 ? placeCase(movedTo) : undefined;
  const nowA = NOW_A.exec(clean);
  const kind = nowA ? leadingPhrase(clean.slice(nowA.index + nowA[0].length), 6) : "";
  return {
    add: found,
    remove: dropped,
    texts: withoutBlanks({ name: name ? clip(name, TEXT_LIMITS.name) : undefined, place, kind: kind ? capitalize(kind) : undefined }),
    details: readDetailChanges(clean),
  };
}

/** The facts a profile was built from, with the engine's "Not given" placeholders taken out. */
function factsFromProfile(business: BusinessProfile): BusinessFacts {
  const given = (value: string): string | undefined => (value === NOT_GIVEN ? undefined : value);
  return {
    id: business.id,
    name: business.name,
    trade: business.trade,
    tradeKey: business.tradeKey,
    place: given(business.place),
    size: given(business.size),
    seats: business.seats,
    revenue: given(business.revenue),
    customers: given(business.customers),
    languages: business.languages,
    reach: business.reach.filter((way) => way !== NOT_GIVEN),
    tools: business.tools,
    signals: business.signals,
    tasks: business.tasks,
    voice: business.voice,
  };
}

/** Apply `changes` to `facts`: drop removed values, add new ones, and replace changed text. */
function mergeChanges(facts: BusinessFacts, changes: FactChanges): BusinessFacts {
  const list = <T extends string>(current: readonly T[], add: readonly T[], remove: readonly T[]): T[] => unique([...current.filter((value) => !remove.includes(value)), ...add]);
  const { name, place, kind, voice } = changes.texts;
  return {
    ...facts,
    reach: list(facts.reach, changes.add.reach, changes.remove.reach),
    tools: list(facts.tools, changes.add.tools, changes.remove.tools),
    signals: list(facts.signals, changes.add.signals, changes.remove.signals),
    languages: list(facts.languages ?? [], changes.add.languages, changes.remove.languages),
    ...(name ? { name } : {}),
    ...(place ? { place } : {}),
    ...(kind ? { trade: kind, tradeKey: detectTradeKey(kind) } : {}),
    ...(voice ? { voice } : {}),
  };
}

/** Report whether two plans carry the same rules-derived decision. */
function samePlan(a: WorkflowPlan | undefined, b: WorkflowPlan | undefined): boolean {
  return a !== undefined && b !== undefined && a.fit === b.fit && a.rec === b.rec && a.why === b.why;
}

/**
 * Rebuild `business` from its facts with `changes` applied. The id, `builtBy`, researched cards, the
 * owner's plan approval and the jobs they added from the tools page carry over, and a workflow whose rules reasoning didn't change keeps its written text, which may be the model's.
 */
export function applyChanges(business: BusinessProfile, changes: FactChanges): { profile: BusinessProfile; changes: ProfileChange[] } {
  const before = factsFromProfile(business);
  const rebuilt = profileFromFacts(mergeChanges(before, changes), business.builtBy === "claude" ? "claude" : "rules");
  const oldRules = planWorkflows(before);
  const workflows: Partial<Record<WorkflowId, WorkflowPlan>> = {};
  for (const id of WORKFLOW_IDS) {
    const plan = rebuilt.workflows[id];
    const stored = business.workflows[id];
    if (plan === undefined) {
      // No fact put an owner-added job there, so the rebuild alone would drop it.
      if (stored?.addedBy === "owner") workflows[id] = stored;
      continue;
    }
    workflows[id] = stored !== undefined && samePlan(oldRules[id], plan) ? stored : plan;
  }
  const profile: BusinessProfile = {
    ...rebuilt,
    workflows,
    ...(business.cards ? { cards: business.cards } : {}),
    ...(business.lockedCards ? { lockedCards: business.lockedCards } : {}),
    ...(business.planApproval ? { planApproval: business.planApproval } : {}),
    // The engine rebuilds only what the facts decide; what the owner told agents directly stays.
    ...(business.crew ? { crew: business.crew } : {}),
    ...(business.placeId ? { placeId: business.placeId } : {}),
    ...(business.invoiceSheet ? { invoiceSheet: business.invoiceSheet } : {}),
    ...(business.version !== undefined ? { version: business.version } : {}),
    ...detailsAfter(business, changes.details ?? []),
  };
  return { profile, changes: [...describeChanges(business, profile), ...detailChanges(business, profile)] };
}

/** A profile's details and evidence with the owner's chat statements folded in, which they confirmed by saying them. */
function detailsAfter(business: BusinessProfile, said: readonly DetailCandidate[]): Pick<BusinessProfile, "details" | "evidence"> {
  const start: DetailState = { details: business.details ?? {}, evidence: business.evidence ?? {} };
  const merged = confirmAll(mergeCandidates(start, said));
  const any = FIELD_KEYS.some((key) => merged.details[key] !== undefined);
  return any ? { details: merged.details, evidence: merged.evidence } : {};
}

/** One change per detail whose value the chat changed. */
function detailChanges(before: BusinessProfile, after: BusinessProfile): ProfileChange[] {
  return FIELD_KEYS.flatMap((key): ProfileChange[] => {
    const now = after.details?.[key];
    const was = before.details?.[key];
    if (now === undefined || JSON.stringify(now) === JSON.stringify(was)) return [];
    return [{ op: was === undefined ? "added" : "changed", area: "detail", label: FIELDS[key].label, to: clip(detailText(key, now), 80) }];
  });
}

/** Changes to one list, in the order the new list has them. */
function listChanges<T extends string>(area: ChangeArea, before: readonly T[], after: readonly T[], label: (value: T) => string): ProfileChange[] {
  const real = (value: T) => value !== NOT_GIVEN;
  return [
    ...after.filter((value) => real(value) && !before.includes(value)).map((value) => ({ op: "added" as const, area, label: label(value) })),
    ...before.filter((value) => real(value) && !after.includes(value)).map((value) => ({ op: "removed" as const, area, label: label(value) })),
  ];
}

/** List what changed between two versions of a profile: workflows, then facts, then new paths. */
function describeChanges(before: BusinessProfile, after: BusinessProfile): ProfileChange[] {
  const changes: ProfileChange[] = [];
  const paths: ProfileChange[] = [];
  for (const id of WORKFLOW_IDS) {
    const old = before.workflows[id];
    const now = after.workflows[id];
    const name = WORKFLOWS[id].name;
    if (!old && now) changes.push({ op: "added", area: "workflow", label: name });
    else if (old && !now) changes.push({ op: "removed", area: "workflow", label: name });
    else if (old && now && old.rec !== now.rec) paths.push({ op: "changed", area: "path", label: name, to: PATH_OUTCOME[now.rec] });
  }
  const same = (value: string) => value;
  changes.push(
    ...listChanges("reach", before.reach, after.reach, same),
    ...listChanges("tool", before.tools, after.tools, same),
    ...listChanges("signal", before.signals, after.signals, signalShort),
    ...listChanges("language", before.languages, after.languages, same),
  );
  if (before.name !== after.name) changes.push({ op: "changed", area: "name", label: after.name });
  if (before.place !== after.place) changes.push({ op: "changed", area: "place", label: after.place });
  if (before.trade !== after.trade) changes.push({ op: "changed", area: "kind", label: after.trade });
  if (before.voice !== after.voice) changes.push({ op: "changed", area: "voice", label: clip(after.voice, 80) });
  return [...changes, ...paths];
}

const RENAMED_NOUN: Readonly<Partial<Record<ChangeArea, string>>> = { name: "your name", place: "your town", kind: "your kind of business" };

/** Anchored's one- or two-sentence reply saying what a chat message changed. */
export function changeReply(changes: readonly ProfileChange[], businessName: string): string {
  if (changes.length === 0) {
    return `I didn't spot a change to ${businessName} in that. Tell me something like "we started doing catering" or "we switched to Square".`;
  }
  const labels = (op: ProfileChange["op"], areas: readonly ChangeArea[]) => changes.filter((change) => change.op === op && areas.includes(change.area)).map((change) => change.label);
  const added = labels("added", ["workflow"]);
  const removed = labels("removed", ["workflow"]);
  const sentences: string[] = [];
  if (added.length && removed.length) sentences.push(`Added ${listText(added)} to your workflows and took ${listText(removed)} off.`);
  else if (added.length) sentences.push(`Added ${listText(added)} to your workflows.`);
  else if (removed.length) sentences.push(`Took ${listText(removed)} off your workflows.`);

  const factAreas: readonly ChangeArea[] = ["reach", "tool", "signal", "language"];
  const renamed = changes.flatMap((change) => {
    if (change.area === "voice") return ["your voice sample"];
    if (change.area === "detail") return [`${change.label.toLowerCase()} to ${change.to ?? ""}`];
    const noun = RENAMED_NOUN[change.area];
    return noun ? [`${noun} to ${change.label}`] : [];
  });
  const factsAdded = labels("added", factAreas);
  const factsRemoved = labels("removed", factAreas);
  const parts = [factsAdded.length ? `added ${listText(factsAdded)}` : "", factsRemoved.length ? `removed ${listText(factsRemoved)}` : "", renamed.length ? `changed ${listText(renamed)}` : ""].filter(Boolean);
  if (parts.length) sentences.push(`${sentences.length ? "I also updated your profile" : "Updated your profile"}: ${parts.join("; ")}.`);

  // Group path changes by their new path: "Your plan now suggests a new tool for A and B."
  const paths = changes.filter((change) => change.area === "path" && change.to !== undefined);
  const byPath = unique(paths.map((change) => change.to ?? "")).map((to) => `${to} for ${listText(paths.filter((change) => change.to === to).map((change) => change.label))}`);
  if (sentences.length < 2 && byPath.length) sentences.push(`Your plan now suggests ${byPath.join(", and ")}.`);
  return sentences.join(" ");
}
