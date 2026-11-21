import { OPT_OUT_LINE } from "@/lib/domain/executor";
import type {
  BusinessProfile,
  CoreAgentDef,
  CoreAgentId,
  ModelTier,
  NicheAgent,
  SignalId,
  SkillDef,
  SkillId,
  WorkflowId,
} from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Who does the work on the build path. `SKILLS` holds what each skill reads,
// may do and never does, and names the core agent that runs it; `CORE_AGENTS`
// are the five agents every business gets; `NICHE_TEMPLATES` are agents that
// onboarding spawns for one business through `spawnNicheAgents`; `rulesFor`
// lists the rules every agent here works under.

/** Why a tier fits the work. Which model runs it depends on the business's own AI key, read as an `AiSetup`. */
interface ModelTierDef {
  readonly why: string;
}

/** The AI provider a server runs and its model for each tier. */
export interface AiSetup {
  /** The provider's name for owners, such as "Claude" or "Featherless". */
  readonly label: string;
  readonly models: Readonly<Record<ModelTier, string>>;
}

/** A niche agent onboarding can spawn, and the onboarding fact that spawns it. */
interface NicheTemplate {
  readonly slug: string;
  readonly name: string;
  readonly job: string;
  readonly skills: readonly SkillId[];
  readonly workflow: WorkflowId;
  readonly signal: SignalId;
  /** Why it was spawned, in the owner's words. */
  readonly because: string;
}

// =============================================================================
// Skills
// =============================================================================

