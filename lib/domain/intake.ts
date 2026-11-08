import { detectTradeKey, hintFor, planWorkflows, profileFromFacts, TRADE_HINTS } from "@/lib/domain/engine";
import type { BusinessFacts, BusinessProfile, OnboardingAnswers, SignalId, TradeKey, WorkflowId, WorkflowPlan } from "@/lib/domain/types";
import { LANGUAGE_OPTIONS, NOT_GIVEN, PATH_OUTCOME, REACH_OPTIONS, SIGNALS, TOOL_OPTIONS, WORKFLOW_IDS, WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Chat onboarding and chat updates as pure functions. An `IntakeDraft` holds the
// facts gathered so far; `nextQuestion` picks what to ask, `applyAnswer` reads an
// answer with keyword rules, and `draftToAnswers` hands the result to the engine.
// `readChanges` and `applyChanges` do the same for a running business's chat.

// =============================================================================
// Types
// =============================================================================

/** A planned onboarding question, in asking order. */
export type IntakeField = "name" | "kind" | "what" | "reach" | "tools" | "signals" | "languages" | "week" | "voice";

/** Where an intake stands: a planned question, the closing confirm step, or choosing what to change. */
export type IntakeStep = IntakeField | "confirm" | "change";

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
  | { readonly stage: "revisiting"; readonly field: IntakeField }
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

/** One line of the "What Anchored knows" card. */
export interface KnownFact {
  readonly field: IntakeField;
  readonly label: string;
  readonly value: string | null;
  readonly state: "known" | "skipped" | "open";
}

// =============================================================================
// Constants
// =============================================================================

/** Every planned question in asking order. */
export const INTAKE_FIELDS: readonly IntakeField[] = ["name", "kind", "what", "reach", "tools", "signals", "languages", "week", "voice"];

/** Most follow-ups one intake asks beyond its plan. */
export const MAX_FOLLOW_UPS = 2;

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

/** The chips for one step, or `undefined` for a question answered in words. */
function optionsFor(step: IntakeStep, draft: IntakeDraft): IntakeOption[] | undefined {
  const { facts } = draft;
  const hint = hintFor(`${facts.kind ?? ""} ${facts.what ?? ""} ${facts.name ?? ""}`);
  switch (step) {
    case "kind": {
      const guess = TRADE_HINTS[detectTradeKey(`${facts.name ?? ""} ${facts.what ?? ""}`)].label;
      return rankOptions(KIND_LABELS.map((label) => ({ ...plainOption(label, label), suggested: label === guess })));
    }
    case "reach":
      return listOptions(REACH_OPTIONS, facts.reach, hint.reach);
    case "tools":
      return listOptions(TOOL_OPTIONS, facts.tools, hint.tools);
    case "signals":
      return listOptions(
        SIGNALS.map((signal) => signal.id),
        facts.signals,
        hint.signals,
        (id) => SIGNALS.find((signal) => signal.id === id)?.label ?? id,
      );
    case "languages":
      return listOptions(LANGUAGE_OPTIONS, facts.languages, []);
    case "confirm":
      return [plainOption("yes", "Looks right"), plainOption("change", "Change something")];
    case "change":
      return INTAKE_FIELDS.map((field) => plainOption(field, FIELD_LABELS[field].change));
    default:
      return undefined;
  }
}

function isListStep(step: IntakeStep): step is ListKey {
  return step === "reach" || step === "tools" || step === "signals" || step === "languages";
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
      return "Last one: paste or type a reply you've sent a customer, so drafts sound like you.";
    case "confirm":
      return confirmText(draft);
    case "change":
      return "What should I change?";
  }
}

/** The closing summary the owner confirms before Anchored builds the plan. */
function confirmText(draft: IntakeDraft): string {
  const lines = summarize(draft).flatMap((fact) => (fact.value === null ? [] : [`${fact.label}: ${clip(fact.value, 70)}`]));
  return ["Here's the profile I'll build your plan from.", ...lines, "Does this look right?"].join("\n");
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
  const open = INTAKE_FIELDS.find((field) => needsAsking(draft, field));
  return ask(open ?? "confirm", draft);
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
  return applyFieldAnswer(draft, step, picks, reading);
}

/** Return `draft` with a follow-up for `field`, or `null` when the follow-up budget is spent. */
export function withFollowUp(draft: IntakeDraft, field: IntakeField, text: string): IntakeDraft | null {
  if (draft.followUps >= MAX_FOLLOW_UPS) return null;
  return { ...draft, followUp: { field, text }, followUps: draft.followUps + 1 };
}

function applyFieldAnswer(draft: IntakeDraft, field: IntakeField, picks: readonly string[] | undefined, reading: AnswerReading): IntakeDraft {
  const answeringFollowUp = draft.followUp?.field === field;
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
  const field = INTAKE_FIELDS.find((candidate) => candidate === picks?.[0]) ?? fieldNamed(reading.text);
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
  if (next.field === "confirm") return `${before.review.stage === "revisiting" ? "Updated." : "That's everything I need."} ${next.text}`;
  const ack = modelAck ?? rulesAck(before, after, step, reading);
  return [ack, next.text].filter(Boolean).join(" ");
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
  return INTAKE_FIELDS.map((field) => {
    const value = summaryValue(field, draft);
    const state = value !== null ? "known" : draft.settled.includes(field) ? "skipped" : "open";
    return { field, label: FIELD_LABELS[field].summary, value, state };
  });
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
}

/** What part of a profile one change touched. */
export type ChangeArea = "workflow" | "path" | "reach" | "tool" | "signal" | "language" | "name" | "place" | "kind" | "voice";

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
};

/** One visible change to a business profile, as the chat reports it. */
export interface ProfileChange {
  readonly op: "added" | "removed" | "changed";
  readonly area: ChangeArea;
  readonly label: string;
  /** The new value of a changed path, such as "Build". */
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
 * Rebuild `business` from its facts with `changes` applied. The id, `builtBy`, researched cards and the
 * owner's plan approval carry over, and a workflow whose rules reasoning didn't change keeps its written text, which may be the model's.
 */
export function applyChanges(business: BusinessProfile, changes: FactChanges): { profile: BusinessProfile; changes: ProfileChange[] } {
  const before = factsFromProfile(business);
  const rebuilt = profileFromFacts(mergeChanges(before, changes), business.builtBy === "claude" ? "claude" : "rules");
  const oldRules = planWorkflows(before);
  const workflows: Partial<Record<WorkflowId, WorkflowPlan>> = {};
  for (const id of WORKFLOW_IDS) {
    const plan = rebuilt.workflows[id];
    if (plan === undefined) continue;
    const stored = business.workflows[id];
    workflows[id] = stored !== undefined && samePlan(oldRules[id], plan) ? stored : plan;
  }
  const profile: BusinessProfile = {
    ...rebuilt,
    workflows,
    ...(business.cards ? { cards: business.cards } : {}),
    ...(business.lockedCards ? { lockedCards: business.lockedCards } : {}),
    ...(business.planApproval ? { planApproval: business.planApproval } : {}),
  };
  return { profile, changes: describeChanges(business, profile) };
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
