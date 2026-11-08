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
// The three researched case studies (HVAC, restaurant, coaching) and eight
// example businesses. Each case study runs its facts through
// `profileFromFacts`, then lays the research on top: reasons, stakes and
// cards, plus a path `override` only where the research's `why` gives a reason.

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

/** Everything researched about one case study business. */
interface CaseResearch {
  readonly facts: BusinessFacts & { readonly id: string };
  readonly caseStudy: NonNullable<BusinessProfile["caseStudy"]>;
  readonly plans: Partial<Record<WorkflowId, ResearchedPlan>>;
  readonly cards: Partial<Record<SkillId, Omit<CardDraft, "agent" | "skill">>>;
  readonly lockedCards?: NonNullable<BusinessProfile["lockedCards"]>;
}

// =============================================================================
// Case studies
// =============================================================================

// The facts are chosen so the rules produce each case's researched workflows.
const CASE_RESEARCH: readonly CaseResearch[] = [
  {
    facts: {
      id: "hvac",
      name: "College Park Heating & Air",
      trade: "HVAC contractor",
      tradeKey: "home",
      place: "College Park, MD",
      size: "6 people, 4 trucks",
      seats: 6,
      revenue: "About $1M a year",
      customers: "Homeowners within 20 miles",
      languages: ["English"],
      reach: ["Phone calls", "Website form", "Google"],
      tools: ["Jobber", "QuickBooks Online", "Google Business Profile", "Cell phone"],
      signals: ["quotes", "memberships"],
      tasks: [
        "Return missed calls between jobs",
        "Chase replacement quotes",
        "Ask for reviews",
        "Renew maintenance plans",
        "Invoices at night",
      ],
      voice: "Sorry we missed you, this is Dana at College Park Heating & Air.",
    },
    caseStudy: {
      label: "HVAC",
      stat: "$7K to $15K",
      statText: "per replacement quote, and about 20% close before anyone follows up.",
      statSource: "Jobber community forum; ServiceTitan 2025 report, vendor",
      researchedBy: "Eric",
    },
    plans: {
      calls: {
        isNew: false,
        why: "64% of contractors rely mainly on phone calls. A missed call from a paid ad is money already spent.",
        stake: "About $1,600 a month, modeled on 10 missed calls",
      },
      books: { isNew: false, why: "You already pay for QuickBooks. Use what it does before you buy more.", stake: "" },
      leads: {
        isNew: false,
        why: "Web and Local Services Ads leads often wait hours. Replies within an hour qualify far more often.",
        stake: "",
      },
      social: {
        isNew: true,
        why: "Repeat customers bring 39% of revenue, and few shops reach out in the slow season.",
        stake: "Fills shoulder-season slots",
        override: { skills: ["reactivator"] },
      },
      quotes: {
        isNew: false,
        why: "A replacement quote runs $7K to $15K, and about 20% close before anyone follows up.",
        stake: "$14K to $30K a month in sales if 2 more of 10 quotes close, modeled",
        override: { skills: ["closer", "debrief"] },
      },
      reviews: {
        isNew: false,
        why: "Reviews and fast replies feed your Local Services Ads ranking. Google's reply box only answers reviews; Review Asker gets you more of them.",
        stake: "Lowers what each future lead costs",
        override: { rec: "build" },
      },
      memberships: {
        isNew: false,
        why: "72% of shops sell maintenance plans. A healthy program renews 86% or more a year.",
        stake: "$200 per lapsed plan, plus the repairs it brings",
      },
    },
    cards: {
      callback: {
        title: "Missed call at 7:42 p.m. from (301) 555-0192",
        body: "Sorry we missed you, this is College Park Heating & Air. Is your heat or AC fully off, or running but not keeping up? We can come tomorrow at 8 or 10 a.m. Reply STOP to opt out.",
        reason: "Callers who wait often book the next shop on Google.",
        checks: [QUIET_HOURS_RULE, "The caller reached out first", "No price in the text"],
        action: "Send text",
        channel: "sms",
        to: "(301) 555-0192",
      },
      closer: {
        title: "$11,400 heat pump quote to the Okafors, 5 days quiet",
        body: "Hi James, it's Dana at College Park Heating & Air. I can hold Thursday's install slot until Friday. Want me to send the 0% financing option? Reply STOP to opt out.",
        reason: "Touch 2 of 3. Day 5 of your day 1, 5 and 10 plan.",
        checks: ["Financing is on your allowed offers", "Customer has a consent record", "Touch 2 of 3"],
        action: "Send text",
        channel: "sms",
        to: "James Okafor",
        stake: 11400,
      },
      debrief: {
        title: "Mike's voice note from the Henderson job",
        body: "Recommended a new coil, about $1,800. Customer wants to think it over. Create a follow-up for Closer?",
        reason: "Verbal estimates get lost when nobody writes them down.",
        checks: ["Price came from Mike's note, not the model"],
        action: "Create follow-up",
        channel: "list",
        stake: 1800,
      },
      inquiry: {
        title: "New Local Services lead: system down, kids at home",
        body: "Hi Maria, this is Dana at College Park Heating & Air. We can be there today between 3 and 5 p.m. Does that work? Reply STOP to opt out.",
        reason: "A family with a broken system books the first shop that answers.",
        checks: ["Same-day slot is open on your board", "No price in a first reply"],
        action: "Send text",
        channel: "sms",
        to: "Maria Lopez",
      },
      reviewer: {
        title: "Patel job paid this afternoon",
        body: "Thanks for having us out, Priya. If we did right by you, a Google review helps your neighbors find us. I'll send the link next. Reply STOP to opt out.",
        reason: "Reviews feed your Local Services Ads ranking.",
        checks: ["No reward offered for a rating", "Existing customer with consent"],
        action: "Send text",
        channel: "sms",
        to: "Priya Patel",
      },
      reactivator: {
        title: "312 past customers haven't booked in 18 months",
        body: "Hi from College Park Heating & Air! It's been a while since your last tune-up. Reply YES and we'll find you a time. Reply STOP to opt out.",
        reason: "Slow seasons leave trucks idle.",
        checks: ["Only the 118 with written consent", QUIET_HOURS_RULE],
        action: "Send to 118 customers",
        channel: "sms",
        to: "118 customers with consent",
      },
      keeper: {
        title: "14 maintenance plans renew next month",
        body: "Hi, your College Park Heating & Air maintenance plan renews on the 1st. Reply YES to keep your twice-a-year tune-ups. Reply STOP to opt out.",
        reason: "Renewal 30 days out keeps plans from lapsing.",
        checks: ["Plan members with consent", "No new price"],
        action: "Send to 14 members",
        channel: "sms",
        to: "14 plan members",
        stake: 2800,
      },
    },
  },
  {
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
        why: "Card fees are the big line here, $9,400 to $19,900 a year modeled, and no tool recovers much of them.",
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
        stake: "About $6,700 a year per point of food cost, modeled",
      },
      disputes: {
        isNew: false,
        why: "Delivery refunds come out of each payout unless someone disputes them.",
        stake: "$1,700 to $2,000 a year, chain data",
      },
      noshows: {
        isNew: false,
        why: "Reservation no-shows leave seats empty on your busiest nights. You already pay for OpenTable, so turn on its confirmations and reminders first.",
        stake: "About $16,600 a year in sales before refills, modeled",
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
        stake: "About $4,700 a year if one request a month slips, modeled",
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
  },
  {
    facts: {
      id: "coach",
      name: "Northpoint Career Coaching",
      trade: "Career coach",
      tradeKey: "coach",
      place: "Rockville, MD, sessions online",
      size: "Solo",
      seats: 1,
      revenue: "$1,800 per 3-month package",
      customers: "Mid-career professionals changing fields",
      languages: ["English"],
      reach: ["Instagram or Facebook", "Referrals", "Website form"],
      tools: ["Calendly", "Stripe", "Google Sheets", "Gmail"],
      signals: ["appointments", "marketing"],
      tasks: [
        "Reply to DMs between sessions",
        "Chase 'let me think' calls",
        "Discovery call no-shows",
        "Late invoices",
        "Ask for referrals",
      ],
      voice: "Hi! Thanks so much for reaching out.",
    },
    caseStudy: {
      label: "Coaching",
      stat: "7x",
      statText: "as likely to qualify a lead when the reply comes within an hour.",
      statSource: "Harvard Business Review, 2011",
      researchedBy: "Pramukh Bhushan",
    },
    plans: {
      calls: { isNew: false, why: "Leads reach you in DMs and forms, not calls.", stake: "" },
      books: {
        isNew: false,
        why: "Coaches rank invoicing as their top admin task (ICF). Stripe's own reminders read like a bill, so Bookkeeping and Invoicing drafts a nudge in your voice with the amount from Stripe.",
        stake: "",
        override: { rec: "build" },
      },
      leads: {
        isNew: false,
        why: "68% of clients think it over for weeks, and 'let me think about it' rarely gets a follow-up.",
        stake: "Each client saved is $1,800",
        override: { skills: ["inquiry", "callfollow"] },
      },
      social: { isNew: false, why: "You already post. A post drafter can come later.", stake: "" },
      quotes: { isNew: false, why: "Fixed packages, no custom quotes.", stake: "" },
      noshows: {
        isNew: false,
        why: "Discovery calls booked from cold traffic can no-show about half the time. Calendly logs no-shows, but we couldn't confirm its reminders on your plan, so Show-up Keeper sends them with a prep question.",
        stake: "",
        override: { rec: "build" },
      },
      referrals: {
        isNew: true,
        why: "98% of coaching clients referred at least one person in one survey. Programs often end with no ask.",
        stake: "",
      },
    },
    cards: {
      inquiry: {
        title: "New lead from Instagram: Priya, career change",
        body: "Hi Priya! Thanks so much for reaching out. A move out of finance is exactly what I help with. Could you do a 20-minute call Tuesday at 10 a.m. or Wednesday at 4 p.m.?",
        reason: "Replies within the hour qualify far more often.",
        checks: ["Times match your Calendly", "No price in a first reply"],
        action: "Send email",
        channel: "email",
        to: "Priya S.",
      },
      callfollow: {
        title: "Sam said 'let me think' after your call",
        body: "Hi Sam, I enjoyed our call. Here's the 3-month plan we talked about: $1,800, starting with a session in two weeks. Any questions I can answer?",
        reason: "Check-in 2 of 3. Most clients decide over weeks.",
        checks: ["Price matches your package list", "Check-in 2 of 3"],
        action: "Send email",
        channel: "email",
        to: "Sam Ortiz",
        stake: 1800,
      },
      nudger: {
        title: "Jordan's invoice is 9 days late",
        body: "Hi Jordan, a quick nudge on invoice 1042 for $600. If paying online is easier, I'll send the link next. Thanks!",
        reason: "A friendly reminder now beats an awkward one later.",
        checks: ["Amount read from Stripe"],
        action: "Send email",
        channel: "email",
        to: "Jordan Kim",
        stake: 600,
      },
      showup: {
        title: "Discovery call tomorrow at 10 a.m. with Devon",
        body: "Hi Devon, looking forward to our call tomorrow at 10. One question to think about first: what would make the next year a win? Reply R to reschedule.",
        reason: "A prep question gives people a reason to show up.",
        checks: ["Booked through Calendly", "Sent by email"],
        action: "Send email",
        channel: "email",
        to: "Devon Hall",
      },
      referral: {
        title: "Lee finishes the program in two weeks",
        body: "Hi Lee, it's been great working with you. Would you write two lines about your experience, and is there anyone you'd suggest I talk to?",
        reason: "The best time to ask is near the finish.",
        checks: ["No reward tied to a rating"],
        action: "Send email",
        channel: "email",
        to: "Lee Park",
      },
    },
  },
];

/** The researched case studies: `hvac`, `restaurant` and `coach`. */
export const CASE_STUDIES: readonly BusinessProfile[] = CASE_RESEARCH.map(fromResearch);

/** Run a case's facts through the rules, then lay its research over the result. */
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

/** The case study with `id`, or `undefined` if none has it. */
export function caseStudyById(id: string): BusinessProfile | undefined {
  return CASE_STUDIES.find((business) => business.id === id);
}