/** Every skill, keyed by id, with the core agent that runs it. */
export const SKILLS: Readonly<Record<SkillId, SkillDef>> = {
  callback: {
    id: "callback",
    name: "Callback",
    job: "Texts a caller back after a missed call",
    agent: "frontdesk",
    reads: ["Missed calls that ring through to your Twilio number"],
    does: ["Drafts one text with two open times"],
    never: ["Sends without your tap", "Texts between 8 p.m. and 8 a.m.", "Quotes a price"],
    tier: "quick",
    setup: [
      "Connect your Twilio number on the Connections page",
      "Turn on conditional call forwarding with your carrier's code, so unanswered calls ring your Twilio number",
      "Call your own line and let it ring out. The first card appears",
    ],
  },
  inquiry: {
    id: "inquiry",
    name: "Inquiry Responder",
    job: "Replies to new leads with two times to talk",
    agent: "frontdesk",
    reads: ["Texts customers send your Twilio number", "Leads you tell Anchored about in chat"],
    does: ["Drafts a reply in your voice"],
    never: ["Sends without your tap", "Puts a price in a first reply"],
    tier: "default",
    setup: [
      "Connect your Twilio number on the Connections page, and customers' texts arrive as drafts",
      "For a lead from a form, email or DM, ask in chat, like 'reply to Sam about a quote'",
    ],
  },
  showup: {
    id: "showup",
    name: "Show-up Keeper",
    job: "Cuts no-shows with reminders",
    agent: "frontdesk",
    reads: ["Bookings you tell Anchored about in chat"],
    does: ["Drafts a reminder text"],
    never: ["Texts without consent"],
    tier: "quick",
    setup: ["Ask in chat, like 'remind Maria about tomorrow at 10'", "Reading your booking calendar directly isn't built yet"],
  },
  catering: {
    id: "catering",
    name: "Catering Responder",
    job: "Answers catering and event requests",
    agent: "frontdesk",
    reads: ["Catering requests you tell Anchored about in chat"],
    does: ["Drafts a reply to the request"],
    never: ["Answers allergy questions", "Texts without consent"],
    tier: "default",
    setup: ["Ask in chat, like 'reply to the party of 30 about catering'", "Reading your catering form directly isn't built yet"],
  },
  callfollow: {
    id: "callfollow",
    name: "Call Follow-up",
    job: "Checks in after 'let me think about it'",
    agent: "followup",
    reads: ["Calls you tell Anchored about in chat"],
    does: ["Drafts a check-in"],
    never: ["Sends a fourth check-in"],
    tier: "default",
    setup: ["After a call, ask in chat, like 'follow up with Dana, she said she'd think about it'"],
  },
  closer: {
    id: "closer",
    name: "Closer",
    job: "Chases quotes that went quiet",
    agent: "followup",
    reads: ["Quotes you tell Anchored about in chat"],
    does: ["Drafts a follow-up on the quote"],
    never: ["Offers anything outside your rules", "Sends a fourth touch"],
    tier: "default",
    setup: ["Ask in chat, like 'follow up with the Lewis family on their quote'", "Reading open quotes from your software isn't built yet"],
  },
  debrief: {
    id: "debrief",
    name: "Debrief",
    job: "Turns a voice note from the field into a quote follow-up",
    agent: "followup",
    reads: ["Voice notes from your techs"],
    does: ["Pulls out the job, price and next step", "Hands the follow-up to Closer"],
    never: ["Contacts a customer by itself"],
    tier: "default",
    setup: ["Not built yet: voice notes can't reach Anchored today. Until then, ask Closer in chat"],
  },
  reactivator: {
    id: "reactivator",
    name: "Reactivator",
    job: "Brings past customers back in the slow season",
    agent: "followup",
    reads: ["Past customers who have a consent record"],
    does: ["Drafts a batch you approve once"],
    never: ["Texts anyone without written consent", "Sends a promotion after 8 p.m."],
    tier: "default",
    setup: ["Add past customers and where their texting OK came from on the Connections page", "Ask in chat, like 'invite past customers back for spring'"],
  },
  keeper: {
    id: "keeper",
    name: "Keeper",
    job: "Renews maintenance plans before they lapse",
    agent: "followup",
    reads: ["Renewals you tell Anchored about in chat"],
    does: ["Drafts a renewal text"],
    never: ["Charges a card", "Texts without consent"],
    tier: "quick",
    setup: ["Ask in chat, like 'remind Pat their plan renews next month'", "Reading a plan list with renewal dates isn't built yet"],
  },
  referral: {
    id: "referral",
    name: "Referral Ask",
    job: "Asks finishing customers for a testimonial and a referral",
    agent: "followup",
    reads: ["Customers you name in chat"],
    does: ["Drafts one ask for a testimonial and a referral"],
    never: ["Ties a reward to a rating"],
    tier: "quick",
    setup: ["Ask in chat, like 'ask Jo for a referral'"],
  },
  reviewer: {
    id: "reviewer",
    name: "Review Asker",
    job: "Asks for a Google review after a finished job or visit",
    agent: "followup",
    reads: ["Finished jobs you tell Anchored about in chat"],
    does: ["Drafts one review request"],
    never: ["Offers a reward for a rating", "Writes a review"],
    tier: "quick",
    setup: ["After a finished job, ask in chat, like 'ask the Lewis family for a review'"],
  },
  nudger: {
    id: "nudger",
    name: "Payment Nudger",
    job: "Reminds customers about late invoices",
    agent: "books",
    reads: ["Unpaid invoices from Stripe", "Invoices you tell Anchored about in chat"],
    does: ["Drafts a friendly reminder"],
    never: ["Charges a card", "Adds late fees on its own"],
    tier: "quick",
    setup: ["Connect Stripe on the Connections page, and unpaid invoices arrive as drafts", "Or ask in chat, like 'remind Jordan about invoice 1042'"],
  },
  pricewatch: {
    id: "pricewatch",
    name: "Price Watch",
    job: "Checks supplier invoices against the last price you paid",
    agent: "books",
    reads: ["Supplier invoices"],
    does: ["Checks the invoice math in code", "Flags price rises", "Adds them to your list for the rep"],
    never: ["Contacts a customer", "Changes a shelf or menu price"],
    tier: "default",
    setup: ["Not built yet: Anchored can't read invoice images or PDFs today"],
  },
  posts: {
    id: "posts",
    name: "Post Drafter",
    job: "Drafts social posts and Google listing updates",
    agent: "content",
    reads: ["What you ask it to post about in chat"],
    does: ["Drafts posts for you to publish"],
    never: ["Posts for you", "Edits your listing without you"],
    tier: "quick",
    setup: ["Ask in chat, like 'write a post about our holiday hours'"],
  },
  reviewdrafter: {
    id: "reviewdrafter",
    name: "Review Drafter",
    job: "Drafts replies to reviews you paste in",
    agent: "content",
    reads: ["Reviews you paste"],
    does: ["Drafts a reply that cites one detail"],
    never: ["Posts for you", "Argues with a reviewer"],
    tier: "quick",
    setup: ["Paste a new review into the chat and ask for a reply"],
  },
  brief: {
    id: "brief",
    name: "Daily Brief",
    job: "Sums up what needs you today and what it's worth",
    agent: "internal",
    reads: ["Every agent's cards", "Your stack and what it costs"],
    does: ["Lists the cards waiting for you and the dollars riding on them", "Adds what your stack costs a month"],
    never: ["Sends anything to a customer"],
    tier: "quick",
    setup: ["Nothing to set up. It runs for every business"],
  },
  triage: {
    id: "triage",
    name: "Inbox Triage",
    job: "Puts each email you forward in front of you as a card",
    agent: "internal",
    reads: ["Emails you forward to your Anchored address"],
    does: ["Shows each forwarded email as a card"],
    never: ["Replies to anyone on its own", "Reads your inbox directly"],
    tier: "quick",
    setup: ["Not built yet: forwarded email can't reach Anchored today"],
  },
  license: {
    id: "license",
    name: "License Clerk",
    job: "Keeps every license and renewal on one calendar",
    agent: "internal",
    reads: ["Your licenses and permits"],
    does: ["Warns you 30 days before a renewal"],
    never: ["Files anything for you"],
    tier: "quick",
    setup: ["Not built yet: Anchored can't read license images today"],
  },
  stockcheck: {
    id: "stockcheck",
    name: "Stock Check",
    job: "Counts SNAP staple varieties against the rule text",
    agent: null,
    reads: ["Your taps, category by category"],
    does: ["Lists gaps for the next wholesale run"],
    never: ["Calls its count a USDA determination"],
    tier: "quick",
    setup: ["Tap through the four staple categories once a week"],
  },
};

