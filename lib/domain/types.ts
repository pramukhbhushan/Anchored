// =============================================================================
// Module Overview
// =============================================================================
// Shared domain types for Anchored. Workflows are the "what" (`WorkflowId`),
// each has three paths (`PathKind`), tools are rated on seven checks (`Rating`),
// five core agents run skills on the build path (`CoreAgentId`, `SkillId`),
// onboarding can spawn `NicheAgent`s, and a `BusinessProfile` is the context.
// `ProfileDetails` are the facts agents need beyond onboarding's answers, each
// traced to a quote by `FieldEvidence`; `CrewDecision` says why an agent is on.

// =============================================================================
// Identifiers
// =============================================================================

/** Work AI can take on. The first five are shared by every business; onboarding adds the rest. */
export type WorkflowId =
  | "calls"
  | "books"
  | "leads"
  | "social"
  | "quotes"
  | "invoices"
  | "disputes"
  | "noshows"
  | "scheduling"
  | "reviews"
  | "catering"
  | "snap"
  | "licenses"
  | "memberships"
  | "referrals";

/** How a business covers one workflow. Agents exist only on the `build` path. */
export type PathKind = "turnon" | "buy" | "build" | "skip";

/** Coarse business type used for tool fit. `any` matches tools built for any business. */
export type TradeKey = "home" | "restaurant" | "store" | "coach" | "any";

/** The five core agents every business gets. Each one runs a set of skills. */
export type CoreAgentId = "frontdesk" | "followup" | "books" | "content" | "internal";

/** What an agent can do. The prototype's 17 agents became these skills, plus `brief` and `triage`. */
export type SkillId =
  | "callback"
  | "inquiry"
  | "showup"
  | "catering"
  | "callfollow"
  | "closer"
  | "debrief"
  | "reactivator"
  | "keeper"
  | "referral"
  | "reviewer"
  | "nudger"
  | "pricewatch"
  | "posts"
  | "reviewdrafter"
  | "brief"
  | "triage"
  | "license"
  | "stockcheck";

/** Id of the agent that runs a skill: a core agent, or a niche agent spawned at onboarding (`niche:<slug>`). */
export type AgentRef = CoreAgentId | `niche:${string}`;

/** Facts from onboarding that add workflows. */
export type SignalId =
  | "quotes"
  | "appointments"
  | "suppliers"
  | "shifts"
  | "catering"
  | "snap"
  | "licenses"
  | "memberships"
  | "marketing";

/** Claude model tier an agent runs on, picked by task complexity. */
export type ModelTier = "quick" | "default" | "complex";

/**
 * Where an approved card goes. `locked` cards never send; the owner handles them. `flag` cards never send either:
 * Anchored is asking the owner for a missing fact.
 */
export type Channel = "sms" | "email" | "list" | "locked" | "flag";

// =============================================================================
// Rating: the seven checks from docs/research/corner-stores-and-restaurants-notes/tools_by_job.md
// =============================================================================

export type CheckKey = "connects" | "price" | "charge" | "data" | "start" | "langs" | "proven";
export type CheckStatus = "met" | "partly" | "unknown" | "no";

/** How sure Anchored is of a check: a read vendor page down to "needs pilot data". */
export type Evidence = "page" | "snippet" | "third" | "ours" | "none" | "unchecked" | "pilot";

/** One check result: status, evidence level, and a short reason in plain words. */
export type Check = readonly [status: CheckStatus, evidence: Evidence, note: string];

/** A tool's rating for one business. `total` is 0 to 100, computed in code. */
export interface Rating {
  readonly total: number;
  readonly checks: Readonly<Record<CheckKey, Check>>;
  readonly met: number;
  readonly unknown: number;
}

// =============================================================================
// Catalog
// =============================================================================

/** A tool in the catalog, with the facts its checks read and where they came from. */
export interface Tool {
  readonly id: string;
  readonly name: string;
  readonly maker: string;
  /** Software the tool belongs to. Owning it makes the tool a "turn on" option unless `addon` is set. */
  readonly platform?: string;
  /** Costs extra on top of the platform, so it is a "buy" even for owners of the platform. */
  readonly addon?: boolean;
  readonly workflows: readonly WorkflowId[];
  readonly for: readonly TradeKey[];
  readonly price: string;
  /** Typical monthly cost for a small business, or `null` when only quoted. */
  readonly monthly: number | null;
  readonly perUser?: boolean;
  readonly connects?: readonly string[];
  readonly languages?: readonly string[];
  readonly languageNote?: string;
  readonly checks: {
    readonly price: Check;
    readonly charge: Check;
    readonly data: Check;
    readonly start?: Check;
  };
  /** `true` AI on the job, `false` no AI, `null` not stated. */
  readonly ai: boolean | null;
  readonly source: { readonly url: string | null; readonly label: string };
  readonly checkedOn: string;
}

