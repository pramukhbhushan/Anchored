import { QUIET_HOURS_RULE } from "@/lib/domain/executor";
import { activeAgents, agentForSkill, chosenSkills } from "@/lib/domain/paths";
import type { ActiveAgent, BusinessProfile, CardDraft, ChoiceMap, KeyedCard, SkillId, TradeKey } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The cards agents draft for the owner to approve. `CARD_TEMPLATES` holds one
// generic card per skill, worded for the business's trade, with customer names
// picked from its id; `draftFeed` builds a business's feed from its chosen
// skills, and `simulateCard` drafts one more card as if a new event came in.

/** A card before Anchored stamps it with the agent and skill that drafted it. */
export type CardBody = Omit<CardDraft, "agent" | "skill">;

/** Skills that draft cards. The daily brief writes the `morningBrief` lines instead of a card. */
export type CardSkill = Exclude<SkillId, "brief">;

/**
 * Draft one generic card. Variant 0 is the standing card in the feed; simulated events pass 1 and up, so
 * they never repeat it. `agents` are the agents at work here; triage hands email only to one of them.
 */
export type CardTemplate = (
  business: Pick<BusinessProfile, "id" | "kind" | "name" | "trade" | "tradeKey" | "reach" | "tools" | "signals" | "details">,
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

/** What a post can name: the first item the owner prices, else what they said to promote, else nothing. */
function offerOf(business: Pick<BusinessProfile, "details">): string | null {
  const item = business.details?.prices?.find((price) => price.item !== "")?.item ?? business.details?.promoteFocus?.[0];
  return item ? item.toLowerCase() : null;
}

/** One line of a post, naming the business and what it offers: an invitation to stop by for a business customers walk into, a message otherwise. */
function postLine(business: Pick<BusinessProfile, "reach" | "name" | "trade" | "tradeKey" | "details">, variant: number, google: boolean): string {
  const offer = offerOf(business);
  const about = offer ? `${capitalized(offer)} from ${business.name}` : `${business.name}, your local ${business.trade.toLowerCase()}`;
  if (business.reach.includes("Walk-ins")) {
    return google
      ? pick(variant, "Stop by this week, or call ahead to book a time.", "Planning a visit? Check our listing for this week's hours before you stop by.", `${about}. Stop by and say hi.`)
      : pick(variant, "Stop by this week, or call ahead to book a time.", "Thanks to everyone who came by this week. See you soon.", `${about}. Stop by and say hi.`);
  }
  // A coach or a field trade has no counter to stop by; the post asks for a message instead, in the owner's own word for a booking.
  const booking = business.details?.vocabulary?.bookingTerm ?? TRADE_WORDS[business.tradeKey].booking;
  const open = `${business.name} has openings for new ${booking}s this month. Send us a message to find a time.`;
  return google
    ? pick(variant, open, "Getting in touch? Check our listing for this week's hours first.", `${about}. Send us a message with any questions.`)
    : pick(variant, open, "Thanks to everyone we worked with this week.", `${about}. Send us a message with any questions.`);
}

/** Whether the owner said customers find them on Google or that they keep a Google Business Profile. */
function usesGoogle(business: Pick<BusinessProfile, "reach" | "tools">): boolean {
  return business.reach.includes("Google") || business.tools.includes("Google Business Profile");
}

// Tools that hold the owner's open times. Only a business that keeps one gets a draft offering exact times.
const CALENDAR_TOOL = /calendly|calendar|acuity|jobber|housecall|square appointments|vagaro|booksy|mindbody|opentable|resy|setmore|simplybook/i;

/** The check on a draft that offers times read from the owner's calendar. */
export const CALENDAR_CHECK = "Times match your calendar";

/** Whether the owner named a tool that holds their calendar, so a draft may offer times from it. */
function keepsCalendar(business: Pick<BusinessProfile, "tools">): boolean {
  return business.tools.some((tool) => CALENDAR_TOOL.test(tool));
}

// -----------------------------------------------------------------
// Customer names
// -----------------------------------------------------------------

// Large enough that two businesses seldom share a customer. Mixed origins, as a Maryland customer list would be.
const FIRST_NAMES = [
  "Aisha", "Andre", "Ana", "Beatriz", "Brandon", "Carmen", "Chloe", "Darnell", "Deepa", "Diego", "Elena", "Emeka",
  "Fatima", "Gabriel", "Grace", "Hana", "Hector", "Imani", "Jamal", "Jasmine", "Joon", "Julia", "Kayla", "Kwame",
  "Leah", "Lucia", "Malik", "Marco", "Mei", "Nadia", "Nikhil", "Olivia", "Omar", "Paige", "Quinn", "Rafael",
  "Renee", "Rosa", "Samir", "Sofia", "Tariq", "Tessa", "Thanh", "Valerie", "Wesley", "Yasmin", "Yusuf", "Zoe",
] as const;
const LAST_NAMES = [
  "Abebe", "Alvarez", "Banks", "Bennett", "Brooks", "Castillo", "Chen", "Coleman", "Diallo", "Dominguez", "Ellis",
  "Fischer", "Flores", "Gupta", "Hall", "Hughes", "Ibrahim", "Jackson", "Kang", "Kowalski", "Lopez", "Mbeki",
  "Mendoza", "Murphy", "Nguyen", "Novak", "Okafor", "Ortiz", "Park", "Patel", "Price", "Ramirez", "Reyes", "Rossi",
  "Shah", "Sullivan", "Tran", "Walker", "Washington", "Young",
] as const;

/** A 32-bit FNV-1a hash, so a seed string always lands on the same names. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A customer on one card, the same person in its title, body and recipient. */
interface Person {
  readonly first: string;
  readonly last: string;
  readonly full: string;
}

/** The person a seed string lands on, always the same one for the same seed. */
function personFrom(seedText: string): Person {
  const seed = hash(seedText);
  const first = FIRST_NAMES[seed % FIRST_NAMES.length] ?? FIRST_NAMES[0];
  // A second hash, so first and last names don't move together.
  const last = LAST_NAMES[hash(`${seed}:last`) % LAST_NAMES.length] ?? LAST_NAMES[0];
  return { first, last, full: `${first} ${last}` };
}

/** The customer on `skill`'s card at `variant`, picked from the business id so each business sees its own names. */
function personFor(business: Pick<BusinessProfile, "id">, skill: CardSkill, variant: number): Person {
  return personFrom(`${business.id}:${skill}:${variant}`);
}

/** `count` customer names for a business, each with its own first name, the same list every time for the same id. */
export function customerNames(businessId: string, count: number): string[] {
  const names: Person[] = [];
  // The pool holds far more first names than any caller asks for, so the loop ends long before its cap.
  for (let i = 0; names.length < count && i < count * 20; i += 1) {
    const person = personFrom(`${businessId}:customer:${i}`);
    if (!names.some((taken) => taken.first === person.first)) names.push(person);
  }
  return names.map((person) => person.full);
}

// -----------------------------------------------------------------
// Trade wording
// -----------------------------------------------------------------

/** The words a trade uses for the moments its cards describe. */
interface TradeWords {
  /** What a booking is called, such as "service visit" or "reservation". */
  readonly booking: string;
  /** What a new customer asked about, for a first reply's thanks: the standing card's, then simulated ones. */
  readonly asked: readonly [string, string, ...string[]];
  /** The title of a review ask about `person`. */
  readonly finished: (person: Person) => string;
  /** The detail a 4-star review mentions, and the owner's answer to it. */
  readonly review: { readonly topic: string; readonly reply: string };
  /** The title of a forwarded customer email. */
  readonly forwarded: string;
}

// The trades `detectTradeKey` knows, plus a neutral set for any other business. Nothing here names a price,
// a season or a service the owner may not offer: a plumber and a landscaper both read the `home` words.
const TRADE_WORDS: Readonly<Record<TradeKey, TradeWords>> = {
  home: {
    booking: "service visit",
    asked: ["getting someone out to take a look", "a quote for some work at their place", "when you could fit them in"],
    finished: (p) => `Job finished at the ${p.last} home`,
    review: { topic: "the crew arriving late", reply: "and you're right that we ran past the arrival window. We now text when the crew is on the way." },
    forwarded: "Forwarded email: a past customer asks about a follow-up visit",
  },
  restaurant: {
    booking: "reservation",
    asked: ["booking a table for a group", "ordering ahead for pickup", "your hours this weekend"],
    finished: (p) => `${p.full} ordered with you for the first time`,
    review: { topic: "a long wait", reply: "and you're right about the wait. We're adding help at our busiest hours." },
    forwarded: "Forwarded email: a guest asks about booking a group",
  },
  store: {
    booking: "pickup",
    asked: ["whether you carry an item they need", "setting something aside for pickup", "your hours this weekend"],
    finished: (p) => `${p.full} picked up an order today`,
    review: { topic: "an item that was out of stock", reply: "and you're right that we ran out. We've moved up our next order for it." },
    forwarded: "Forwarded email: a regular asks you to set an item aside",
  },
  coach: {
    booking: "session",
    asked: ["how your sessions work", "whether you have room for a new client", "what a first session looks like"],
    finished: (p) => `${p.full} finished their sessions`,
    review: { topic: "a session that started late", reply: "and you're right that we started late. Sessions now open on time." },
    forwarded: "Forwarded email: a question from a past client about starting again",
  },
  any: {
    booking: "appointment",
    asked: ["what you offer", "how to get started with you", "when you could fit them in"],
    finished: (p) => `${p.full} just worked with you`,
    review: { topic: "a slow reply", reply: "and you're right that we were slow to answer. We now reply the same day." },
    forwarded: "Forwarded email: a question from a past customer",
  },
};

// Invoice lines for the example business's example events. Whole milk is the research's own example
// (docs/research/corner-stores-and-restaurants.md); the rest follow the case study's avocado invoice.
const EXAMPLE_RISES: readonly [{ readonly item: string; readonly was: number; readonly now: number }, ...{ readonly item: string; readonly was: number; readonly now: number }[]] = [
  { item: "Whole milk", was: 31.4, now: 33.5 },
  { item: "Limes", was: 38, now: 42 },
  { item: "Cilantro", was: 24, now: 27 },
];

/** `text` with its first letter in capitals, for a booking word that starts a title. */
function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// =============================================================================
// Templates
// =============================================================================

/** One generic card per skill, worded for the trade, used when a business has no researched card for it. */
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
    const person = personFor(b, "inquiry", v);
    const channel = inquiryChannel(b);
    const [standing, ...simulated] = TRADE_WORDS[b.tradeKey].asked;
    // `asked` always holds a simulated option; the tuple type only can't carry that through the spread.
    const asked = pick(v, standing, ...(simulated as [string, ...string[]]));
    // Offer times only from a calendar the owner said they keep; otherwise ask the customer for one.
    const calendar = keepsCalendar(b);
    const next = calendar
      ? `Could we talk ${pick(v, "tomorrow at 10 a.m. or 3 p.m.", "tomorrow at 9 a.m. or 1 p.m.", "tomorrow at 11 a.m. or 2 p.m.")}?`
      : "What's a good time to reach you?";
    return {
      // Name only a channel the owner said they have, so a business with no website never sees one.
      title: channel === null ? `New inquiry from ${person.first}` : `New inquiry ${channel}: ${person.first}`,
      body: `Hi ${person.first}, thanks for asking ${b.name} about ${asked}! ${next}`,
      reason: "Replies within the hour qualify far more often.",
      checks: calendar ? [CALENDAR_CHECK, "No price in a first reply"] : ["No price in a first reply"],
      action: "Send email",
      channel: "email",
      to: person.full,
    };
  },
  showup: (b, v) => {
    const time = pick(v, "10 a.m.", "2:30 p.m.", "4 p.m.");
    const person = personFor(b, "showup", v);
    const booking = TRADE_WORDS[b.tradeKey].booking;
    return {
      title: `${capitalized(booking)} tomorrow at ${time} with ${person.first}`,
      body: `Hi ${person.first}, a reminder of your ${booking} with ${b.name} tomorrow at ${time}. Reply C to confirm or R to reschedule. Reply STOP to opt out.`,
      reason: "A reminder the day before saves the slot.",
      checks: [QUIET_HOURS_RULE, "Booked customer with consent"],
      action: "Send text",
      channel: "sms",
      to: person.full,
    };
  },
  // Only a business that said it takes catering orders has this skill, so the card can name catering.
  catering: (b, v) => {
    const guests = pick(v, "30", "45", "60");
    const person = personFor(b, "catering", v);
    return {
      title: `Party of ${guests} asked about catering`,
      body: `Hi ${person.first}, thanks for thinking of ${b.name}! For ${guests} people, which date are you planning for?`,
      reason: "One catering order is worth many single orders.",
      checks: ["No allergy claims", "Sent by email, not text"],
      action: "Send email",
      channel: "email",
      to: person.full,
    };
  },
  callfollow: (b, v) => {
    const person = personFor(b, "callfollow", v);
    return {
      title: `${person.first} said 'let me think' after your call`,
      body: `Hi ${person.first}, good talking the other day. Any questions I can answer about getting started with ${b.name}?`,
      reason: "Check-in 2 of 3.",
      checks: ["Check-in 2 of 3", "No new offer added"],
      action: "Send email",
      channel: "email",
      to: person.full,
    };
  },
  closer: (b, v) => {
    const person = personFor(b, "closer", v);
    return {
      title: `Quote to the ${person.last} family, 5 days quiet`,
      body: `Hi ${person.first}, it's ${b.name}. Checking in on the quote we sent last week. Happy to answer questions or adjust the scope. Reply STOP to opt out.`,
      reason: "Touch 2 of 3. Quotes stall without a nudge.",
      checks: ["Customer has a consent record", "No new offer added", "Touch 2 of 3"],
      action: "Send text",
      channel: "sms",
      to: person.full,
    };
  },
  debrief: (_b, v) => ({
    title: `Voice note from ${pick(v, "today's visit", "this morning's visit", "the last job")}`,
    body: `The customer wants a price for the work we looked at and asked for it by ${pick(v, "Friday", "Monday", "Wednesday")}. Create a follow-up so it doesn't get lost?`,
    reason: "Prices given in person get lost when nobody writes them down.",
    checks: ["Details came from your note, not the model"],
    action: "Create follow-up",
    channel: "list",
  }),
  // No past-customer list or plan list reaches Anchored yet, so these name no count or date.
  reactivator: (b, v) => ({
    title: "Past customers who haven't been back in a year",
    body: `Hi, it's ${b.name}. ${pick(v, "It's been a while!", "We'd love to see you again.", "We have openings coming up.")} Reply YES and we'll find you a time. Reply STOP to opt out.`,
    reason: "Past customers already know you.",
    checks: ["Only customers with written consent", QUIET_HOURS_RULE],
    action: "Send to past customers",
    channel: "sms",
    to: "Past customers with consent",
  }),
  keeper: (b, v) => ({
    title: pick(v, "Plans that renew next month", "Plans that renew mid-month", "Plans that renew at the end of the month"),
    body: `Hi, your plan with ${b.name} renews ${pick(v, "next month", "mid-month", "at the end of the month")}. Reply YES to keep it. Reply STOP to opt out.`,
    reason: "Renewal 30 days out keeps plans from lapsing.",
    checks: ["Plan members with consent", "No new price"],
    action: "Send to plan members",
    channel: "sms",
    to: "Plan members",
  }),
  referral: (b, v) => {
    const person = personFor(b, "referral", v);
    return {
      title: `${person.first} finishes in two weeks`,
      body: `Hi ${person.first}, it's been great working with you. Would you write two lines about your experience, and is there anyone you'd suggest we talk to?`,
      reason: "The best time to ask is near the finish.",
      checks: ["No reward tied to a rating"],
      action: "Send email",
      channel: "email",
      to: person.full,
    };
  },
  // No business profile holds a review link yet, so the text promises it instead of leaving a blank to fill.
  reviewer: (b, v) => {
    const person = personFor(b, "reviewer", v);
    return {
      title: TRADE_WORDS[b.tradeKey].finished(person),
      body: `Thanks for choosing ${b.name}, ${person.first}! If we did right by you, a Google review helps neighbors find us. I'll send the link next. Reply STOP to opt out.`,
      reason: "Ask while the visit is fresh.",
      checks: ["No reward offered for a rating", "Existing customer with consent"],
      action: "Send text",
      channel: "sms",
      to: person.full,
    };
  },
  // No business profile holds a payment link yet, so the email promises it instead of leaving a blank to fill.
  // A real overdue invoice comes from Stripe with its own number and amount; the starter names neither.
  nudger: (b, v) => {
    const person = personFor(b, "nudger", v);
    return {
      title: `${person.first}'s invoice is past due`,
      body: `Hi ${person.first}, a quick reminder about your invoice from ${b.name}. If paying online is easier, I'll send the link next. Thanks!`,
      reason: "A friendly reminder now beats an awkward one later.",
      checks: ["No late fee added"],
      action: "Send email",
      channel: "email",
      to: person.full,
    };
  },
  // Supplier invoices can't reach an owner's business yet, so its starter names no item, price or rise. The example
  // business shows researched invoice lines instead, a different one per example event.
  pricewatch: (b, v) => {
    const rise = b.kind === "case" && v !== STANDING_VARIANT ? EXAMPLE_RISES[(v - 1) % EXAMPLE_RISES.length] : null;
    return {
      title: rise ? `${rise.item} up $${(rise.now - rise.was).toFixed(2)} a case` : "An item on your supplier invoice went up",
      body: rise
        ? `Your latest invoice charges $${rise.now.toFixed(2)} a case for ${rise.item.toLowerCase()}, up from $${rise.was.toFixed(2)} on the one before. Add it to your list for the rep?`
        : "Your latest invoice charges more for an item than last time. Add it to your list for the rep?",
      reason: "Price rises pass unseen until margins shrink.",
      checks: rise ? ["Compared with your last invoice on file"] : ["You check the invoice yourself"],
      action: "Add to rep list",
      channel: "list",
    };
  },
  // Google listing posts only for a business that said it uses Google. No profile holds hours, so no post states them,
  // and no title claims how long the owner has gone without posting.
  posts: (b, v) =>
    usesGoogle(b)
      ? {
          title: pick(
            v,
            "A fresh post for your Google listing",
            "Customers check your Google listing before they visit",
            "Your Google listing could use a recent photo",
          ),
          body: `Draft post for ${b.name}: "${postLine(b, v, true)}"`,
          reason: "Customers skip a business when basic details are missing.",
          checks: ["You post it yourself", "No prices or offers in the post"],
          action: "Copy post",
          channel: "list",
        }
      : {
          title: pick(v, "A short post for this week", "Show customers what's new", "A thank-you post for your customers"),
          body: `Draft post for ${b.name}: "${postLine(b, v, false)}"`,
          reason: "A short, regular post keeps you in front of customers.",
          checks: ["You post it yourself", "No prices or offers in the post"],
          action: "Copy post",
          channel: "list",
        },
  reviewdrafter: (b, v) => {
    const review = TRADE_WORDS[b.tradeKey].review;
    return {
      title: `New 4-star review mentions ${review.topic}`,
      body: `Thanks for the kind words, ${personFor(b, "reviewdrafter", v).first}, ${review.reply} Hope to see you again soon.`,
      reason: "Generic replies put readers off, so the draft cites one detail.",
      checks: ["Cites one detail from the review", "No discount offered"],
      action: "Copy reply",
      channel: "list",
    };
  },
  triage: (b, _v, agents = []) => {
    // A business with no suppliers forwards customer mail instead, which is the Front Desk's work.
    if (!b.signals.includes("suppliers")) {
      const frontDesk = agents.find((agent) => agent.skills.includes("inquiry"));
      return {
        title: TRADE_WORDS[b.tradeKey].forwarded,
        body:
          frontDesk === undefined
            ? "None of your agents answers new questions, so this one is yours to read."
            : `${frontDesk.name} will draft a reply for you to approve.`,
        reason: "Each forwarded email goes to the agent that handles that work, or to you when none does.",
        checks: ["Read from an email you forwarded", "No reply sent to anyone"],
        action: frontDesk === undefined ? "Add it to your list" : `Route to ${frontDesk.name}`,
        channel: "list",
      };
    }
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
  // No profile names a calendar, so the reminder goes on the owner's list rather than into a calendar.
  // License photos and shelf counts can't reach Anchored yet, so neither starter names a date or a count.
  license: (_b, v) => ({
    title: pick(v, "A license renews soon", "A permit renews soon", "A certificate renews soon"),
    body: "Add a renewal reminder a month before it's due?",
    reason: "A lapse can shut down part of the business.",
    checks: ["You add the renewal date yourself"],
    action: "Add reminder",
    channel: "list",
  }),
  stockcheck: () => ({
    title: "Staples check before your next wholesale run",
    body: "Count the varieties you stock in each staple category, and add any gaps to the next run. This count is not a USDA determination. Rule text checked Nov 7, 2026.",
    reason: "The SNAP stocking rule took effect Nov 4, 2026.",
    checks: ["You do the count"],
    action: "Add to run list",
    channel: "list",
  }),
};

