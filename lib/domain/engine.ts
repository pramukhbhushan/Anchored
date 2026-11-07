import { spawnNicheAgents } from "@/lib/domain/agents";
import { normalizeName } from "@/lib/domain/catalog";
import { pathOptions, type PathContext } from "@/lib/domain/paths";
import type {
  BusinessFacts,
  BusinessProfile,
  OnboardingAnswers,
  PathKind,
  SignalId,
  SkillId,
  TradeHint,
  TradeKey,
  WorkflowId,
  WorkflowPlan,
} from "@/lib/domain/types";
import { TOOL_OPTIONS, WORKFLOW_IDS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The rules engine that maps any business to workflows. `planWorkflows` reads
// how customers reach a business, what it uses and the facts its owner gave,
// then recommends a path per workflow; `profileFromFacts`, `profileFromAnswers`
// and `profileFromSentence` wrap that into a `BusinessProfile`. `TRADE_HINTS`
// are suggestions for the onboarding form only; no function here applies them.

/** Who built an engine profile: the rules alone, or the rules refined by Claude. */
export type EngineAuthor = Exclude<BusinessProfile["builtBy"], "case">;

/** A workflow the rules matched, before a path is recommended. */
interface MatchedWorkflow {
  readonly fit: WorkflowPlan["fit"];
  readonly why: string;
  readonly isNew?: boolean;
  readonly skills?: readonly SkillId[];
}

// =============================================================================
// Workflow rules
// =============================================================================

/** Match a business's facts to workflows and recommend a path for each. Workflows come only from `facts`. */
export function planWorkflows(facts: BusinessFacts): Partial<Record<WorkflowId, WorkflowPlan>> {
  const matched = matchWorkflows(facts);
  const context: PathContext = {
    tools: facts.tools,
    tradeKey: facts.tradeKey,
    languages: facts.languages ?? [],
    workflows: matched,
    nicheAgents: spawnNicheAgents(facts.signals),
  };
  const plans: Partial<Record<WorkflowId, WorkflowPlan>> = {};
  for (const id of WORKFLOW_IDS) {
    const match = matched[id];
    if (match === undefined) continue;
    plans[id] = { ...match, isNew: match.isNew ?? false, stake: "", rec: recommend(context, id, match.fit) };
  }
  return plans;
}

/** Pick a path for one matched workflow: a tool the business owns, then an agent, then a catalog tool. */
function recommend(context: PathContext, workflow: WorkflowId, fit: WorkflowPlan["fit"]): PathKind {
  // A fit of 0 or 1 is too small to act on today.
  if (fit <= 1) return "skip";
  const options = pathOptions(context, workflow);
  if (options.owned.length > 0) return "turnon";
  if (options.build !== null) return "build";
  if (options.buy.length > 0) return "buy";
  return "skip";
}

/** The workflows a business's facts call for, with how well each fits and why. The five base ones always appear. */
function matchWorkflows(facts: BusinessFacts): Partial<Record<WorkflowId, MatchedWorkflow>> {
  const reaches = (way: string): boolean => facts.reach.includes(way);
  const says = (signal: SignalId): boolean => facts.signals.includes(signal);
  // One-way match: the owner's tool name contains the brand, so "QuickBooks Online" counts as QuickBooks.
  const runs = (brand: string): boolean =>
    facts.tools.some((tool) => normalizeName(tool).includes(normalizeName(brand)));
  const leadsArriveInWriting = reaches("Website form") || reaches("Instagram or Facebook") || reaches("Email");
  const bookedOrQuoted = says("quotes") || says("appointments");
  const w: Partial<Record<WorkflowId, MatchedWorkflow>> = {};

  w.calls = reaches("Phone calls")
    ? { fit: 3, why: "Customers reach you by phone. A missed call often turns into a call to someone else." }
    : { fit: 0, why: "Phone calls weren't mentioned. Add them if customers call you." };
  w.books = runs("QuickBooks")
    ? { fit: 2, why: "You already pay for QuickBooks. Use what it does before you buy more." }
    : bookedOrQuoted
      ? { fit: 2, why: "You bill after the work is done, and late invoices need a polite nudge." }
      : { fit: 1, why: "Quotes and bookings weren't mentioned, so there may be little to bill later." };
  w.leads =
    leadsArriveInWriting || says("quotes")
      ? {
          fit: 3,
          why: leadsArriveInWriting
            ? "New inquiries arrive in forms and messages while you're busy."
            : "People ask for prices and wait to hear back.",
        }
      : says("catering")
        ? { fit: 2, why: "Catering and event requests are leads, and each one waits on your reply." }
        : { fit: 1, why: "Forms, messages and quote requests weren't mentioned, so there may be few leads to chase." };
  w.social = says("marketing")
    ? { fit: 1, why: "You already post or advertise. A post drafter can come later." }
    : {
        fit: 2,
        isNew: true,
        why: "Posting and ads weren't mentioned. Short posts and listing updates are a cheap place to start.",
      };
  w.quotes = says("quotes")
    ? { fit: 3, why: "You send quotes, and quotes go quiet when nobody has time to chase them." }
    : { fit: 0, why: "Quotes weren't mentioned. Add them if you write custom quotes." };

  if (says("suppliers")) {
    w.invoices = { fit: 3, why: "You buy from suppliers. Price rises on invoices pass unseen until margins shrink." };
  }
  if (reaches("Delivery apps")) {
    w.disputes = { fit: 2, why: "Delivery apps take refunds out of payouts unless someone disputes them." };
  }
  if (says("appointments")) w.noshows = { fit: 3, why: "Customers book ahead, and a no-show costs you the slot." };
  if (says("shifts")) {
    w.scheduling = { fit: 2, why: "Staff work shifts, and gaps get filled by text at the last minute." };
  }
  if (reaches("Google")) {
    w.reviews = {
      fit: 2,
      // Businesses with booked or quoted work can ask after each job; others reply to reviews as they come.
      skills: [bookedOrQuoted ? "reviewer" : "reviewdrafter"],
      why: "New customers find you on Google, where reviews and replies shape who calls.",
    };
  }
  if (says("catering")) w.catering = { fit: 3, why: "Catering and event requests are worth many single orders." };
  if (says("snap")) {
    w.snap = {
      fit: 3,
      why: "USDA's new SNAP stocking rule took effect Nov 4, 2026. USDA estimated 73% of convenience stores fell short under the proposed rule.",
    };
  }
  if (says("licenses")) w.licenses = { fit: 2, why: "Licenses and permits renew on different calendars." };
  if (says("memberships")) {
    w.memberships = { fit: 2, why: "Plans and memberships lapse when nobody reminds the customer." };
  }
  if (reaches("Referrals") && bookedOrQuoted) {
    w.referrals = {
      fit: 2,
      isNew: true,
      why: "Referrals already bring you work. Asking at the right moment brings more.",
    };
  }
  return w;
}

/** Up to five chores the facts suggest, for owners who didn't list their own. */
function tasksFrom(facts: BusinessFacts): string[] {
  const says = (signal: SignalId): boolean => facts.signals.includes(signal);
  const tasks: string[] = [];
  if (facts.reach.includes("Phone calls")) tasks.push("Return missed calls");
  if (says("quotes")) tasks.push("Write and chase quotes");
  if (says("appointments")) tasks.push("Confirm and reschedule bookings");
  if (says("suppliers")) tasks.push("Check supplier invoices");
  if (says("licenses")) tasks.push("Track license renewals");
  if (says("shifts")) tasks.push("Fill shift gaps");
  if (!says("marketing")) tasks.push("Start posting online");
  return tasks.slice(0, 5);
}

// =============================================================================
// Profiles
// =============================================================================

/** Build a full profile from facts, filling gaps with plain defaults. A new id is minted unless `facts.id` is set. */
export function profileFromFacts(facts: BusinessFacts, builtBy: EngineAuthor = "rules"): BusinessProfile {
  // Blank answers count as missing, so `||` rather than `??` throughout.
  return {
    id: facts.id || freshProfileId(),
    kind: "custom",
    builtBy,
    name: facts.name || "Your business",
    trade: facts.trade || "Small business",
    tradeKey: facts.tradeKey,
    place: facts.place || "Not given",
    size: facts.size || "Not given",
    seats: facts.seats || 3,
    revenue: facts.revenue || "Not given",
    customers: facts.customers || "Not given",
    languages: orDefault(facts.languages, ["English"]),
    reach: orDefault(facts.reach, ["Not given"]),
    tools: orDefault(facts.tools, ["Paper and phone"]),
    signals: facts.signals,
    tasks: orDefault(facts.tasks, tasksFrom(facts)),
    voice: facts.voice || `Thanks for reaching out to ${facts.name || "us"}!`,
    workflows: planWorkflows(facts),
    nicheAgents: spawnNicheAgents(facts.signals),
  };
}

// Matches "crew of 4", "6 staff", "5 stylists" and the like.
const SIZE_PATTERN = /crew of \d+[^,.]*|\d+ (people|staff|employees|stylists|tutors|cleaners)/i;

/** Build a profile from the onboarding form. A comma in the name separates the business from its place. */
export function profileFromAnswers(answers: OnboardingAnswers): BusinessProfile {
  const [name = "", ...place] = answers.name.split(",");
  return profileFromFacts({
    name: name.trim() || "Your business",
    place: place.join(",").trim(),
    trade: answers.kind || "Small business",
    tradeKey: detectTradeKey(`${answers.kind} ${answers.what}`),
    size: answers.what.match(SIZE_PATTERN)?.[0] ?? "Not given",
    seats: 4,
    customers: answers.what.trim() === "" ? undefined : `From your answers: ${clipAtWord(answers.what.trim(), 90)}`,
    reach: answers.reach,
    tools: answers.tools,
    signals: answers.signals,
    languages: answers.languages,
    // "Answer calls and texts" is one task, so only commas and line breaks separate tasks.
    tasks: answers.week
      .split(/[,\r\n]/)
      .map((task) => task.trim())
      .filter((task) => task.length > 3)
      .slice(0, 5),
    voice: answers.voice,
  });
}

// -----------------------------------------------------------------
// One-sentence profiles
// -----------------------------------------------------------------

// Each pattern runs against the lower-cased sentence; order is the order the answers appear on the profile.
const REACH_WORDS: readonly (readonly [RegExp, string])[] = [
  [/call|phone|emergenc|repair|service|clinic|office|appointment|plumb|hvac|contractor/, "Phone calls"],
  [/walk|store|shop|counter|cafe|bakery|truck|market|salon|restaurant|deli|\bbar\b/, "Walk-ins"],
  [/website|online|form|book online/, "Website form"],
  [/instagram|facebook|tiktok|social|\bdm/, "Instagram or Facebook"],
  [/delivery|doordash|uber eats|grubhub/, "Delivery apps"],
  [/email/, "Email"],
  [/referr|word of mouth/, "Referrals"],
];

const SIGNAL_WORDS: readonly (readonly [RegExp, SignalId])[] = [
  [/quote|estimate|bid|project|install|custom|remodel|landscap|contract|repair/, "quotes"],
  [/appointment|book|session|lesson|class|patient|client|groom|salon|tutor|clinic|consult|reserv/, "appointments"],
  [
    /supplier|wholesale|inventory|ingredient|stock|parts|food|bake|bakery|restaurant|truck|store|shop|market|cafe|florist|repair/,
    "suppliers",
  ],
  [/staff|employee|crew|shift|team|cooks?\b|workers/, "shifts"],
  [/cater|event|party|parties|wedding/, "catering"],
  [/snap|ebt/, "snap"],
  [/licen|permit|alcohol|beer|wine|tobacco|lottery|health|food|clinic|salon|truck|daycare|child/, "licenses"],
  [/membership|plan\b|subscription|maintenance/, "memberships"],
  [/instagram|tiktok|\bpost|advertis|\bads\b|marketing/, "marketing"],
];

// These options describe the absence of software, so a sentence can't name them.
const NOT_SOFTWARE: readonly string[] = ["Paper and phone", "Cash register"];

/** Build a profile from one sentence such as "I run a bakery with 9 staff". Signals come from the sentence's own words. */
export function profileFromSentence(text: string): BusinessProfile {
  const lower = text.toLowerCase();
  // Every business can be found on Google, so it always counts as a way in.
  const reach = [...REACH_WORDS.filter(([pattern]) => pattern.test(lower)).map(([, way]) => way), "Google"];
  const signals = SIGNAL_WORDS.filter(([pattern]) => pattern.test(lower)).map(([, signal]) => signal);
  const tools = TOOL_OPTIONS.filter((name) => !NOT_SOFTWARE.includes(name) && lower.includes(firstWord(name)));
  const trade = text
    .replace(/^(i run|we run|i own|we own|i have|we have)\s+/i, "")
    .replace(/^(a|an)\s+/i, "")
    .trim();
  return profileFromFacts({
    name: "Your business",
    trade: trade.charAt(0).toUpperCase() + trade.slice(1, 70),
    tradeKey: detectTradeKey(text),
    reach,
    tools,
    signals,
    seats: 4,
  });
}

/** Lower-cased first word of a software name, which is enough to spot it in a sentence. */
function firstWord(name: string): string {
  const lower = name.toLowerCase();
  const space = lower.indexOf(" ");
  return space === -1 ? lower : lower.slice(0, space);
}

/** `text` cut to at most `max` characters at a word boundary, with "..." when anything was cut. */
function clipAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const lastSpace = text.lastIndexOf(" ", max);
  // A single word longer than `max` has no boundary to cut at, so it is cut mid-word.
  const cut = lastSpace > 0 ? text.slice(0, lastSpace) : text.slice(0, max);
  return `${cut.replace(/[\s,.;:!?-]+$/, "")}...`;
}