/** A tool the discovery agent found that a person has not checked yet. */
export interface DiscoveryListing {
  readonly name: string;
  readonly workflow: WorkflowId;
  readonly price: string;
  readonly connects: string;
  readonly data: string;
  readonly contract: string;
  readonly source: string;
  /** The page the discovery agent found it on. Listings from the team's own research have none. */
  readonly url?: string;
  readonly foundOn: string;
  /** The kind of business the discovery agent searched for, such as "hair salon". */
  readonly foundFor?: string;
}

// =============================================================================
// Agents and cards
// =============================================================================

/** A skill: what it reads, may do, never does, and how to set it up. */
export interface SkillDef {
  readonly id: SkillId;
  readonly name: string;
  readonly job: string;
  /** Core agent that runs it, or `null` for skills only a niche agent runs. */
  readonly agent: CoreAgentId | null;
  readonly reads: readonly string[];
  readonly does: readonly string[];
  readonly never: readonly string[];
  readonly tier: ModelTier;
  readonly setup: readonly string[];
}

/** How much an agent may do without a tap. Every agent starts at `every-card`. */
export type ApprovalMode = "every-card";

/** One of the five core agents. */
export interface CoreAgentDef {
  readonly id: CoreAgentId;
  readonly name: string;
  readonly job: string;
  readonly skills: readonly SkillId[];
  /** Runs for every business whatever its paths, such as Internal Communications' daily brief. */
  readonly alwaysOn: boolean;
}

/** A niche agent onboarding spawned for one business. It reuses the core actions and executor rules. */
export interface NicheAgent {
  readonly id: `niche:${string}`;
  readonly name: string;
  readonly job: string;
  readonly skills: readonly SkillId[];
  readonly workflow: WorkflowId;
  /** The onboarding answer that spawned it, in the owner's words. */
  readonly spawnedBecause: string;
  readonly approval: ApprovalMode;
}

/** An agent as a business sees it: a core agent or one of its niche agents, with the skills it runs there. */
export interface ActiveAgent {
  readonly id: AgentRef;
  readonly name: string;
  readonly job: string;
  readonly skills: readonly SkillId[];
  readonly niche: boolean;
  readonly approval: ApprovalMode;
}

/** A drafted action waiting for the owner's tap. */
export interface CardDraft {
  /** Agent that drafted it. `null` only for cards Anchored itself raises. */
  readonly agent: AgentRef | null;
  readonly skill: SkillId | null;
  readonly title: string;
  readonly body: string;
  readonly reason: string;
  readonly checks: readonly string[];
  readonly action: string;
  readonly channel: Channel;
  readonly to?: string;
  /** Dollars riding on this card, when the research gives a figure. */
  readonly stake?: number;
  /** A starter Anchored wrote to show an agent's work, not a reply to a real customer. Absent on real cards. */
  readonly example?: true;
  /** A stable key for the customer this card answers, such as a phone number. One pending card per contact. */
  readonly contact?: string;
  /** Profile fields the draft drew on, so an owner's edit to one of them can update the profile. */
  readonly fieldsUsed?: readonly FieldKey[];
  /** Set when this card moves the conversation to another agent, such as Front Desk handing a price question to Follow-up. */
  readonly handoff?: { readonly to: CoreAgentId; readonly reason: string };
  /** Set on a payment reminder: the invoice it's about, so reminders can be counted and canceled once it's paid. */
  readonly invoice?: InvoiceRef;
}

/** The invoice a payment reminder is about. `key` comes from `invoiceKey` in `lib/domain/invoices.ts`. */
export interface InvoiceRef {
  readonly key: string;
  readonly number?: string;
  /** The customer's name, lowercased, so a payment named only by customer can find its invoice. */
  readonly customer?: string;
  /** In dollars. */
  readonly amount: number;
}

/** A card draft with the stable key that ties it to stored state. */
export interface KeyedCard extends CardDraft {
  readonly key: string;
}

// =============================================================================
// Businesses
// =============================================================================