/** Whether `skill` drafts cards, so it has a template. */
export function hasTemplate(skill: SkillId): skill is CardSkill {
  return skill !== "brief";
}

// =============================================================================
// Keys
// =============================================================================

/** The key of a business's standing card for `skill`: its starter, whether a template or written for it. */
export function standingKey(businessId: string, skill: SkillId): string {
  return `${businessId}:${skill}`;
}

/** A fresh key for a card a real outside event produced, such as a customer's text. */
export function liveEventKey(businessId: string, eventId: string): string {
  return `${businessId}:event:${eventId}`;
}

/** Whether `key` belongs to a card a real outside event produced, not a starter, a simulation or a chat request. */
export function isLiveEventKey(key: string): boolean {
  return key.includes(":event:");
}

// =============================================================================
// Feed
// =============================================================================

/**
 * The feed: one card per chosen skill, locked cards whose skill is chosen, then one inbox triage card. On an
 * owner's own business every one is an example, since no real customer sent it; the example business is all example.
 */
export function draftFeed(business: BusinessProfile, choices: ChoiceMap): KeyedCard[] {
  const skills = chosenSkills(business, choices);
  // The example business is labeled as an example as a whole, so its researched cards carry no tag.
  const example = business.kind === "custom" ? ({ example: true } as const) : {};
  const feed: KeyedCard[] = skills.filter(hasTemplate).map((skill) => ({
    ...(business.cards?.[skill] ?? CARD_TEMPLATES[skill](business, STANDING_VARIANT)),
    ...example,
    agent: agentForSkill(business, skill),
    skill,
    key: standingKey(business.id, skill),
  }));
  // `i` counts every locked card, chosen or not, so a card keeps its key when other skills change.
  business.lockedCards?.forEach((card, i) => {
    if (skills.includes(card.skill)) {
      feed.push({ ...card, ...example, agent: agentForSkill(business, card.skill), key: `${business.id}:locked:${i}` });
    }
  });
  feed.push({
    ...CARD_TEMPLATES.triage(business, STANDING_VARIANT, activeAgents(business, choices)),
    ...example,
    agent: agentForSkill(business, "triage"),
    skill: "triage",
    key: standingKey(business.id, "triage"),
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
