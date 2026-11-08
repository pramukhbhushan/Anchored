import { WORKFLOW_SKILLS } from "@/lib/domain/agents";
import { ensureOptOut, mentionsAllergen, QUIET_HOURS_RULE } from "@/lib/domain/executor";
import type { BusinessProfile, CardDraft, Channel, SkillId, WorkflowId } from "@/lib/domain/types";
import { WORKFLOW_IDS, WORKFLOWS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// Reads an owner's business chat message for a request for work, such as
// "write a post about our new Taco Tuesday" or "text Dana we're running 20
// minutes late". `readRequest` decides in code whether the message asks for
// work and which of the owner's chosen skills drafts it; a message that asks
// for nothing goes on to the profile reader. `requestCard` builds the card that
// lands in Approvals, and `ruleWords` writes its words when no model is set up.
// The model, when there is one, writes only the words.

/** Skills an owner can ask for in chat: the ones whose card is words for a customer or a post. */
export type AskableSkill =
  | "callback"
  | "inquiry"
  | "showup"
  | "catering"
  | "callfollow"
  | "closer"
  | "reactivator"
  | "keeper"
  | "referral"
  | "reviewer"
  | "nudger"
  | "posts"
  | "reviewdrafter";

/** What code reads out of the owner's words, for the card and for the rules' draft. */
export interface RequestDetails {
  /** Who the message goes to, such as "Dana" or "the Lewis family", or `null` when the owner named nobody. */
  readonly recipient: string | null;
  /** Words the owner wants passed along, such as "we're running 20 minutes late". */
  readonly say: string | null;
  /** What it is about, such as "our new Taco Tuesday". */
  readonly about: string | null;
  /** The channel the owner named, or `null` to use the skill's own. */
  readonly channel: "sms" | "email" | null;
  /** The request as the owner put it, without "can you" or "please", for the card's title. */
  readonly ask: string;
}

/** A request one of the owner's agents drafts. */
export interface DraftRequest {
  readonly kind: "draft";
  readonly skill: AskableSkill;
  readonly details: RequestDetails;
}

/** What one chat message asks for. */
export type ChatRequest =
  /** Not a request for work. The profile reader takes it from here. */
  | { readonly kind: "none" }
  | DraftRequest
  /** Work none of the owner's agents does. `planned` says whether `workflow` is in the business's plan. */
  | { readonly kind: "unstaffed"; readonly skill: AskableSkill; readonly workflow: WorkflowId; readonly planned: boolean }
  /** A request that touches allergies, which Anchored never drafts. */
  | { readonly kind: "allergy" }
  /** A request for work Anchored can't tell apart. `offers` are the chosen skills the owner can ask for. */
  | { readonly kind: "unclear"; readonly offers: readonly AskableSkill[] };

/** What the request reader needs to know about the business. */
export type RequestBusiness = Pick<BusinessProfile, "workflows">;

// =============================================================================
// Spotting a request
// =============================================================================

// Polite openings before the verb, which may chain: "hey, can you please".
const LEAD_IN =
  /^(?:(?:hey|hi|hello|ok|okay|so|and|also|now)\b[\s,!.]*)?(?:anchored\b[\s,:]*)?(?:(?:(?:can|could|would|will) you|please|pls|i (?:need|want|would like|'d like) you to|help me|go ahead and|quickly|let'?s)\b[\s,]*)*/i;

// The verbs an owner opens a request with. "Let" only counts as "let <someone> know".
const REQUEST_VERB =
  /^(write|draft|make|create|compose|prepare|put together|send|text|email|e-mail|message|dm|tell|let|reply|respond|answer|remind|post|ask|follow up|follow-up|chase|thank|nudge|invite|announce|promote|share)\b/i;

// "I need a post about..." asks for a draft without a verb up front.
const NEED_A_DRAFT =
  /^(?:i|we) (?:need|want|would like|'d like) (?:a|an|some|the) (?:\w+ ){0,2}?(?:post|text|email|reply|reminder|message|note|caption|follow-up|check-in)s?\b/i;

// A sentence that opens with a verb but states a fact, such as "Email is how customers reach us".
const STATES_A_FACT = /^\S+(?:\s+\S+)?\s+(?:is|are|was|were|has|have|had)\b/i;

// Questions and notes to Anchored itself, not work for an agent.
const ABOUT_ANCHORED = /^(?:tell|show|remind) me\b|^let me\b|^make sure\b/i;

/** A request: its words without "can you" or "please", its verb, and where the words after the verb start. */
interface RequestClause {
  readonly clause: string;
  readonly verb: string;
  readonly afterVerb: number;
}

/** Find the words that ask for work, or `null` when the message asks for none. */
function requestClause(text: string): RequestClause | null {
  const clause = text.replace(/\s+/g, " ").trim().replace(LEAD_IN, "").trim();
  if (clause === "" || ABOUT_ANCHORED.test(clause) || STATES_A_FACT.test(clause)) return null;
  if (NEED_A_DRAFT.test(clause)) return { clause, verb: "write", afterVerb: 0 };
  const match = REQUEST_VERB.exec(clause);
  const verb = match?.[1]?.toLowerCase();
  if (match === null || verb === undefined) return null;
  if (verb === "let" && !/^let\s+\S+(?:\s+\S+){0,2}\s+know\b/i.test(clause)) return null;
  return { clause, verb, afterVerb: match[0].length };
}

// =============================================================================
// Which skill does the work
// =============================================================================

// Each cue points at the skill whose work it names, most specific first; a message can match several.
const SKILL_CUES: readonly { readonly skill: AskableSkill; readonly cue: (text: string) => boolean }[] = [
  { skill: "reviewdrafter", cue: (t) => /\breviews?\b/.test(t) && /\b(?:reply|replies|respond|response|answer|thank)\b/.test(t) },
  { skill: "reviewer", cue: (t) => /\breviews?\b/.test(t) && !/\b(?:reply|replies|respond|response|answer)\b/.test(t) },
  { skill: "posts", cue: (t) => /\bposts?\b(?!-)|\binstagram\b|\bfacebook\b|\bsocial\b|\bcaption\b|\bgoogle (?:listing|profile|post|business)\b|\bannounce(?:ment)?\b|\bpromote\b/.test(t) },
  { skill: "catering", cue: (t) => /\bcater(?:ing|er|ed)?\b|\bevent order\b|\bparty of\b/.test(t) },
  { skill: "nudger", cue: (t) => /\binvoices?\b|\bunpaid\b|\boverdue\b|\bpast due\b|\bpayments?\b|\bowes?\b|\bbalance\b/.test(t) },
  { skill: "closer", cue: (t) => /\b(?:quotes?|estimates?|bids?|proposals?)\b/.test(t) },
  { skill: "keeper", cue: (t) => /\brenew(?:al|als|s|ing)?\b|\bmaintenance plans?\b|\bmemberships?\b/.test(t) },
  { skill: "referral", cue: (t) => /\breferrals?\b|\btestimonials?\b|\brefer\b/.test(t) },
  { skill: "reactivator", cue: (t) => /\b(?:past|old|former) customers\b|\bwin (?:them )?back\b|\bhaven'?t (?:been|come) (?:back|in)\b|\bslow (?:season|week|month)\b|\blapsed\b/.test(t) },
  { skill: "callback", cue: (t) => /\bmissed (?:call|calls|you)\b|\bcall(?:ed|ing)? (?:us |me )?back\b|\bcallback\b|\btext(?:ed)? (?:them |him |her )?back\b|\bvoicemail\b/.test(t) },
  { skill: "callfollow", cue: (t) => /\blet me think\b|\bthink(?:ing)? (?:about it|it over)\b|\bundecided\b|\bon the fence\b/.test(t) },
  { skill: "showup", cue: (t) => /\bremind(?:er|ers)?\b|\bappointments?\b|\bbookings?\b|\breservations?\b|\bconfirm\b|\brunning\b.*\blate\b|\bon (?:our|my) way\b|\breschedul/.test(t) },
  { skill: "inquiry", cue: (t) => /\binquir(?:y|ies)\b|\bleads?\b|\basked (?:about|for|if)\b|\bwebsite form\b/.test(t) },
];

// Verbs that mean a message to one customer, so any agent that writes to customers can take it.
const DIRECT_VERBS = new Set(["send", "text", "email", "e-mail", "message", "dm", "tell", "let", "reply", "respond", "remind", "ask", "thank", "follow up", "follow-up", "chase", "nudge", "invite"]);

// Skills that write to one customer, in the order they take a message no cue points elsewhere.
const ONE_TO_ONE: readonly AskableSkill[] = ["callback", "inquiry", "showup", "callfollow", "closer", "catering", "reviewer", "keeper", "referral", "nudger"];

/** The skills that could do the work, best first. */
function candidateSkills(clause: string, verb: string, recipient: string | null): AskableSkill[] {
  const lower = clause.toLowerCase();
  const cued = SKILL_CUES.filter(({ cue }) => cue(lower)).map(({ skill }) => skill);
  const direct = recipient !== null || DIRECT_VERBS.has(verb);
  // A post or a review reply goes to the public, so no customer-message agent stands in for it.
  const publicOnly = cued.length > 0 && cued.every((skill) => skill === "posts" || skill === "reviewdrafter");
  const fallback = direct && !publicOnly ? ONE_TO_ONE : [];
  return [...new Set([...cued, ...fallback])];
}

// The workflow that brings each skill when nothing in the business's plan does.
const HOME_WORKFLOW: Readonly<Record<AskableSkill, WorkflowId>> = {
  callback: "calls",
  inquiry: "leads",
  showup: "noshows",
  catering: "catering",
  callfollow: "leads",
  closer: "quotes",
  reactivator: "social",
  keeper: "memberships",
  referral: "referrals",
  reviewer: "reviews",
  nudger: "books",
  posts: "social",
  reviewdrafter: "reviews",
};

/** The workflow whose build path brings `skill`: one in the business's plan when it has one. */
function workflowFor(business: RequestBusiness, skill: AskableSkill): { readonly workflow: WorkflowId; readonly planned: boolean } {
  const planned = WORKFLOW_IDS.find((id) => {
    const plan = business.workflows[id];
    if (plan === undefined) return false;
    const skills = plan.skills !== undefined && plan.skills.length > 0 ? plan.skills : WORKFLOW_SKILLS[id];
    return skills.includes(skill);
  });
  if (planned !== undefined) return { workflow: planned, planned: true };
  const home = HOME_WORKFLOW[skill];
  return { workflow: home, planned: false };
}

/** Whether a chosen skill is one the owner can ask for in chat. */
export function isAskable(skill: SkillId): skill is AskableSkill {
  return Object.hasOwn(HOME_WORKFLOW, skill);
}

/**
 * Read what `text` asks for. Code alone decides: only the skills in `chosen` draft, and a request no chosen
 * skill handles names the workflow that would.
 */
export function readRequest(text: string, business: RequestBusiness, chosen: readonly SkillId[]): ChatRequest {
  const found = requestClause(text);
  if (found === null) return { kind: "none" };
  if (mentionsAllergen(text)) return { kind: "allergy" };
  const details = readDetails(found);
  const candidates = candidateSkills(found.clause, found.verb, details.recipient);
  const askable = chosen.filter(isAskable);
  const [first] = candidates;
  if (first === undefined) return { kind: "unclear", offers: askable };
  const skill = candidates.find((candidate) => askable.includes(candidate));
  if (skill !== undefined) return { kind: "draft", skill, details };
  // Name a workflow the owner already has in their plan before one they would have to add.
  const homes = candidates.map((candidate) => ({ skill: candidate, ...workflowFor(business, candidate) }));
  const best = homes.find((home) => home.planned) ?? homes[0] ?? { skill: first, ...workflowFor(business, first) };
  return { kind: "unstaffed", ...best };
}

// =============================================================================
// Reading the details
// =============================================================================

const WORD = String.raw`[A-Za-z][A-Za-z'’.-]*`;
// An email address or phone number comes first, so "sam@example.com" isn't read as the name "sam".
const CONTACT = String.raw`[^\s@]+@[^\s@]+\.[A-Za-z]{2,}|\+?[0-9][0-9 ().-]{6,19}[0-9]`;
// Before a fixed word, as in "let Dana Lewis know", a name may run to three words.
const NAME_BEFORE = String.raw`(${CONTACT}|(?:the\s+)?${WORD}(?:\s+${WORD}){0,2})`;
// Elsewhere the pattern takes one word, and `extendName` adds the capitalized words after it: "Dana Lewis".
const NAME_START = String.raw`(${CONTACT}|(?:the\s+)?${WORD})`;

// Where a recipient sits, tried in order. Each pattern's one group is the name.
const RECIPIENT_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`^let\s+${NAME_BEFORE}\s+know\b`, "i"),
  new RegExp(String.raw`^(?:send|write|draft)\s+${NAME_BEFORE}\s+(?:a|an)\s+(?:quick\s+)?(?:text|email|message|note|reminder|reply)\b`, "i"),
  new RegExp(String.raw`^(?:text|e-?mail|message|dm|tell|remind|ask|thank|nudge|invite|chase)\s+(?:back\s+)?${NAME_START}`, "i"),
  new RegExp(String.raw`^(?:reply|respond|write back|follow[ -]up)\s+(?:to|with)\s+${NAME_START}`, "i"),
  new RegExp(String.raw`\b(?:text|email|message|note|reply|reminder|response|check-in)\s+(?:to|for)\s+${NAME_START}`, "i"),
  new RegExp(String.raw`\breview\s+(?:from|by)\s+${NAME_START}`, "i"),
];

/** Extend a one-word name with the capitalized words after it, and "family", returning where it ends. */
function extendName(clause: string, name: string, end: number): { readonly name: string; readonly end: number } {
  if (/[0-9@]/.test(name)) return { name, end };
  let full = name;
  let at = end;
  // Case matters here: "Dana Lewis" is one name, "Dana we're running late" is a name and a message.
  const capital = /\s+([A-Z][A-Za-z'’.-]*)/y;
  for (capital.lastIndex = at; ; capital.lastIndex = at) {
    const next = capital.exec(clause);
    if (next === null) break;
    full += ` ${next[1]}`;
    at = capital.lastIndex;
  }
  const family = /\s+family\b/iy;
  family.lastIndex = at;
  if (family.exec(clause) !== null) return { name: `${full} family`, end: family.lastIndex };
  return { name: full, end: at };
}

// Words that sit where a name would but aren't one.
const NOT_A_NAME = new Set([
  "a", "an", "the", "me", "us", "them", "him", "her", "it", "this", "that", "these", "those", "our", "my", "your", "their",
  "everyone", "everybody", "all", "customers", "customer", "clients", "client", "people", "folks", "someone", "somebody",
  "anyone", "about", "back", "to", "for", "with", "and", "some", "tomorrow", "today", "tonight", "messages", "message",
  "texts", "emails", "review", "reviews", "quote", "quotes", "invoice", "invoices", "post", "posts", "past", "new", "old",
  "plan", "members", "staff", "team", "on", "in", "at", "up", "out", "know", "again", "regarding",
]);

/** Return the recipient a pattern caught, or `null` when the words there aren't a name. */
function cleanRecipient(raw: string): string | null {
  const name = raw.trim().replace(/[.,!?:;]+$/, "");
  if (/[0-9@]/.test(name)) return name;
  const words = name.split(/\s+/);
  const [head = ""] = words;
  if (head.toLowerCase() === "the") {
    // "the Nguyens" or "the Lewis family" names someone; "the review" doesn't.
    const rest = words.slice(1);
    return rest.length > 0 && /^[A-Z]/.test(rest[0] ?? "") ? `the ${rest.join(" ")}` : null;
  }
  if (NOT_A_NAME.has(head.toLowerCase()) || /['’]s$/i.test(head)) return null;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** Find who the message goes to, with the index where the rest of the request starts. */
function findRecipient(clause: string): { readonly name: string; readonly end: number } | null {
  for (const pattern of RECIPIENT_PATTERNS) {
    const match = pattern.exec(clause);
    const raw = match?.[1];
    if (match === null || raw === undefined) continue;
    // The name group ends the patterns that use `NAME_START`, so the match's end is the name's end.
    const nameEnd = match.index + match[0].length;
    const extended = clause.slice(match.index, nameEnd).endsWith(raw) ? extendName(clause, raw, nameEnd) : { name: raw, end: nameEnd };
    const name = cleanRecipient(extended.name);
    if (name !== null) return { name, end: extended.end };
  }
  return null;
}

// A clause that starts with a subject, so it is words to pass along: "that we're closed Monday".
const SAY_AFTER = /\b(?:that|saying|to say|and say)\s+((?:we|we're|we've|we'll|our|i|i'm|i'll|you|you're|your|they|it|it's|he|she|the|there|this)\b.+)$/i;

/** Read the recipient, the words to pass along and the topic from a request clause. */
function readDetails({ clause, verb, afterVerb }: RequestClause): RequestDetails {
  const recipient = findRecipient(clause);
  const channel = /\b(?:text|sms)\b/i.test(clause) ? "sms" : /\be-?mail\b/i.test(clause) ? "email" : null;
  const rest = clause.slice(recipient === null ? afterVerb : recipient.end);
  const opener = /^\s*[,:-]?\s*(?:that|saying|to say|and say|and tell (?:them|him|her)|and let (?:them|him|her) know)\s+(.+)$/i.exec(rest);
  const about = /\b(?:about|regarding)\s+(.+)$/i.exec(rest);
  const said = SAY_AFTER.exec(rest);
  let say: string | null = opener?.[1] ?? null;
  let topic: string | null = say === null ? (about?.[1] ?? null) : null;
  if (say === null && topic === null) say = said?.[1] ?? null;
  // "text Dana we're running late": after a name, words that don't open with a preposition are the message.
  if (say === null && topic === null && recipient !== null && !/^\s*(?:for|to|on|with|in|at|from|by|a|an|the)\b/i.test(rest)) {
    say = rest.trim() || null;
  }
  // "write a post for Taco Tuesday" names its topic with "for".
  if (say === null && topic === null && recipient === null) topic = /\b(?:post|caption|announcement)s?\s+(?:for|on)\s+(.+)$/i.exec(rest)?.[1] ?? null;
  // "announce our new hours": what follows the verb is the topic.
  if (say === null && topic === null && (verb === "announce" || verb === "promote")) topic = rest.trim() || null;
  return {
    recipient: recipient?.name ?? null,
    say: say === null ? null : tidy(say).slice(0, 300) || null,
    about: topic === null ? null : tidy(topic).slice(0, 200) || null,
    channel,
    ask: titleFrom(clause),
  };
}

const TITLE_MAX = 100;

/** The request as a card title: capitalized, tidied, and cut at a word when it runs long. */
function titleFrom(clause: string): string {
  const title = tidy(clause.charAt(0).toUpperCase() + clause.slice(1));
  if (title.length <= TITLE_MAX) return title;
  const cut = title.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${space > 0 ? cut.slice(0, space) : cut}...`;
}

/** Trim `text` and drop a trailing "please" and closing punctuation. */
function tidy(text: string): string {
  return text.trim().replace(/[\s,]*\bplease\b[.!?]*$/i, "").replace(/[\s.!?,;:]+$/, "").trim();
}

// =============================================================================
// The card
// =============================================================================

/** A drafted card before Anchored stamps it with its agent, skill and key. */
export type RequestCardBody = Omit<CardDraft, "agent" | "skill">;

// The card's own channel for each skill when the owner didn't say text or email.
const SKILL_CHANNEL: Readonly<Record<AskableSkill, Channel>> = {
  callback: "sms",
  inquiry: "email",
  showup: "sms",
  catering: "email",
  callfollow: "email",
  closer: "sms",
  reactivator: "sms",
  keeper: "sms",
  referral: "email",
  reviewer: "sms",
  nudger: "email",
  posts: "list",
  reviewdrafter: "list",
};

/** The channel a requested draft goes out on: what the owner said, unless the skill's work is a post or a review reply. */
export function requestChannel(request: DraftRequest): Channel {
  const own = SKILL_CHANNEL[request.skill];
  return own === "list" ? own : (request.details.channel ?? own);
}

/** The card for a requested draft. `words` are the draft's words, from the model or `ruleWords`. */
export function requestCard(business: Pick<BusinessProfile, "name">, request: DraftRequest, words: string): RequestCardBody {
  const channel = requestChannel(request);
  const { recipient, ask } = request.details;
  const asked = "You asked for it in chat";
  const noFacts = "Adds no number or link you didn't give";
  if (request.skill === "posts") {
    return { title: ask, body: `Draft post for ${business.name}: "${words}"`, reason: "You asked for this post in chat.", checks: [asked, "You post it yourself", noFacts], action: "Copy post", channel };
  }
  if (request.skill === "reviewdrafter") {
    return { title: ask, body: words, reason: "You asked for this reply in chat.", checks: [asked, "You post the reply yourself", noFacts], action: "Copy reply", channel };
  }
  const to = recipient === null ? {} : { to: recipient };
  if (channel === "sms") {
    return { title: ask, body: ensureOptOut(words), reason: "You asked for this text in chat.", checks: [asked, QUIET_HOURS_RULE, noFacts], action: "Send text", channel, ...to };
  }
  return { title: ask, body: words, reason: "You asked for this email in chat.", checks: [asked, noFacts], action: "Send email", channel, ...to };
}

/** Return a chat card's key, tied to the chat reply that drafted it so the reply can link to the card. */
export function chatCardKey(businessId: string, replyId: string): string {
  return `${businessId}:chat:${replyId}`;
}

// =============================================================================
// The rules' draft, when no model is set up
// =============================================================================

// What each skill says when the owner gave no words to pass along. No dates, prices or times, so nothing is invented.
const DEFAULT_LINE: Readonly<Record<AskableSkill, string>> = {
  callback: "Sorry we missed your call. What can we help with?",
  inquiry: "Thanks for reaching out! When is a good time to talk?",
  showup: "A reminder about your upcoming visit. Reply C to confirm or R to reschedule.",
  catering: "Thanks for thinking of us for your event! Which date are you planning for?",
  callfollow: "Good talking with you. Any questions I can answer?",
  closer: "Checking in on the quote we sent. Happy to answer questions or adjust the scope.",
  reactivator: "It's been a while! Reply YES and we'll find you a time.",
  keeper: "Your plan with us is coming up for renewal. Reply YES to keep it.",
  referral: "It's been great working with you. Would you write two lines about your experience, and is there anyone you'd suggest we talk to?",
  reviewer: "Thanks for choosing us! If we did right by you, a Google review helps neighbors find us.",
  nudger: "A quick reminder about your open invoice. Thanks!",
  posts: "Taking new customers this month.",
  reviewdrafter: "Thank you for taking the time to write. We read every review, and we hope to see you again soon.",
};

// How a message about a topic opens: "A reminder about tomorrow at 10."
const ABOUT_LEAD: Partial<Readonly<Record<AskableSkill, string>>> = {
  showup: "A reminder about",
  nudger: "A quick reminder about",
  closer: "Checking in about",
  keeper: "A note about",
};

/** Write a requested draft's words from the owner's own, for when no model is set up or its reply fails the checks. */
export function ruleWords(business: Pick<BusinessProfile, "name" | "reach">, request: DraftRequest): string {
  const { skill, details } = request;
  const { recipient } = details;
  const group = recipient !== null && /^the\s/i.test(recipient);
  // Words about a customer become words to them only when the owner named who gets the message.
  const toThem = (text: string) => (recipient === null ? text : toYou(text, group));
  const say = details.say === null ? null : sentence(toThem(details.say));
  const about = details.about === null ? null : toThem(details.about);
  if (skill === "posts") {
    const close = business.reach.includes("Walk-ins") ? "Stop by this week, or call ahead to book a time." : "Send us a message to find a time.";
    if (say !== null) return `${say} ${close}`;
    return about === null ? `${DEFAULT_LINE.posts} ${close}` : `News from ${business.name}: ${about}. ${close}`;
  }
  const first = recipient === null || group || /[0-9@]/.test(recipient) ? null : (recipient.split(/\s+/)[0] ?? null);
  if (skill === "reviewdrafter") {
    return first === null ? DEFAULT_LINE.reviewdrafter : `Thank you for taking the time to write, ${first}. We read every review, and we hope to see you again soon.`;
  }
  const greeting = first === null ? `Hi, it's ${business.name}.` : `Hi ${first}, it's ${business.name}.`;
  const line = say ?? (about === null ? DEFAULT_LINE[skill] : `${ABOUT_LEAD[skill] ?? "A quick note about"} ${about}.`);
  return `${greeting} ${line}`;
}

/** `text` with a capital first letter and closing punctuation. */
function sentence(text: string): string {
  const capped = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

// Words after "her" that make it an object ("call her tomorrow") rather than a possessive ("her part").
const AFTER_OBJECT_HER = /^(?:tomorrow|today|tonight|back|at|on|in|when|if|and|about|later|soon|by|to|for|with|know|$)/i;

/**
 * Turn what the owner said about the customer into words to the customer: "her part came in" becomes "your part
 * came in". "They" and "their" turn only for a group, such as "the Lewis family", where they mean the recipient.
 */
function toYou(text: string, group: boolean): string {
  let out = text
    .replace(/\b(?:she|he)'s\b/gi, "you're")
    .replace(/\b(?:she|he) is\b/gi, "you are")
    .replace(/\b(?:she|he)\b/gi, "you")
    .replace(/\bhis\b/gi, "your")
    .replace(/\bher\b(\s*)(\S*)/gi, (_m, space: string, next: string) => `${AFTER_OBJECT_HER.test(next) ? "you" : "your"}${space}${next}`);
  if (group) out = out.replace(/\bthey're\b/gi, "you're").replace(/\btheir\b/gi, "your").replace(/\bthey\b/gi, "you").replace(/\bthem\b/gi, "you");
  return out;
}

// =============================================================================
// What Anchored says back
// =============================================================================

/** What the draft is, for the reply: "a text to Dana", "a post". */
export function draftNoun(request: DraftRequest): string {
  const { recipient } = request.details;
  if (request.skill === "posts") return "a post";
  if (request.skill === "reviewdrafter") return recipient === null ? "a reply to the review" : `a reply to ${recipient}'s review`;
  const noun = requestChannel(request) === "sms" ? "a text" : "an email";
  return recipient === null ? noun : `${noun} to ${recipient}`;
}

/** Anchored's reply once `agentName` has drafted the card. */
export function draftedReply(request: DraftRequest, agentName: string): string {
  return `${agentName} drafted ${draftNoun(request)}. It's waiting in Approvals, and nothing goes out until you approve it.`;
}

/** Anchored's reply to a request no agent drafts, in plain words with the next step. */
export function declineReply(request: Exclude<ChatRequest, { kind: "none" } | DraftRequest>): string {
  switch (request.kind) {
    case "allergy":
      return "Anything about allergies comes from you, so Anchored won't draft it. Reply to them yourself.";
    case "unstaffed": {
      const name = WORKFLOWS[request.workflow].name;
      return request.planned
        ? `None of your agents does that yet. It's part of "${name}". Choose Build on it in Workflows, then ask me again.`
        : `None of your agents does that, and "${name}" isn't in your plan yet. Tell me if that's work you do now, and I'll add it.`;
    }
    case "unclear":
      return request.offers.length === 0
        ? "None of your agents drafts anything yet. Choose Build on a workflow in Workflows, then ask me here."
        : `I can have your agents draft ${listText(offerNouns(request.offers))}. Say which, like "${askExample(request.offers)}".`;
  }
}

// How the reply names each skill's work when it lists what the agents can draft.
const OFFER_NOUN: Readonly<Record<AskableSkill, string>> = {
  callback: "a text or email to a customer",
  inquiry: "a text or email to a customer",
  showup: "an appointment reminder",
  catering: "a reply to a catering request",
  callfollow: "a text or email to a customer",
  closer: "a check-in on a quote",
  reactivator: "a note to past customers",
  keeper: "a plan renewal reminder",
  referral: "a referral ask",
  reviewer: "a review request",
  nudger: "a reminder about a late invoice",
  posts: "a post",
  reviewdrafter: "a reply to a review",
};

function offerNouns(offers: readonly AskableSkill[]): string[] {
  return [...new Set(offers.map((skill) => OFFER_NOUN[skill]))];
}

/** Join items as English prose: "a", "a or b", "a, b or c". */
function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

// A request an owner could type for each skill, in the order the chat suggests them.
const ASK_EXAMPLES: readonly { readonly skill: AskableSkill; readonly text: string }[] = [
  { skill: "posts", text: "Write a post about this week's special" },
  { skill: "closer", text: "Follow up on the quote we sent last week" },
  { skill: "callback", text: "Text back the caller we missed this morning" },
  { skill: "inquiry", text: "Reply to the newest inquiry" },
  { skill: "showup", text: "Write a reminder for tomorrow's appointments" },
  { skill: "nudger", text: "Write a reminder about a late invoice" },
  { skill: "reviewdrafter", text: "Write a reply to our latest review" },
  { skill: "reviewer", text: "Ask our last customer for a Google review" },
  { skill: "catering", text: "Reply to the latest catering request" },
  { skill: "keeper", text: "Draft a renewal reminder for plan members" },
  { skill: "referral", text: "Ask a finishing client for a referral" },
  { skill: "callfollow", text: "Follow up after yesterday's 'let me think about it' call" },
  { skill: "reactivator", text: "Write a note to past customers for the slow season" },
];

/** A request the owner could type that one of `chosen` drafts, or a post request when none of them takes requests. */
export function askExample(chosen: readonly SkillId[]): string {
  return ASK_EXAMPLES.find(({ skill }) => chosen.includes(skill))?.text ?? "Write a post about this week's special";
}

/** Whether any of `chosen` takes requests in chat. */
export function takesRequests(chosen: readonly SkillId[]): boolean {
  return chosen.some(isAskable);
}