/** Anchored's plan for one workflow at one business. */
export interface WorkflowPlan {
  readonly fit: 0 | 1 | 2 | 3;
  readonly rec: PathKind;
  readonly why: string;
  readonly stake: string;
  readonly isNew: boolean;
  /** Skills for the build path when they differ from the workflow's defaults. */
  readonly skills?: readonly SkillId[];
  /** Preferred tool for the buy or turn-on path. */
  readonly tool?: string;
}

/** The context layer: everything an agent knows about one business. */
export interface BusinessProfile {
  readonly id: string;
  readonly kind: "case" | "custom";
  readonly builtBy: "case" | "rules" | "claude";
  readonly name: string;
  readonly trade: string;
  readonly tradeKey: TradeKey;
  readonly place: string;
  readonly size: string;
  readonly seats: number;
  readonly revenue: string;
  readonly customers: string;
  readonly languages: readonly string[];
  readonly reach: readonly string[];
  readonly tools: readonly string[];
  readonly signals: readonly SignalId[];
  readonly tasks: readonly string[];
  readonly voice: string;
  readonly workflows: Readonly<Partial<Record<WorkflowId, WorkflowPlan>>>;
  /** Niche agents onboarding spawned for this business. */
  readonly nicheAgents: readonly NicheAgent[];
  /** Researched card bodies that replace the generic template for a skill. */
  readonly cards?: Readonly<Partial<Record<SkillId, Omit<CardDraft, "agent" | "skill">>>>;
  /** Cards that lock a thread for the owner, shown when their skill is chosen. */
  readonly lockedCards?: readonly (Omit<CardDraft, "agent" | "skill"> & { readonly skill: SkillId })[];
  /** The owner's yes to the plan as a whole, or absent while it waits for one. */
  readonly planApproval?: PlanApproval;
  /** Facts the agents need beyond the onboarding answers, such as the owner's own words for customers and prices. */
  readonly details?: ProfileDetails;
  /** Where each detail came from, so every claim an agent makes traces back to a quote. */
  readonly evidence?: Readonly<Partial<Record<FieldKey, FieldEvidence>>>;
  /** Each core agent on or off, with the reason in the owner's terms. */
  readonly crew?: readonly CrewDecision[];
  /** The Google Places id the owner picked at onboarding. Places' other values are kept only once the owner confirms them. */
  readonly placeId?: string;
  /** How many times the profile has been saved. The store sets it; every save keeps a copy in the profile's history. */
  readonly version?: number;
  /** The Google Sheet the owner keeps invoices in, shared with Anchored's service account. Bookkeeping reads it on request. */
  readonly invoiceSheet?: { readonly id: string; readonly connectedAt: string };
  readonly caseStudy?: {
    readonly label: string;
    readonly stat: string;
    readonly statText: string;
    readonly statSource: string;
    readonly researchedBy: string;
  };
}

/** Facts that drive the rules engine for any business. */
export interface BusinessFacts {
  readonly id?: string;
  readonly name: string;
  readonly trade: string;
  readonly tradeKey: TradeKey;
  readonly place?: string;
  readonly size?: string;
  readonly seats?: number;
  readonly revenue?: string;
  readonly customers?: string;
  readonly languages?: readonly string[];
  readonly reach: readonly string[];
  readonly tools: readonly string[];
  readonly signals: readonly SignalId[];
  readonly tasks?: readonly string[];
  readonly voice?: string;
}

/** Answers from the onboarding form. */
export interface OnboardingAnswers {
  readonly name: string;
  readonly kind: string;
  readonly what: string;
  readonly week: string;
  readonly voice: string;
  readonly reach: readonly string[];
  readonly tools: readonly string[];
  readonly signals: readonly SignalId[];
  readonly languages: readonly string[];
}

// =============================================================================
// Profile details, evidence and the crew
// =============================================================================

/** The owner's own words for the people they serve and the work they do, which agents use with customers. */
export interface Vocabulary {
  /** What they call a customer, such as "homeowner", "guest" or "client". */
  readonly customer: string;
  /** What they call one piece of work, such as "service call", "order" or "session". */
  readonly workUnit: string;
  /** What they call a price, such as "estimate", "quote" or "rate". */
  readonly priceTerm: string;
  /** What they call a booking, such as "appointment", "reservation" or "booking". */
  readonly bookingTerm: string;
}

/** How a business sets its prices. */
export type PricingMethod = "menu" | "hourly" | "quote" | "packages";

