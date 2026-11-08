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

/** Why a tier fits the work. Which model runs it depends on the server's AI settings, read as an `AiSetup`. */
export interface ModelTierDef {
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
    reads: ["Missed-call alerts from your forwarded line", "Your hours and service area"],
    does: ["Drafts one text with two open times"],
    never: ["Sends without your tap", "Texts between 8 p.m. and 8 a.m.", "Quotes a price"],
    tier: "quick",
    setup: [
      "Get an Anchored phone number",
      "Turn on conditional call forwarding with your carrier's code, so unanswered calls ring Anchored",
      "Call your own line and let it ring out. The first card appears",
    ],
  },
  inquiry: {
    id: "inquiry",
    name: "Inquiry Responder",
    job: "Replies to new leads with two times to talk",
    agent: "frontdesk",
    reads: ["Your website form, forwarded email and pasted DMs", "Your calendar or booking link"],
    does: ["Drafts a reply in your voice"],
    never: ["Sends without your tap", "Puts a price in a first reply"],
    tier: "default",
    setup: [
      "Point your website form at your Anchored form link",
      "Forward lead emails to your Anchored address",
      "Paste a DM into Anchored when one comes in",
    ],
  },
  showup: {
    id: "showup",
    name: "Show-up Keeper",
    job: "Cuts no-shows with reminders",
    agent: "frontdesk",
    reads: ["Your booking calendar or reservation list"],
    does: ["Drafts reminders 24 hours and 1 hour before"],
    never: ["Texts without consent"],
    tier: "quick",
    setup: ["Connect your calendar or reservation export", "Choose the reminder times"],
  },
  catering: {
    id: "catering",
    name: "Catering Responder",
    job: "Answers catering and event requests",
    agent: "frontdesk",
    reads: ["Your catering form and forwarded email", "Your packages and kitchen limits"],
    does: ["Drafts a reply with three packages", "Follows up on day 1, day 3 and week 1, then stops"],
    never: ["Answers allergy questions", "Texts without consent"],
    tier: "default",
    setup: [
      "Add your packages and the most guests your kitchen can serve",
      "Point your catering form at Anchored, or forward requests",
    ],
  },
  callfollow: {
    id: "callfollow",
    name: "Call Follow-up",
    job: "Checks in after 'let me think about it'",
    agent: "followup",
    reads: ["Calls you mark as undecided"],
    does: ["Drafts check-ins on day 1, 3 and 7"],
    never: ["Sends a fourth check-in"],
    tier: "default",
    setup: ["After a call, tap 'Said let me think' in Anchored"],
  },
  closer: {
    id: "closer",
    name: "Closer",
    job: "Chases quotes that went quiet",
    agent: "followup",
    reads: ["Open quotes from your software or a spreadsheet", "Your allowed offers"],
    does: ["Drafts three touches, then stops", "Marks the quote won or lost"],
    never: ["Offers anything outside your rules", "Sends a fourth touch"],
    tier: "default",
    setup: [
      "Upload open quotes as a CSV, or connect your field software",
      "Pick the offers Closer may mention, such as financing",
    ],
  },
  debrief: {
    id: "debrief",
    name: "Debrief",
    job: "Turns a voice note from the field into a quote follow-up",
    agent: "followup",
    reads: ["Voice notes texted to your Anchored number"],
    does: ["Pulls out the job, price and next step", "Hands the follow-up to Closer"],
    never: ["Contacts a customer by itself"],
    tier: "default",
    setup: ["Add each tech's phone number", "Techs text a 30-second voice note after each visit"],
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
    setup: ["Upload past customers with their consent source", "Pick the season and the offer"],
  },
  keeper: {
    id: "keeper",
    name: "Keeper",
    job: "Renews maintenance plans before they lapse",
    agent: "followup",
    reads: ["Plan list with renewal dates"],
    does: ["Drafts renewal texts 30 days out"],
    never: ["Charges a card", "Texts without consent"],
    tier: "quick",
    setup: ["Upload your plan list with renewal dates"],
  },
  referral: {
    id: "referral",
    name: "Referral Ask",
    job: "Asks finishing customers for a testimonial and a referral",
    agent: "followup",
    reads: ["Program or project end dates"],
    does: ["Drafts the ask two weeks before the end"],
    never: ["Ties a reward to a rating"],
    tier: "quick",
    setup: ["Add end dates for current clients"],
  },
  reviewer: {
    id: "reviewer",
    name: "Review Asker",
    job: "Asks for a Google review after a finished job or visit",
    agent: "followup",
    reads: ["Finished, paid jobs or visits", "Your Google review link"],
    does: ["Drafts one review request"],
    never: ["Offers a reward for a rating", "Writes a review"],
    tier: "quick",
    setup: ["Paste your Google review link", "Mark jobs done in your software or in Anchored"],
  },
  nudger: {
    id: "nudger",
    name: "Payment Nudger",
    job: "Reminds customers about late invoices",
    agent: "books",
    reads: ["Your invoices, from Stripe, QuickBooks or a spreadsheet"],
    does: ["Drafts a friendly reminder"],
    never: ["Charges a card", "Adds late fees on its own"],
    tier: "quick",
    setup: ["Connect Stripe, or upload an invoice list", "Set how many days late counts as late"],
  },
  pricewatch: {
    id: "pricewatch",
    name: "Price Watch",
    job: "Checks supplier invoices against the last price you paid",
    agent: "books",
    reads: ["Photos of paper or PDF invoices"],
    does: ["Checks the invoice math in code", "Flags price rises", "Adds them to your list for the rep"],
    never: ["Contacts a customer", "Changes a shelf or menu price"],
    tier: "default",
    setup: ["Photograph your last two invoices from each supplier", "Confirm the lines Anchored read"],
  },
  posts: {
    id: "posts",
    name: "Post Drafter",
    job: "Drafts social posts and Google listing updates",
    agent: "content",
    reads: ["Your menu, services, hours and specials"],
    does: ["Drafts posts for you to publish"],
    never: ["Posts for you", "Edits your listing without you"],
    tier: "quick",
    setup: ["Paste your website or menu link", "Pick how often you want a draft"],
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
    setup: ["Paste a new review into Anchored"],
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
    job: "Sorts emails you forward and hands each to the right agent",
    agent: "internal",
    reads: ["Emails you forward to your Anchored address"],
    does: ["Hands each email to the right agent as a card"],
    never: ["Replies to anyone on its own", "Reads your inbox directly"],
    tier: "quick",
    setup: ["Forward emails to your Anchored address"],
  },
  license: {
    id: "license",
    name: "License Clerk",
    job: "Keeps every license and renewal on one calendar",
    agent: "internal",
    reads: ["A photo of each license or permit"],
    does: ["Warns you 30 days before a renewal"],
    never: ["Files anything for you"],
    tier: "quick",
    setup: ["Photograph each license and permit"],
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

/** Why each tier fits its work. The model behind it comes from the server's AI settings. */
export const MODEL_TIERS: Readonly<Record<ModelTier, ModelTierDef>> = {
  quick: { why: "Short, routine text, so the fastest model is enough." },
  default: { why: "Writes in your voice about a specific job." },
  complex: { why: "Plans across many records." },
};
