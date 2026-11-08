import { profileFromFacts } from "@/lib/domain/engine";
import { QUIET_HOURS_RULE } from "@/lib/domain/executor";
import type {
  BusinessFacts,
  BusinessProfile,
  CardDraft,
  PathKind,
  SkillId,
  WorkflowId,
  WorkflowPlan,
} from "@/lib/domain/types";
import { WORKFLOW_IDS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The example business, Linden Street Kitchen, and ten example fact sets
// for the landing page's mapper, led by the HVAC shop and the career coach
// from the team's other two research reports. The example runs its facts through
// `profileFromFacts`, then lays the restaurant research on top: reasons, stakes
// and cards, plus a path `override` only where the research's `why` gives a reason.

/** An example business: onboarding facts plus a picker label. */
export type Example = BusinessFacts & { readonly id: string; readonly label: string };

/** Researched text for one workflow, and a researched path when it differs from the rules. */
interface ResearchedPlan {
  readonly why: string;
  readonly stake: string;
  readonly isNew: boolean;
  /** Replaces the rules' pick. Its reason must be in `why`. */
  readonly override?: { readonly rec?: PathKind; readonly skills?: readonly SkillId[]; readonly tool?: string };
}

/** Everything researched about the example business. */
interface CaseResearch {
  readonly facts: BusinessFacts & { readonly id: string };
  readonly caseStudy: NonNullable<BusinessProfile["caseStudy"]>;
  readonly plans: Partial<Record<WorkflowId, ResearchedPlan>>;
  readonly cards: Partial<Record<SkillId, Omit<CardDraft, "agent" | "skill">>>;
  readonly lockedCards?: NonNullable<BusinessProfile["lockedCards"]>;
}

// =============================================================================
// The example business
// =============================================================================

// The facts are chosen so the rules produce the restaurant research's workflows.
const RESTAURANT_RESEARCH: CaseResearch = {
  facts: {
    id: "restaurant",
    name: "Linden Street Kitchen",
    trade: "Neighborhood restaurant, sit-down and takeout",
    tradeKey: "restaurant",
    place: "Silver Spring, MD",
    size: "7 staff",
    seats: 7,
    revenue: "About $670K a year",
    customers: "Families, the lunch crowd and office orders",
    languages: ["English", "Spanish"],
    reach: ["Walk-ins", "Google", "Delivery apps", "Phone calls"],
    tools: ["Clover", "OpenTable", "DoorDash", "Google Business Profile", "Gmail"],
    signals: ["appointments", "suppliers", "shifts", "catering"],
    tasks: [
      "Check invoices",
      "Answer catering requests",
      "Reply to reviews",
      "Fill shift gaps",
      "Fight delivery refunds",
    ],
    voice: "Thanks for thinking of Linden Street Kitchen!",
  },
  caseStudy: {
    label: "Restaurant",
    stat: "2.8%",
    statText: "median pre-tax margin at full-service restaurants, so one point of food cost is about $6,700 a year here.",
    statSource: "National Restaurant Association, 2026",
    researchedBy: "Ricky Chen",
  },
  plans: {
    calls: {
      isNew: false,
      why: "Buy only if your call log shows volume. A live call can't wait for your tap, so this is a tool, not an agent.",
      stake: "",
      override: { rec: "buy", tool: "certus" },
    },
    books: {
      isNew: false,
      why: "Card fees are the big line here, $9,400 to $19,900 a year by our estimate, and no tool recovers much of them.",
      stake: "",
      override: { rec: "skip" },
    },
    leads: {
      isNew: false,
      why: "Walk-in guests aren't leads. Catering is the one real lead, and it has its own workflow.",
      stake: "",
      override: { rec: "skip" },
    },
    social: {
      isNew: true,
      why: "In one survey, 59% of diners skipped ordering because basic information was missing.",
      stake: "",
    },
    quotes: {
      isNew: false,
      why: "Catering quotes come from your menu and headcount, inside the catering workflow.",
      stake: "",
    },
    invoices: {
      isNew: false,
      why: "Median full-service margin is 2.8%. One point of food cost is about $6,700 a year here.",
      stake: "About $6,700 a year per point of food cost, estimated",
    },
    disputes: {
      isNew: false,
      why: "Delivery refunds come out of each payout unless someone disputes them.",
      stake: "$1,700 to $2,000 a year, chain data",
    },
    noshows: {
      isNew: false,
      why: "Reservation no-shows leave seats empty on your busiest nights. You already pay for OpenTable, so turn on its confirmations and reminders first.",
      stake: "About $16,600 a year in sales before refills, estimated",
    },
    scheduling: {
      isNew: false,
      why: "A free tier covers one location. Anchored won't rebuild scheduling.",
      stake: "",
    },
    reviews: {
      isNew: false,
      why: "Single-location restaurants reply to about 15% of reviews. One more star brought independents 5 to 9% more revenue.",
      stake: "",
    },
    catering: {
      isNew: false,
      why: "Catering orders average $360 to $420, and requests scatter across email, forms and DMs.",
      stake: "About $4,700 a year if one request a month slips, estimated",
    },
  },
  cards: {
    catering: {
      title: "Party of 40 in three weeks, from your catering form",
      body: "Hi Marcus, thanks for thinking of Linden Street Kitchen! For 40 people we offer three packages: a taco bar, bowls with sides, or family-style platters. Which sounds closest? I can send a quote today.",
      reason: "Catering orders average $360 to $420.",
      checks: ["Within your kitchen limit of 60", "No allergy claims", "Sent by email, not text"],
      action: "Send email",
      channel: "email",
      to: "Marcus Reed",
      stake: 420,
    },
    pricewatch: {
      title: "Avocados up $6 a case",
      body: "Your latest produce invoice charges $48 a case, up from $42 on the one before. At 4 cases a week that's $24 a week. Add to your rep list?",
      reason: "Guacamole is still priced from the old cost.",
      checks: ["Invoice lines add up to the total", "Compared with your last invoice on file"],
      action: "Add to rep list",
      channel: "list",
      stake: 1248,
    },
    showup: {
      title: "Table for 6 tonight at 7 p.m., booked by Ana",
      body: "Hi Ana, see you tonight at 7 at Linden Street Kitchen, table for 6. Reply C to confirm or R to change. Reply STOP to opt out.",
      reason: "A no-show by a table for 6 is the night's biggest loss.",
      checks: ["Booked through OpenTable with a phone number", QUIET_HOURS_RULE],
      action: "Send text",
      channel: "sms",
      to: "Ana Ruiz",
    },
    posts: {
      title: "Your Google listing still shows your old hours",
      body: "Draft post: \"New hours start Monday: open 11 to 9, closed Tuesdays. Planning an event? Ask us about catering.\"",
      reason: "Diners skip a place when basic details are wrong.",
      checks: ["You post it yourself", "Hours read from your profile"],
      action: "Copy post",
      channel: "list",
    },
  },
  lockedCards: [
    {
      skill: "catering",
      title: "Allergy question from Ana",
      body: "Ana asked whether the mole has peanuts. Anchored doesn't draft answers to allergy questions. Call her or reply yourself.",
      reason: "An approved guess would become the restaurant's statement.",
      checks: ["Thread locked until you write the reply"],
      action: "I'll handle it",
      channel: "locked",
    },
  ],
};

/** The example business every visitor can explore: Linden Street Kitchen, id `restaurant`. */
export const SAMPLE_BUSINESS: BusinessProfile = fromResearch(RESTAURANT_RESEARCH);

/** Run the researched facts through the rules, then lay the research over the result. */
function fromResearch(research: CaseResearch): BusinessProfile {
  const ruled = profileFromFacts(research.facts);
  for (const id of WORKFLOW_IDS) {
    if (research.plans[id] !== undefined && ruled.workflows[id] === undefined) {
      throw new Error(`Research for \`${research.facts.id}.${id}\` has no workflow from the rules; adjust the case's facts.`);
    }
  }
  const workflows: Partial<Record<WorkflowId, WorkflowPlan>> = {};
  for (const id of WORKFLOW_IDS) {
    const plan = ruled.workflows[id];
    if (plan === undefined) continue;
    const found = research.plans[id];
    workflows[id] =
      found === undefined
        ? plan
        : { ...plan, why: found.why, stake: found.stake, isNew: found.isNew, ...found.override };
  }
  return {
    ...ruled,
    kind: "case",
    builtBy: "case",
    workflows,
    cards: research.cards,
    lockedCards: research.lockedCards,
    caseStudy: research.caseStudy,
  };
}

// =============================================================================
// Examples
// =============================================================================

/** Example businesses for the landing page; each is bare facts the rules engine maps. */
export const EXAMPLES: readonly [Example, ...Example[]] = [
  // From Eric's HVAC research: customers call rather than fill out forms, replacement quotes stall
  // after the visit, and most small shops run Jobber and QuickBooks and sell maintenance agreements.
  {
    id: "hvac",
    label: "HVAC contractor",
    name: "College Park Heating & Air",
    place: "College Park, MD",
    trade: "HVAC contractor",
    tradeKey: "home",
    size: "6 people, 4 trucks",
    seats: 6,
    customers: "Homeowners within 20 miles",
    reach: ["Phone calls", "Google", "Referrals"],
    tools: ["Jobber", "QuickBooks Online", "Google Business Profile"],
    signals: ["quotes", "memberships"],
    languages: ["English", "Spanish"],
  },
  // From Pramukh Bhushan's coaching research: a solo coach sells packages through a discovery call,
  // leads start in DMs and referrals, and Calendly, Stripe and a spreadsheet make up the stack.
  {
    id: "coach",
    label: "Career coach",
    name: "Northpoint Career Coaching",
    place: "Rockville, MD",
    trade: "Career coach",
    tradeKey: "coach",
    size: "Solo",
    seats: 1,
    customers: "Mid-career professionals changing fields",
    reach: ["Instagram or Facebook", "Referrals", "Website form"],
    tools: ["Calendly", "Stripe", "Google Sheets", "Gmail"],
    signals: ["appointments"],
    languages: ["English"],
  },
  {
    id: "dental",
    label: "Dental office",
    name: "Riverside Family Dental",
    place: "Columbia, MD",
    trade: "Dental office",
    tradeKey: "any",
    size: "2 dentists, 6 staff",
    seats: 8,
    customers: "Families in Howard County",
    reach: ["Phone calls", "Website form", "Google", "Referrals"],
    tools: ["QuickBooks Online", "Gmail"],
    signals: ["appointments", "shifts", "licenses"],
    languages: ["English"],
  },
  {
    id: "landscape",
    label: "Landscaper",
    name: "Greenfield Lawn & Landscape",
    place: "Bowie, MD",
    trade: "Landscaping company",
    tradeKey: "home",
    size: "Owner and a crew of 4",
    seats: 5,
    customers: "Homeowners and small offices",
    reach: ["Phone calls", "Referrals", "Google"],
    tools: ["QuickBooks Online", "Paper and phone"],
    signals: ["quotes", "memberships"],
    languages: ["English", "Spanish"],
  },
  {
    id: "salon",
    label: "Hair salon",
    name: "Studio Nine Hair",
    place: "Hyattsville, MD",
    trade: "Hair salon",
    tradeKey: "any",
    size: "5 stylists",
    seats: 5,
    customers: "Regulars and walk-ins",
    reach: ["Instagram or Facebook", "Walk-ins", "Phone calls", "Google"],
    tools: ["Square"],
    signals: ["appointments", "marketing", "licenses", "shifts"],
    languages: ["English"],
  },
  {
    id: "bakery",
    label: "Bakery",
    name: "Rise & Crumb Bakery",
    place: "Frederick, MD",
    trade: "Bakery and cafe",
    tradeKey: "restaurant",
    size: "9 staff",
    seats: 9,
    customers: "Neighbors, commuters and custom cake orders",
    reach: ["Walk-ins", "Instagram or Facebook", "Email", "Google"],
    tools: ["Clover"],
    signals: ["suppliers", "shifts", "catering", "licenses", "marketing"],
    languages: ["English"],
  },
  {
    id: "auto",
    label: "Auto repair",
    name: "Route 1 Auto Care",
    place: "Laurel, MD",
    trade: "Auto repair shop",
    tradeKey: "any",
    size: "3 bays, 5 staff",
    seats: 5,
    customers: "Commuters and local fleets",
    reach: ["Phone calls", "Walk-ins", "Google"],
    tools: ["QuickBooks Online"],
    signals: ["quotes", "suppliers", "licenses"],
    languages: ["English", "Spanish"],
  },
  {
    id: "tutor",
    label: "Tutoring",
    name: "Bright Path Tutoring",
    place: "Silver Spring, MD",
    trade: "Tutoring center",
    tradeKey: "coach",
    size: "Owner and 6 tutors",
    seats: 7,
    customers: "Students and their parents",
    reach: ["Website form", "Referrals", "Email"],
    tools: ["Calendly", "Stripe", "Gmail"],
    signals: ["appointments", "shifts", "marketing"],
    languages: ["English"],
  },
  {
    id: "cleaning",
    label: "Cleaning service",
    name: "Spotless Home Cleaning",
    place: "Annapolis, MD",
    trade: "House cleaning service",
    tradeKey: "home",
    size: "8 cleaners",
    seats: 8,
    customers: "Homeowners on weekly and monthly plans",
    reach: ["Phone calls", "Website form", "Google"],
    tools: ["Paper and phone"],
    signals: ["quotes", "appointments", "shifts", "memberships"],
    languages: ["English", "Spanish"],
  },
  {
    id: "corner",
    label: "Corner store",
    name: "Harbor Mini Mart",
    place: "Baltimore, MD",
    trade: "Corner store",
    tradeKey: "store",
    size: "Owner and 2 relatives",
    seats: 3,
    customers: "Neighbors who come in daily",
    reach: ["Walk-ins"],
    tools: ["Cash register", "Paper and phone"],
    signals: ["suppliers", "snap", "licenses", "shifts"],
    languages: ["English", "Korean"],
  },
];

// =============================================================================
// Lookups
// =============================================================================

/** The rules engine's profile for one example, with id `ex-<id>`. An unknown id falls back to the first example, as the prototype's picker did. */
export function exampleProfile(id: string): BusinessProfile {
  const example = EXAMPLES.find((candidate) => candidate.id === id) ?? EXAMPLES[0];
  return profileFromFacts({ ...example, id: `ex-${example.id}` });
}

/** Report whether `id` names the example business. */
export function isSampleBusinessId(id: string): boolean {
  return id === SAMPLE_BUSINESS.id;
}
