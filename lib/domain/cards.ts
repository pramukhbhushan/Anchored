import { QUIET_HOURS_RULE } from "@/lib/domain/executor";
import { activeAgents, agentForSkill, chosenSkills } from "@/lib/domain/paths";
import type { ActiveAgent, BusinessProfile, CardDraft, ChoiceMap, KeyedCard, SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The cards agents draft for the owner to approve. `CARD_TEMPLATES` holds one
// generic card per skill for businesses without researched cards; `draftFeed`
// builds a business's feed from its chosen skills, and `simulateCard` drafts
// one more card as if a new event came in, never repeating the standing draft.

/** A card before Anchored stamps it with the agent and skill that drafted it. */
export type CardBody = Omit<CardDraft, "agent" | "skill">;

/** Skills that draft cards. The daily brief writes the `morningBrief` lines instead of a card. */
export type CardSkill = Exclude<SkillId, "brief">;

/**
 * Draft one generic card. Variant 0 is the standing card in the feed; simulated events pass 1 and up, so
 * they never repeat it. `agents` are the agents at work here; triage hands email only to one of them.
 */
export type CardTemplate = (
  business: Pick<BusinessProfile, "name" | "reach" | "tools">,
  variant: number,
  agents?: readonly ActiveAgent[],
) => CardBody;

// The feed's own card for each skill. `simulateCard` never passes it, so a simulated event can't repeat it.
const STANDING_VARIANT = 0;

/** This variant's option: variant 0 takes `standing`, and simulated variants cycle through `simulated`. */
function pick<T>(variant: number, standing: T, ...simulated: readonly [T, ...T[]]): T {
  if (variant === STANDING_VARIANT) return standing;
  // Positive modulo, so a negative variant still lands on a simulated option.
  const index = (((variant - 1) % simulated.length) + simulated.length) % simulated.length;
  // `index` is always in range; the fallback only satisfies `noUncheckedIndexedAccess`.
  return simulated[index] ?? simulated[0];
}

/** Where a new inquiry arrives, from the first written channel the owner named, or `null` when they named none. */
function inquiryChannel(business: Pick<BusinessProfile, "reach">): string | null {
  if (business.reach.includes("Website form")) return "from your website";
  if (business.reach.includes("Instagram or Facebook")) return "on social media";
  if (business.reach.includes("Email")) return "by email";
  return null;
}

/** Whether the owner said customers find them on Google or that they keep a Google Business Profile. */
function usesGoogle(business: Pick<BusinessProfile, "reach" | "tools">): boolean {
  return business.reach.includes("Google") || business.tools.includes("Google Business Profile");
}

// =============================================================================
// Templates
// =============================================================================

/** One generic card per skill, used when a business has no researched card for it. */
export const CARD_TEMPLATES: Readonly<Record<CardSkill, CardTemplate>> = {
  callback: (b, v) => {
    const caller = pick(v, "(410) 555-0137", "(443) 555-0182", "(240) 555-0164");
    return {
      title: `Missed call at ${pick(v, "2:15 p.m.", "4:40 p.m.", "11:05 a.m.")} from ${caller}`,
      body: `Sorry we missed you, this is ${b.name}. What can we help with? We can call you back at ${pick(v, "4 p.m. or 5:30 p.m. today", "9 a.m. or 11 a.m. tomorrow", "1 p.m. or 3 p.m. today")}, or reply with a better time. Reply STOP to opt out.`,
      reason: "Callers who wait often try someone else.",
      checks: [QUIET_HOURS_RULE, "The caller reached out first", "No price in the text"],
      action: "Send text",
      channel: "sms",
      to: caller,
    };
  },
  inquiry: (b, v) => {
    const name = pick(v, "Sam", "Alex", "Morgan");
    const channel = inquiryChannel(b);
    return {
      // Name only a channel the owner said they have, so a business with no website never sees one.
      title: channel === null ? `New inquiry from ${name}` : `New inquiry ${channel}: ${name}`,
      body: `Hi ${name}, thanks for reaching out to ${b.name}! Could we talk ${pick(v, "tomorrow at 10 a.m. or 3 p.m.", "Thursday at 9 a.m. or Friday at 1 p.m.", "Monday at 11 a.m. or 2 p.m.")}?`,
      reason: "Replies within the hour qualify far more often.",
      checks: ["Times match your calendar", "No price in a first reply"],
      action: "Send email",
      channel: "email",
      to: pick(v, "Sam Patel", "Alex Rivera", "Morgan Lee"),
    };
  },
  showup: (b, v) => {
    const time = pick(v, "10 a.m.", "2:30 p.m.", "4 p.m.");
    const name = pick(v, "Maria", "Devon", "Kim");
    return {
      title: `Booking tomorrow at ${time} with ${name}`,
      body: `Hi ${name}, a reminder of your visit with ${b.name} tomorrow at ${time}. Reply C to confirm or R to reschedule. Reply STOP to opt out.`,
      reason: "A reminder the day before saves the slot.",
      checks: [QUIET_HOURS_RULE, "Booked customer with consent"],
      action: "Send text",
      channel: "sms",
      to: pick(v, "Maria Lopez", "Devon Hall", "Kim Tran"),
    };
  },
  catering: (b, v) => {
    const guests = pick(v, "30", "45", "60");
    return {
      title: `Party of ${guests} asked about catering`,
      body: `Hi ${pick(v, "Marcus", "Tina", "Rosa")}, thanks for thinking of ${b.name}! For ${guests} people we have three packages. Which date are you planning for?`,
      reason: "One catering order is worth many single orders.",
      checks: ["No allergy claims", "Sent by email, not text"],
      action: "Send email",
      channel: "email",
      to: pick(v, "Marcus Reed", "Tina Cho", "Rosa Alvarez"),
    };
  },
  callfollow: (b, v) => {
    const name = pick(v, "Sam", "Lee", "Jamie");
    return {
      title: `${name} said 'let me think' after your call`,
      body: `Hi ${name}, good talking the other day. Any questions I can answer about getting started with ${b.name}?`,
      reason: "Check-in 2 of 3.",
      checks: ["Check-in 2 of 3", "No new offer added"],
      action: "Send email",
      channel: "email",
      to: pick(v, "Sam Ortiz", "Lee Park", "Jamie Wells"),
    };
  },
  closer: (b, v) => ({
    title: `Quote to the ${pick(v, "Lewis", "Moreno", "Shah")} family, 5 days quiet`,
    body: `Hi ${pick(v, "Dana", "Luis", "Anika")}, it's ${b.name}. Checking in on the quote we sent last week. Happy to answer questions or adjust the scope. Reply STOP to opt out.`,
    reason: "Touch 2 of 3. Quotes stall without a nudge.",
    checks: ["Customer has a consent record", "No new offer added", "Touch 2 of 3"],
    action: "Send text",
    channel: "sms",
    to: pick(v, "Dana Lewis", "Luis Moreno", "Anika Shah"),
  }),
  debrief: (_b, v) => ({
    title: `Voice note from ${pick(v, "today's visit", "this morning's visit", "the last job")}`,
    body: `The customer wants a price for the work we looked at and asked for it by ${pick(v, "Friday", "Monday", "Wednesday")}. Create a follow-up so it doesn't get lost?`,
    reason: "Prices given in person get lost when nobody writes them down.",
    checks: ["Details came from your note, not the model"],
    action: "Create follow-up",
    channel: "list",
  }),
  reactivator: (b, v) => {
    const count = pick(v, 38, 24, 51);
    return {
      title: `${count} past customers haven't been back in a year`,
      body: `Hi, it's ${b.name}. ${pick(v, "It's been a while!", "We'd love to see you again.", "We have openings coming up.")} Reply YES and we'll find you a time. Reply STOP to opt out.`,
      reason: "Past customers already know you.",
      checks: ["Only customers with written consent", QUIET_HOURS_RULE],
      action: `Send to ${count} customers`,
      channel: "sms",
      to: `${count} customers with consent`,
    };
  },
  keeper: (b, v) => ({
    title: pick(v, "9 plans renew next month", "4 plans renew mid-month", "6 plans renew at the end of the month"),
    body: `Hi, your plan with ${b.name} renews ${pick(v, "on the 1st", "on the 15th", "at the end of the month")}. Reply YES to keep it. Reply STOP to opt out.`,
    reason: "Renewal 30 days out keeps plans from lapsing.",
    checks: ["Plan members with consent", "No new price"],
    action: "Send to plan members",
    channel: "sms",
    to: "Plan members",
  }),
  referral: (_b, v) => {
    const name = pick(v, "Lee", "Robin", "Taylor");
    return {
      title: `${name} finishes in two weeks`,
      body: `Hi ${name}, it's been great working with you. Would you write two lines about your experience, and is there anyone you'd suggest we talk to?`,
      reason: "The best time to ask is near the finish.",
      checks: ["No reward tied to a rating"],
      action: "Send email",
      channel: "email",
      to: pick(v, "Lee Park", "Robin Diaz", "Taylor Nash"),
    };
  },
  // No business profile holds a review link yet, so the text promises it instead of leaving a blank to fill.
  reviewer: (b, v) => ({
    title: `Visit finished for the ${pick(v, "Nguyens", "Carters", "Garcias")}`,
    body: `Thanks for choosing ${b.name}, ${pick(v, "Linh", "Ray", "Elena")}! If we did right by you, a Google review helps neighbors find us. I'll send the link next. Reply STOP to opt out.`,
    reason: "Ask while the visit is fresh.",
    checks: ["No reward offered for a rating", "Existing customer with consent"],
    action: "Send text",
    channel: "sms",
    to: pick(v, "Linh Nguyen", "Ray Carter", "Elena Garcia"),
  }),
  // No business profile holds a payment link yet, so the email promises it instead of leaving a blank to fill.
  nudger: (b, v) => {
    const invoice = pick(v, "1042", "1057", "1063");
    return {
      title: `Invoice ${invoice} is 9 days late`,
      body: `Hi ${pick(v, "Jordan", "Casey", "Riley")}, a quick reminder about invoice ${invoice} from ${b.name}. If paying online is easier, I'll send the link next. Thanks!`,
      reason: "A friendly reminder now beats an awkward one later.",
      checks: ["Amount read from your invoice"],
      action: "Send email",
      channel: "email",
      to: pick(v, "Jordan Kim", "Casey Brooks", "Riley Chen"),
      stake: pick(v, 240, 410, 180),
    };
  },
  pricewatch: (_b, v) => ({
    title: `An item on your supplier invoice went up ${pick(v, "8%", "12%", "5%")}`,
    body: `Your latest invoice charges ${pick(v, "$27.00", "$44.80", "$31.50")} for an item that cost ${pick(v, "$25.00", "$40.00", "$30.00")} last time. The invoice math checks out. Add it to your list for the rep?`,
    reason: "Price rises pass unseen until margins shrink.",
    checks: ["Invoice lines add up to the total", "Compared with your last invoice on file"],
    action: "Add to rep list",
    channel: "list",
  }),
  // Google listing posts only for a business that said it uses Google. No profile holds hours, so no post states them.
  posts: (b, v) =>
    usesGoogle(b)
      ? {
          title: pick(
            v,
            "Your Google listing hasn't changed in 3 months",
            "Customers check your Google listing before they visit",
            "Your Google listing has no recent photos",
          ),
          body: `Draft post for ${b.name}: "${pick(v, "Stop by this week, or call ahead to book a time.", "Planning a visit? Check our listing for this week's hours before you stop by.", "A look at what we've been working on. Stop by and say hi.")}"`,
          reason: "Customers skip a business when basic details are missing.",
          checks: ["You post it yourself", "No prices or offers in the post"],
          action: "Copy post",
          channel: "list",
        }
      : {
          title: pick(v, "Nothing posted in 3 weeks", "A short post for this week", "Show customers what's new"),
          body: `Draft post for ${b.name}: "${pick(v, "Stop by this week, or call ahead to book a time.", "Thanks to everyone who came by this week. See you soon.", "A look at what we've been working on. Stop by and say hi.")}"`,
          reason: "A short, regular post keeps you in front of customers.",
          checks: ["You post it yourself", "No prices or offers in the post"],
          action: "Copy post",
          channel: "list",
        },
  reviewdrafter: (_b, v) => ({
    title: "New 4-star review mentions a long wait",
    body: `Thanks for the kind words, ${pick(v, "Chris", "Dana", "Pat")}, and you're right about the wait. We're adding help at our busiest hours. Hope to see you again soon.`,
    reason: "Generic replies put readers off, so the draft cites one detail.",
    checks: ["Cites one detail from the review", "No discount offered"],
    action: "Copy reply",
    channel: "list",
  }),
  triage: (_b, _v, agents = []) => {
    // A supplier price list is Price Watch's work. Without an agent here running it, the email goes to the owner.
    const handler = agents.find((agent) => agent.skills.includes("pricewatch"));
    return {
      title: "Forwarded email: new price list from your supplier",
      body:
        handler === undefined
          ? "None of your agents checks supplier prices, so this one is yours to read."
          : `${handler.name} will compare it with your last invoices and flag any price that went up.`,
      reason: "Each forwarded email goes to the agent that handles that work, or to you when none does.",
      checks: ["Read from an email you forwarded", "No reply sent to anyone"],
      action: handler === undefined ? "Add it to your list" : `Route to ${handler.name}`,
      channel: "list",
    };
  },
  license: (_b, v) => ({
    title: pick(v, "A license renews in 30 days", "A permit renews in 45 days", "A certificate renews in 60 days"),
    body: "The photo is on file. Add a renewal reminder for Monday morning?",
    reason: "A lapse can shut down part of the business.",
    checks: ["Date read from your license photo"],
    action: "Add to calendar",
    channel: "list",
  }),
  stockcheck: () => ({
    title: "Staples check before your next wholesale run",
    body: "Dairy: 5 of 7 varieties by your count. Add two to the next run? This count is not a USDA determination. Rule text checked Nov 7, 2026.",
    reason: "The SNAP stocking rule took effect Nov 4, 2026.",
    checks: ["Counted from your taps"],
    action: "Add to run list",
    channel: "list",
  }),
};

/** Whether `skill` drafts cards, so it has a template. */
function hasTemplate(skill: SkillId): skill is CardSkill {
  return skill !== "brief";
}

// =============================================================================
// Feed
// =============================================================================

/** The feed: one card per chosen skill, locked cards whose skill is chosen, then one inbox triage card. */
export function draftFeed(business: BusinessProfile, choices: ChoiceMap): KeyedCard[] {
  const skills = chosenSkills(business, choices);
  const feed: KeyedCard[] = skills.filter(hasTemplate).map((skill) => ({
    ...(business.cards?.[skill] ?? CARD_TEMPLATES[skill](business, STANDING_VARIANT)),
    agent: agentForSkill(business, skill),
    skill,
    key: `${business.id}:${skill}`,
  }));
  // `i` counts every locked card, chosen or not, so a card keeps its key when other skills change.
  business.lockedCards?.forEach((card, i) => {
    if (skills.includes(card.skill)) {
      feed.push({ ...card, agent: agentForSkill(business, card.skill), key: `${business.id}:locked:${i}` });
    }
  });
  feed.push({
    ...CARD_TEMPLATES.triage(business, STANDING_VARIANT, activeAgents(business, choices)),
    agent: agentForSkill(business, "triage"),
    skill: "triage",
    key: `${business.id}:triage`,
  });
  return feed;
}

/**
 * Draft card `n` of a simulated event stream, counted from 1 and rotating through the chosen skills; `null` when
 * none is chosen. Throws `RangeError` when `n` is not a whole number from 1 up.
 */
export function simulateCard(business: BusinessProfile, choices: ChoiceMap, n: number): KeyedCard | null {
  if (!Number.isInteger(n) || n < 1) throw new RangeError("`n` counts simulated events from 1.");
  const skills = chosenSkills(business, choices).filter(hasTemplate);
  // With no skills the index is NaN, so `skill` is undefined.
  const skill = skills[(n - 1) % skills.length];
  if (skill === undefined) return null;
  // The skill's own event count, from 1, so its events cycle through the simulated variants and skip the standing one.
  const variant = Math.floor((n - 1) / skills.length) + 1;
  return {
    ...CARD_TEMPLATES[skill](business, variant),
    agent: agentForSkill(business, skill),
    skill,
    key: `${business.id}:sim:${n}`,
  };
}