/** One line of a price list: a fixed price, or a range from `low` to `high`. In dollars. */
export interface PriceItem {
  readonly item: string;
  readonly low: number;
  readonly high?: number;
}

/** What a new lead is, and the step the owner wants next. */
export interface NextStep {
  readonly lead: string;
  readonly step: "book_call" | "send_estimate" | "book_visit" | "other";
}

/** A question customers often ask, with the owner's answer. */
export interface Faq {
  readonly q: string;
  readonly a: string;
}

/** Something the owner wrote before, which agents imitate. */
export interface OwnerExample {
  readonly kind: "quote" | "post" | "message";
  readonly text: string;
}

/** Facts agents need beyond the onboarding answers. Every field is optional: a missing one is a gap to ask about. */
export interface ProfileDetails {
  readonly ownerName?: string;
  readonly vocabulary?: Vocabulary;
  readonly hours?: string;
  readonly pricingMethod?: PricingMethod;
  readonly prices?: readonly PriceItem[];
  /** What makes a price go up or down, such as size or distance. */
  readonly priceDrivers?: readonly string[];
  /** In dollars. */
  readonly minimumCharge?: number;
  /** What counts as urgent, so the owner hears about it right away. */
  readonly urgentCriteria?: readonly string[];
  readonly faqs?: readonly Faq[];
  readonly nextStep?: NextStep;
  readonly reminderFirmness?: "gentle" | "standard" | "firm";
  /** What the owner wants posts to promote. */
  readonly promoteFocus?: readonly string[];
  readonly reviewLink?: string;
  readonly examples?: readonly OwnerExample[];
}

/** One profile detail. `lib/domain/fields.ts` says which agents need each one. */
export type FieldKey = keyof ProfileDetails;

/**
 * Where a fact came from, strongest first: the owner's own words, a document they gave, their Google listing or
 * website, then reviews.
 */
export type SourceType = "owner" | "document" | "listing" | "website" | "reviews";

/** The evidence behind one profile detail. */
export interface FieldEvidence {
  readonly sourceType: SourceType;
  /** The words the value came from, as the source put them. */
  readonly quote: string;
  readonly confidence: "high" | "medium" | "low";
  readonly ownerConfirmed: boolean;
  /** Other sources that disagree, kept so the owner can choose. Never resolved silently. */
  readonly conflicts?: readonly { readonly value: string; readonly sourceType: SourceType; readonly quote: string }[];
}

/** One core agent on or off for a business, with the reason, and the owner's words that led to it when there are any. */
export interface CrewDecision {
  readonly agent: CoreAgentId;
  readonly on: boolean;
  readonly reason: string;
  readonly quote?: string;
}

/** What saved a profile version. */
export type ProfileChangeSource = "onboarding" | "owner" | "chat" | "card_edit";

/** The agent that owns a customer conversation, or `closed` once it is done. */
export type ConversationOwner = Extract<CoreAgentId, "frontdesk" | "followup" | "books"> | "closed";

// =============================================================================
// Choices and the stack
// =============================================================================

/** The path an owner picked for one workflow. */
export type Choice =
  | { readonly path: "turnon" | "buy"; readonly toolId: string }
  | { readonly path: "build"; readonly skills: readonly SkillId[] }
  | { readonly path: "skip" };

export type ChoiceMap = Readonly<Partial<Record<WorkflowId, Choice>>>;

/** When the owner approved the plan, and the pick for each workflow they said yes to. */
export interface PlanApproval {
  /** ISO timestamp. */
  readonly approvedAt: string;
  readonly choices: ChoiceMap;
}

/** The three paths available for one workflow at one business. */
export interface PathOptions {
  readonly owned: readonly Tool[];
  readonly buy: readonly { readonly tool: Tool; readonly rating: Rating }[];
  /** The build path: which agent runs it and with which skills, or `null` when Anchored doesn't build this one. */
  readonly build: { readonly agent: AgentRef; readonly agentName: string; readonly skills: readonly SkillId[] } | null;
}

/** A trade's optional hints for onboarding: suggested answers the owner confirms, never applied on their own. */
export interface TradeHint {
  readonly tradeKey: TradeKey;
  readonly label: string;
  readonly signals: readonly SignalId[];
  readonly reach: readonly string[];
  readonly tools: readonly string[];
}

/** Monthly cost of a stack. Tools the owner already pays for count as zero. */
export interface StackCost {
  readonly tools: number;
  readonly plan: number;
  readonly total: number;
  readonly onQuote: readonly Tool[];
}