/** Default skills for each workflow's build path. An empty list means Anchored builds nothing for it. */
export const WORKFLOW_SKILLS: Readonly<Record<WorkflowId, readonly SkillId[]>> = {
  calls: ["callback"],
  books: ["nudger"],
  leads: ["inquiry"],
  social: ["posts"],
  quotes: ["closer"],
  invoices: ["pricewatch"],
  disputes: [],
  noshows: ["showup"],
  scheduling: [],
  reviews: ["reviewdrafter"],
  catering: ["catering"],
  snap: ["stockcheck"],
  licenses: ["license"],
  memberships: ["keeper"],
  referrals: ["referral"],
};

/** Skills an always-on agent runs for every business, whatever paths the owner picks. */
export const STANDING_SKILLS: readonly SkillId[] = ["brief", "triage"];

// =============================================================================
// Core agents
// =============================================================================

/** The five core agents, in display order. Each runs the skills that name it in `SKILLS`. */
export const CORE_AGENTS: Readonly<Record<CoreAgentId, CoreAgentDef>> = {
  frontdesk: coreAgent(
    "frontdesk",
    "Front Desk",
    "Answers first contact: missed calls, new inquiries, bookings and catering requests",
  ),
  followup: coreAgent(
    "followup",
    "Follow-up",
    "Chases what goes quiet: quotes, undecided leads, renewals, reviews and referrals",
  ),
  books: coreAgent("books", "Bookkeeping and Invoicing", "Money in and money out: late invoices and supplier prices"),
  content: coreAgent("content", "Content and Social", "Drafts posts, listing updates and review replies for you to publish"),
  internal: coreAgent(
    "internal",
    "Internal Communications",
    "Keeps you briefed: the daily brief, forwarded email and license renewals",
    true,
  ),
};

/** Build one core agent; its skills come from `SKILLS` so each skill names its agent in one place. */
function coreAgent(id: CoreAgentId, name: string, job: string, alwaysOn = false): CoreAgentDef {
  const skills = Object.values(SKILLS)
    .filter((skill) => skill.agent === id)
    .map((skill) => skill.id);
  return { id, name, job, skills, alwaysOn };
}

// =============================================================================
// Niche agents
// =============================================================================

/** Niche agents onboarding can spawn, one per onboarding fact that calls for its own agent. */
const NICHE_TEMPLATES: readonly NicheTemplate[] = [
  {
    slug: "snap-stock-check",
    name: "SNAP Stock Check",
    job: SKILLS.stockcheck.job,
    skills: ["stockcheck"],
    workflow: "snap",
    signal: "snap",
    because: "You accept SNAP or EBT",
  },
];

/** Spawn the niche agents a business's onboarding facts call for. Each starts at `every-card` approval. */
export function spawnNicheAgents(signals: readonly SignalId[]): NicheAgent[] {
  return NICHE_TEMPLATES.filter((template) => signals.includes(template.signal)).map((template) => ({
    id: `niche:${template.slug}`,
    name: template.name,
    job: template.job,
    skills: template.skills,
    workflow: template.workflow,
    spawnedBecause: template.because,
    approval: "every-card",
  }));
}

// =============================================================================
// Rules
// =============================================================================

/** The rules every agent at a business works under, in plain words, for its profile page. */
export function rulesFor(business: Pick<BusinessProfile, "tradeKey" | "signals">): string[] {
  const rules = [
    "Quiet hours: no texts from 8 p.m. to 8 a.m.",
    "Texts go only to customers who agreed to get them.",
    `Every text ends with "${OPT_OUT_LINE}"`,
  ];
  // `checkSend` holds allergy talk for every business; the profile names the rule only where customers ask.
  if (sellsFood(business)) rules.push("Anything about allergies comes from you. Anchored won't send it.");
  rules.push("No prices or offers outside the ones you allow.");
  return rules;
}

/** Whether a business serves or sells food, so customers may ask it about allergies. */
function sellsFood(business: Pick<BusinessProfile, "tradeKey" | "signals">): boolean {
  const foodTrade = business.tradeKey === "restaurant" || business.tradeKey === "store";
  return foodTrade || business.signals.includes("catering") || business.signals.includes("snap");
}

// =============================================================================
// Model tiers
// =============================================================================

/** Why each tier fits its work. The model behind it comes from the business's own AI key. */
export const MODEL_TIERS: Readonly<Record<ModelTier, ModelTierDef>> = {
  quick: { why: "Short, routine text, so the fastest model is enough." },
  default: { why: "Writes in your voice about a specific job." },
  complex: { why: "Plans across many records." },
};