/** A fresh `b_` profile id that works in any browser context. */
function freshProfileId(): string {
  // Browsers expose `crypto.randomUUID` only on HTTPS or localhost, so a demo on a LAN address falls back.
  const webCrypto: Partial<Crypto> | undefined = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return `b_${webCrypto.randomUUID()}`;
  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return `b_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  // Unique enough for one page: the server assigns its own id when the business is saved.
  return `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function orDefault<T>(list: readonly T[] | undefined, fallback: readonly T[]): readonly T[] {
  return list !== undefined && list.length > 0 ? list : fallback;
}

// =============================================================================
// Trades and hints
// =============================================================================

// First match wins, so "pest control for restaurants" is home services.
const TRADE_WORDS: readonly (readonly [RegExp, TradeKey])[] = [
  [/hvac|heating|plumb|electric|roof|landscap|lawn|mow|clean|handyman|pest|paint|contractor/, "home"],
  [/restaurant|cafe|coffee|bakery|food|kitchen|diner|pizza|taco|catering|truck/, "restaurant"],
  [/corner store|bodega|deli|mart|grocery|convenience/, "store"],
  [/coach|consult|tutor|trainer|therap|counsel|teacher/, "coach"],
];

/** Guess the coarse business type from free text, or `any` when no trade word appears. */
export function detectTradeKey(text: string): TradeKey {
  const lower = text.toLowerCase();
  return TRADE_WORDS.find(([pattern]) => pattern.test(lower))?.[1] ?? "any";
}

/** Suggested onboarding answers per trade. The form shows them for the owner to confirm; nothing applies them. */
export const TRADE_HINTS: Readonly<Record<TradeKey, TradeHint>> = {
  home: {
    tradeKey: "home",
    label: "Home services",
    signals: ["quotes", "memberships"],
    reach: ["Phone calls", "Google", "Referrals"],
    tools: ["Jobber", "QuickBooks Online"],
  },
  restaurant: {
    tradeKey: "restaurant",
    label: "Restaurant or cafe",
    signals: ["suppliers", "shifts", "catering", "licenses"],
    reach: ["Walk-ins", "Google", "Delivery apps", "Phone calls"],
    tools: ["Clover", "Square", "Toast"],
  },
  store: {
    tradeKey: "store",
    label: "Corner store or market",
    signals: ["suppliers", "licenses", "snap", "shifts"],
    reach: ["Walk-ins"],
    tools: ["Cash register"],
  },
  coach: {
    tradeKey: "coach",
    label: "Coach or consultant",
    signals: ["appointments"],
    reach: ["Instagram or Facebook", "Referrals", "Website form"],
    tools: ["Calendly", "Stripe"],
  },
  any: {
    tradeKey: "any",
    label: "Any small business",
    signals: [],
    reach: ["Phone calls", "Google"],
    tools: [],
  },
};

/** The hint for the trade a description suggests, for the onboarding form to offer. */
export function hintFor(text: string): TradeHint {
  return TRADE_HINTS[detectTradeKey(text)];
}
